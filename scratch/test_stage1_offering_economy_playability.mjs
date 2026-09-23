import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { OFFERING_GENERATION_REASONS } from "../game/src/systems/deck_manager.js";
import { LAND_CARDS_MASTER } from "../game/src/data/land_cards_data.js";
import { createObservableEnemyProfile } from "../game/src/warning/domain/observable_enemy_profile.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";

const TRACE_SEEDS = Object.freeze([
    20260920,
    20260921,
    20260922,
    20260923,
    20260924,
    20260925,
    20260926,
    20260927
]);

// Economy harness only: provide already-redacted observable fragments so one
// Investigation action can consume a Verse without owning Trial truth setup.
// FirstRun/Trial integration tests remain responsible for the real truth -> profile wiring.
const stage1EconomyObservationProjector = Object.freeze({
    project() {
        return createObservableEnemyProfile({
            trialIndex: 1,
            threatRevision: 0,
            scaleBand: "SMALL",
            directionHints: ["DISTANT_ACTIVITY"],
            physiqueTraits: ["LARGE_BODY_PRESENT"]
        });
    }
});

function definitionOf(card) {
    return card?.terrain || card || null;
}

function countShapeCells(shape) {
    return (shape || []).reduce(
        (sum, row) => sum + (row || []).filter(value => value === 1).length,
        0
    );
}

function geometryKey(shape, anchor, attributeCells) {
    return JSON.stringify({
        shape,
        anchor,
        attributes: (attributeCells || []).map(cell => ({
            r: cell.r,
            c: cell.c,
            terrainId: cell.terrainId || cell.id || cell.terrain?.terrainId || cell.terrain?.id || null
        }))
    });
}

function enumerateLegalPlacements(state, card) {
    const definition = definitionOf(card);
    let shape = resolvePlacementShape(card);
    let anchor = resolvePlacementAnchor(card, shape);
    let attributeCells = resolvePlacementAttributeCells(card);
    const seen = new Set();
    const placements = [];
    const size = state.grid.length;

    for (let rotation = 0; rotation < 4; rotation++) {
        const key = geometryKey(shape, anchor, attributeCells);
        if (!seen.has(key)) {
            seen.add(key);
            for (let clickedR = 0; clickedR < size; clickedR++) {
                for (let clickedC = 0; clickedC < size; clickedC++) {
                    const startR = clickedR - anchor.r;
                    const startC = clickedC - anchor.c;
                    const check = state.canPlaceShape(
                        startR,
                        startC,
                        shape,
                        definition,
                        attributeCells
                    );
                    if (check?.can === true) {
                        placements.push({
                            clickedR,
                            clickedC,
                            rotation,
                            shape,
                            anchor,
                            attributeCells
                        });
                    }
                }
            }
        }

        const rotated = rotatePlacementClockwise(shape, anchor, attributeCells);
        shape = rotated.shape;
        anchor = rotated.anchor;
        attributeCells = rotated.attributeCells;
    }

    return placements;
}

function makeRotatedInstance(card, placement) {
    return {
        ...card,
        currentShape: placement.shape,
        currentAnchor: placement.anchor,
        ...(placement.attributeCells
            ? { currentCells: placement.attributeCells }
            : {})
    };
}

function countTrueZones(state) {
    const groups = new Set();
    for (const row of state.grid || []) {
        for (const cell of row || []) {
            if (cell?.placed && cell?.merged === true && cell.mergeGroupId) {
                groups.add(cell.mergeGroupId);
            }
        }
    }
    return groups.size;
}

function countDiscoveredSockets(state) {
    let count = 0;
    for (const row of state.grid || []) {
        for (const cell of row || []) {
            if (cell?.placed && cell?.socketResource) count += 1;
        }
    }
    return count;
}

function readDefense(state) {
    if (state.defenseSystem?.getCurrentDefense) {
        return state.defenseSystem.getCurrentDefense();
    }
    return Number(state.currentDefense ?? state.defense ?? 0) || 0;
}

function readMaxDefense(state) {
    if (state.defenseSystem?.getMaxDefense) {
        return state.defenseSystem.getMaxDefense();
    }
    return Number(state.maxDefense ?? state.defense ?? 0) || 0;
}

function resolvePoolCounts(engine) {
    const stageNum = Number(engine.state.stage?.id || 1);
    const h2Count = engine.deckManager._countE2HillsOnBoard();
    const candidates = engine.deckManager.offeringCandidatePool.build({
        stageNum,
        h2Count,
        excludedCardIds: [],
        eligibilityOptions: {
            ignoreCooldown: true,
            placeabilityCache: new WeakMap()
        }
    });

    return {
        offeringCandidateCount: candidates.length,
        legalLandCandidateCount: candidates.filter(card => card?.category === "LAND").length,
        investigationCandidateCount: candidates.filter(card => card?.category === "INVESTIGATION").length
    };
}

function scoreLandOption(option, state) {
    const definition = option.definition;
    const id = String(definition?.id || "");
    const shapeCells = countShapeCells(option.placement.shape);
    const yields = definition?.yields || {};
    let score = shapeCells * 100;
    score += (Number(yields.food) || 0) * 8;
    score += (Number(yields.defense) || 0) * 7;
    score += (Number(yields.wood ?? yields.material) || 0) * 4;
    score += (Number(yields.mystic) || 0) * 2;

    if (id.includes("FOREST")) score += 30;
    if (id.includes("PLAINS")) score += state.food < 45 ? 45 : 20;
    if (id.includes("HILL")) score += 15;
    if (id.includes("DESERT")) score += state.mystic < 5 ? 10 : 0;
    return score;
}

function chooseAction(engine, { preferInvestigation = false } = {}) {
    const state = engine.state;
    const offering = state.handOffering || [];
    const landOptions = [];
    const investigationOptions = [];

    offering.forEach((card, index) => {
        const definition = definitionOf(card);
        if (!definition) return;

        if (definition.category === "LAND") {
            const placements = enumerateLegalPlacements(state, card);
            if (placements.length > 0) {
                landOptions.push({
                    card,
                    index,
                    definition,
                    placement: placements[0]
                });
            }
        } else if (
            definition.category === "INVESTIGATION"
            && engine.isInvestigationAvailable?.() === true
        ) {
            investigationOptions.push({ card, index, definition });
        }
    });

    if (preferInvestigation && investigationOptions.length > 0) {
        return { type: "INVESTIGATION", ...investigationOptions[0] };
    }
    if (landOptions.length > 0) {
        landOptions.sort((a, b) => scoreLandOption(b, state) - scoreLandOption(a, state));
        return { type: "LAND", ...landOptions[0] };
    }
    if (investigationOptions.length > 0) {
        return { type: "INVESTIGATION", ...investigationOptions[0] };
    }
    return null;
}

function captureVerse(engine, seed) {
    const state = engine.state;
    const poolCounts = resolvePoolCounts(engine);
    const production = state.calculateTotalProduction();
    const resourceBreakdown = state.getResourceBreakdown();
    const offering = state.handOffering || [];
    const legalOfferingLandCount = offering.filter(card => {
        const definition = definitionOf(card);
        return definition?.category === "LAND"
            && engine.deckManager._isCardPlaceableNow(card);
    }).length;

    return {
        seed,
        verse: state.turn,
        offeringCount: offering.length,
        ...poolCounts,
        legalOfferingLandCount,
        food: state.food,
        material: state.wood ?? state.material ?? 0,
        defense: readDefense(state),
        maxDefense: readMaxDefense(state),
        mystic: state.mystic,
        ember: state.ember,
        grossFood: production.grossFood,
        foodCost: production.foodCost,
        netFood: production.netFood,
        materialProduction: production.totalMaterial ?? production.totalWood ?? 0,
        territoryTiles: state.getTerritoryTileCount(),
        foodProductionBreakdown: resourceBreakdown?.food || null,
        materialProductionBreakdown: resourceBreakdown?.wood || null,
        zones: countTrueZones(state),
        links: state.mergeLinks instanceof Set ? state.mergeLinks.size : 0,
        sockets: countDiscoveredSockets(state)
    };
}

function printTrace(trace) {
    console.log(
        [
            `seed=${trace.seed}`,
            `V${trace.verse}`,
            `offer=${trace.offeringCount}`,
            `pool=${trace.offeringCandidateCount}`,
            `legalLand=${trace.legalLandCandidateCount}`,
            `offeredLegalLand=${trace.legalOfferingLandCount}`,
            `🌾${trace.food}`,
            `🧱${trace.material}`,
            `🛡️${trace.defense}/${trace.maxDefense}`,
            `✨${trace.mystic}`,
            `🔥${trace.ember}`,
            `prod=🌾+${trace.grossFood}-${trace.foodCost}=${trace.netFood}`,
            `🧱+${trace.materialProduction}`,
            `tiles=${trace.territoryTiles}`,
            `zone=${trace.zones}`,
            `link=${trace.links}`,
            `socket=${trace.sockets}`
        ].join(" ")
    );
}

function testFoodSettlementUsesGrossProductionOnce() {
    const engine = GameEngine.createGame({
        runSeed: 20260922,
        firstRun: true
    });
    const before = engine.state.food;
    const preview = engine.previewTurnEndMaintenance();

    assert.equal(preview.production.grossFood, 10, "Stage1 HQ gross food baseline must remain 10");
    assert.equal(preview.production.foodCost, 20, "normal Stage1 maintenance must remain 20");

    engine.nextTurn();

    assert.equal(
        engine.state.food,
        before + preview.production.grossFood - preview.production.foodCost,
        "Verse settlement must add gross food and subtract maintenance exactly once"
    );
}

function testReserveDoesNotPoisonOfferingOrOverchargeEmber() {
    const control = GameEngine.createGame({
        runSeed: 20260923,
        firstRun: true
    });
    const held = GameEngine.createGame({
        runSeed: 20260923,
        firstRun: true
    });

    const reserved = held.state.handOffering[0];
    const reservedMasterId = reserved?.cardMasterId || definitionOf(reserved)?.id;
    const reserveResult = held.reserveOfferingCard(0);
    assert.equal(reserveResult?.success, true, "Stage1 Offering card must be reservable");
    assert.equal(
        held.state.reserveSlots.some(card => (card?.cardMasterId || definitionOf(card)?.id) === reservedMasterId),
        true,
        "reserved card must occupy the canonical reserve slot"
    );

    const regenerated = held.deckManager.generateOfferingCards({
        reason: OFFERING_GENERATION_REASONS.MULLIGAN
    });
    assert.equal(
        regenerated.some(card => (card?.cardMasterId || definitionOf(card)?.id) === reservedMasterId),
        false,
        "held reserve card must stay excluded from regenerated Offering"
    );
    assert.equal(
        regenerated.some(card => {
            const definition = definitionOf(card);
            return definition?.category === "LAND"
                ? held.deckManager._isCardPlaceableNow(card)
                : definition?.category === "INVESTIGATION";
        }),
        true,
        "reserve exclusion must not create an Offering dead-end"
    );

    control.nextTurn();
    held.nextTurn();
    assert.equal(
        control.state.ember - held.state.ember,
        1,
        "one held reserve must add exactly one Ember upkeep, not duplicate charges"
    );
}

function testStage1MultiAttributeEligibility() {
    const engine = GameEngine.createGame({
        runSeed: 20260924,
        firstRun: true
    });
    const multiCards = engine.deckManager.getLandCardMaster().filter(card =>
        card?.minStage === 1 && String(card?.id || "").startsWith("CARD_MULTI_")
    );
    assert.equal(multiCards.length >= 2, true, "Stage1 must expose authored Multi-Attribute land cards");

    for (const card of multiCards) {
        assert.equal(
            engine.deckManager.isCardEligible(card, 1, 0, {
                ignoreCooldown: true,
                placeabilityCache: new WeakMap()
            }),
            true,
            `${card.id} must stay eligible when a rotated/current legal placement exists`
        );
    }
}

function placeSingleCell(state, definition, r, c) {
    state.hasPickedThisTurn = false;
    const result = state.placeShape(r, c, [[1]], definition, -1, null);
    assert.equal(result?.success, true, `${definition.id} must be placeable at ${r},${c}`);
    return result;
}

function testZoneAndLinkAreAimableOnFiveByFive() {
    const engine = GameEngine.createGame({
        runSeed: 20260925,
        firstRun: true
    });
    const state = engine.state;
    const plains = LAND_CARDS_MASTER.find(card => card.id === "CARD_PLAINS_1X1");
    const forest = LAND_CARDS_MASTER.find(card => card.id === "CARD_FOREST_1X1");
    assert.ok(plains);
    assert.ok(forest);

    // 2x2 PLAINS zone, connected to HQ via (2,1).
    placeSingleCell(state, plains, 2, 1);
    placeSingleCell(state, plains, 2, 0);
    placeSingleCell(state, plains, 1, 1);
    placeSingleCell(state, plains, 1, 0);

    // Adjacent 2x2 FOREST zone at rows 3-4, cols 0-1.
    placeSingleCell(state, forest, 3, 1);
    placeSingleCell(state, forest, 3, 0);
    placeSingleCell(state, forest, 4, 1);
    placeSingleCell(state, forest, 4, 0);

    assert.equal(countTrueZones(state) >= 2, true, "two true Stage1 Zones must be aimable on 5x5");
    assert.equal(
        state.mergeLinks instanceof Set && state.mergeLinks.size >= 1,
        true,
        "two different adjacent true Zones must create a Stage1 Link"
    );
    assert.equal(readMaxDefense(state) > 10, true, "FOREST Zone path must make pre-Trial defense growth possible");
    assert.equal(state.maxEmber > 20, true, "Stage1 Link must expand Ember capacity");
}

function runSeedTrace(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        enemyObservationProjector: stage1EconomyObservationProjector
    });
    const trace = [];
    const settlements = [];
    let investigationExecuted = false;

    assert.equal(engine.state.stage.id, 1);
    assert.equal(engine.state.grid.length, 5);

    for (let verse = 1; verse <= 15; verse++) {
        assert.equal(engine.state.turn, verse);
        const snapshot = captureVerse(engine, seed);
        trace.push(snapshot);

        assert.equal(snapshot.offeringCount > 0, true, `seed ${seed} V${verse}: Offering must not be empty`);
        assert.equal(
            (engine.state.handOffering || [])
                .filter(card => definitionOf(card)?.category === "LAND")
                .every(card => engine.deckManager._isCardPlaceableNow(card)),
            true,
            `seed ${seed} V${verse}: offered LAND cards must all be legal on the current board`
        );

        if (verse === 1) {
            assert.equal(snapshot.legalLandCandidateCount > 0, true, "Verse1 needs a legal LAND candidate");
            assert.equal(snapshot.legalOfferingLandCount > 0, true, "Verse1 needs an actually placeable LAND in Offering");
        }

        if (verse >= 8) {
            assert.equal(
                (engine.state.handOffering || []).some(card => definitionOf(card)?.category === "INVESTIGATION"),
                true,
                `seed ${seed} V${verse}: FirstRun must guarantee Investigation in Offering after unlock`
            );
        }

        if (verse === 15) break;

        const action = chooseAction(engine, {
            preferInvestigation: verse >= 8 && !investigationExecuted
        });
        assert.ok(action, `seed ${seed} V${verse}: Offering must contain at least one actionable card`);

        if (action.type === "LAND") {
            const rotated = makeRotatedInstance(action.card, action.placement);
            const result = engine.placeLand(
                action.placement.clickedR,
                action.placement.clickedC,
                rotated,
                action.placement.rotation,
                { type: "OFFERING", index: action.index }
            );
            assert.equal(result?.success, true, `seed ${seed} V${verse}: selected LAND action must commit`);
        } else {
            const result = engine.executeInvestigationCard(
                action.card,
                { type: "OFFERING", index: action.index }
            );
            assert.equal(result?.success, true, `seed ${seed} V${verse}: Investigation action must commit`);
            investigationExecuted = true;
        }

        const beforeSettlement = {
            food: engine.state.food,
            material: engine.state.wood ?? engine.state.material ?? 0,
            mystic: engine.state.mystic
        };
        const settlementPreview = engine.previewTurnEndMaintenance();
        const settlementBreakdown = engine.state.getResourceBreakdown();
        const boundary = engine.nextTurn();
        settlements.push({
            verse,
            territoryTiles: engine.state.getTerritoryTileCount(),
            foodBefore: beforeSettlement.food,
            grossFood: settlementPreview.production.grossFood,
            foodCost: settlementPreview.production.foodCost,
            netFood: settlementPreview.production.netFood,
            foodAfter: engine.state.food,
            materialBefore: beforeSettlement.material,
            materialProduction: settlementPreview.production.totalMaterial ?? settlementPreview.production.totalWood ?? 0,
            materialAfter: engine.state.wood ?? engine.state.material ?? 0,
            mysticBefore: beforeSettlement.mystic,
            mysticProduction: settlementPreview.production.totalMystic ?? 0,
            mysticAfter: engine.state.mystic,
            foodBreakdown: settlementBreakdown?.food || null,
            materialBreakdown: settlementBreakdown?.wood || null
        });
        assert.equal(
            engine.state.food,
            beforeSettlement.food + settlementPreview.production.grossFood - settlementPreview.production.foodCost,
            `seed ${seed} V${verse}: food stock must equal stock + gross production - one maintenance payment`
        );
        assert.equal(
            engine.state.wood ?? engine.state.material ?? 0,
            beforeSettlement.material + (settlementPreview.production.totalMaterial ?? settlementPreview.production.totalWood ?? 0),
            `seed ${seed} V${verse}: material stock must equal stock + production when the chosen Stage1 action has no material cost`
        );
        assert.equal(boundary?.runTermination?.terminated === true, false, `seed ${seed} V${verse}: run must not terminate`);
        assert.equal(engine.state.gameOver === true, false, `seed ${seed} V${verse}: Stage1 must stay alive`);
    }

    for (const row of trace) printTrace(row);

    const verse7 = trace.find(row => row.verse === 7);
    const verse8 = trace.find(row => row.verse === 8);
    const verse15 = trace.find(row => row.verse === 15);
    assert.ok(verse7);
    assert.ok(verse8);
    assert.ok(verse15);
    assert.equal(verse7.ember > 0, true, `seed ${seed}: economy must survive through Verse7`);
    assert.equal(verse15.food > 0, true, `seed ${seed}: representative Stage1 strategy must retain food at Verse15`);
    assert.equal(verse15.material > 0, true, `seed ${seed}: representative Stage1 strategy must retain material at Verse15`);
    assert.equal(verse15.ember > 0, true, `seed ${seed}: representative Stage1 strategy must retain Ember at Verse15`);
    assert.equal(verse15.mystic > 0, true, `seed ${seed}: Mystic must be live by Verse15`);
    assert.equal(verse15.defense >= 10, true, `seed ${seed}: defense must not regress below HQ baseline`);
    assert.equal(
        investigationExecuted,
        true,
        `seed ${seed}: representative Stage1 path must execute at least one Investigation after unlock`
    );

    const totalGrossFood = settlements.reduce((sum, row) => sum + row.grossFood, 0);
    const totalFoodMaintenance = settlements.reduce((sum, row) => sum + row.foodCost, 0);
    const totalMaterialProduction = settlements.reduce((sum, row) => sum + row.materialProduction, 0);
    const firstSettlement = settlements[0];
    const lastSettlement = settlements[settlements.length - 1];
    console.log(
        [
            `ECON seed=${seed}`,
            `settlements=${settlements.length}`,
            `grossFood=${totalGrossFood}`,
            `foodMaintenance=${totalFoodMaintenance}`,
            `foodNetSupply=${totalGrossFood - totalFoodMaintenance}`,
            `materialProduction=${totalMaterialProduction}`,
            `grossFoodRamp=${firstSettlement?.grossFood ?? 0}->${lastSettlement?.grossFood ?? 0}`,
            `materialRamp=${firstSettlement?.materialProduction ?? 0}->${lastSettlement?.materialProduction ?? 0}`,
            `tiles=${firstSettlement?.territoryTiles ?? 0}->${lastSettlement?.territoryTiles ?? 0}`
        ].join(" ")
    );

    return { trace, settlements };
}

console.log("=== Stage1 Offering / Economy / Board Playability Audit ===");

testFoodSettlementUsesGrossProductionOnce();
testReserveDoesNotPoisonOfferingOrOverchargeEmber();
testStage1MultiAttributeEligibility();
testZoneAndLinkAreAimableOnFiveByFive();

const runs = TRACE_SEEDS.map(runSeedTrace);
const traces = runs.map(run => run.trace);
const finals = traces.map(trace => trace.find(row => row.verse === 15));
assert.equal(
    finals.some(row => row.defense > 10),
    true,
    "at least one representative seeded run must demonstrate pre-Trial defense preparation"
);
assert.equal(
    traces.every(trace => trace.every(row => row.offeringCount > 0)),
    true,
    "no observed Stage1 verse may produce an empty Offering"
);
assert.equal(
    runs.every(run => run.settlements.length === 14),
    true,
    "Verse1-to-15 audit must account for exactly fourteen Stage1 settlements"
);
assert.equal(
    runs.every(run => run.settlements
        .filter(row => row.verse >= 4)
        .every(row => row.grossFood >= row.foodCost)),
    true,
    "representative land-building path should expose sustained food self-sufficiency from Verse4 onward while initial stock covers the opening ramp"
);
assert.equal(
    runs.every(run => run.settlements.every(row => row.materialProduction > 0)),
    true,
    "representative Stage1 path should expose uninterrupted positive material production"
);

console.log(
    `PASS Stage1 playability audit: ${TRACE_SEEDS.length} seeds x Verse1-15 + reserve + food settlement + Multi-Attribute + Zone/Link`
);
