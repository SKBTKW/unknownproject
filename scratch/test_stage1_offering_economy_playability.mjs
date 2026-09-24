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
import {
    resolveCardProductionPreview,
    resolveCellProductionBase
} from "../game/src/core/land_production_contract.js";
import { resolveOfferingWeight } from "../game/src/cards/offering_weight_policy.js";

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


function listPlacementGroupIds(state) {
    const ids = new Set();
    for (const row of state.grid || []) {
        for (const cell of row || []) {
            if (cell?.placed && !cell.isHQ && cell.placementGroupId != null) {
                ids.add(String(cell.placementGroupId));
            }
        }
    }
    return ids;
}

function recordPlacementOrigin(state, beforeIds, action, placementOrigins) {
    const afterIds = listPlacementGroupIds(state);
    const newIds = [...afterIds].filter(id => !beforeIds.has(id));
    assert.equal(
        newIds.length,
        1,
        `expected exactly one new placement group for ${action.definition?.id || "LAND"}, got ${newIds.length}`
    );
    const cardId = String(action.definition?.id || "");
    placementOrigins.set(newIds[0], {
        cardId,
        multiAttribute: cardId.startsWith("CARD_MULTI_")
    });
}

function terrainContributionKey(cell) {
    return String(cell?.terrain?.terrainId || cell?.terrain?.id || "UNKNOWN");
}

function addTerrainContribution(map, key, food, material) {
    const current = map.get(key) || { food: 0, material: 0 };
    current.food += food;
    current.material += material;
    map.set(key, current);
}

function analyzeProductionContribution(state, placementOrigins) {
    const breakdown = state.getResourceBreakdown();
    let baseCellFood = 0;
    let baseCellMaterial = 0;
    let multiCellFood = 0;
    let multiCellMaterial = 0;
    const terrain = new Map();

    for (const row of state.grid || []) {
        for (const cell of row || []) {
            if (!cell?.placed || cell.isHQ || !cell.terrain) continue;
            const base = resolveCellProductionBase(cell).yields;
            const food = Number(base.food) || 0;
            const material = Number(base.wood) || 0;
            baseCellFood += food;
            baseCellMaterial += material;
            addTerrainContribution(terrain, terrainContributionKey(cell), food, material);

            const origin = cell.placementGroupId != null
                ? placementOrigins.get(String(cell.placementGroupId))
                : null;
            if (origin?.multiAttribute) {
                multiCellFood += food;
                multiCellMaterial += material;
            }
        }
    }

    const food = breakdown?.food || {};
    const material = breakdown?.wood || {};
    const zoneFood = (Number(food.tiles) || 0) - baseCellFood;
    const zoneMaterial = (Number(material.tiles) || 0) - baseCellMaterial;
    assert.equal(zoneFood >= 0, true, "Zone food uplift must not be negative in Stage1 audit");
    assert.equal(zoneMaterial >= 0, true, "Zone material uplift must not be negative in Stage1 audit");

    const foodKnownBeforeOther =
        (Number(food.hqBase) || 0)
        + baseCellFood
        + zoneFood
        + (Number(food.blocks) || 0)
        + (Number(food.specialBlocks) || 0)
        + (Number(food.sockets) || 0)
        + (Number(food.vicinity) || 0)
        + (Number(food.lakeIrrigation) || 0);
    const materialKnownBeforeOther =
        (Number(material.hqBase) || 0)
        + baseCellMaterial
        + zoneMaterial
        + (Number(material.blocks) || 0)
        + (Number(material.specialBlocks) || 0)
        + (Number(material.sockets) || 0)
        + (Number(material.vicinity) || 0);

    return {
        grossFood: Number(food.gross) || 0,
        totalMaterial: Number(material.total) || 0,
        hqFood: Number(food.hqBase) || 0,
        hqMaterial: Number(material.hqBase) || 0,
        baseCellFood,
        baseCellMaterial,
        multiCellFood,
        multiCellMaterial,
        zoneFood,
        zoneMaterial,
        blockFood: Number(food.blocks) || 0,
        blockMaterial: Number(material.blocks) || 0,
        specialFood: Number(food.specialBlocks) || 0,
        specialMaterial: Number(material.specialBlocks) || 0,
        socketFood: Number(food.sockets) || 0,
        socketMaterial: Number(material.sockets) || 0,
        vicinityFood: Number(food.vicinity) || 0,
        vicinityMaterial: Number(material.vicinity) || 0,
        irrigationFood: Number(food.lakeIrrigation) || 0,
        otherFood: (Number(food.gross) || 0) - foodKnownBeforeOther,
        otherMaterial: (Number(material.total) || 0) - materialKnownBeforeOther,
        terrain: Object.fromEntries([...terrain.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
}

function sumContributionRows(rows) {
    const keys = [
        "grossFood", "totalMaterial",
        "hqFood", "hqMaterial",
        "baseCellFood", "baseCellMaterial",
        "multiCellFood", "multiCellMaterial",
        "zoneFood", "zoneMaterial",
        "blockFood", "blockMaterial",
        "specialFood", "specialMaterial",
        "socketFood", "socketMaterial",
        "vicinityFood", "vicinityMaterial",
        "irrigationFood", "otherFood", "otherMaterial"
    ];
    const total = Object.fromEntries(keys.map(key => [key, 0]));
    total.terrain = {};

    for (const row of rows) {
        const contribution = row.productionContribution;
        for (const key of keys) total[key] += Number(contribution?.[key]) || 0;
        for (const [terrainId, yields] of Object.entries(contribution?.terrain || {})) {
            if (!total.terrain[terrainId]) total.terrain[terrainId] = { food: 0, material: 0 };
            total.terrain[terrainId].food += Number(yields.food) || 0;
            total.terrain[terrainId].material += Number(yields.material) || 0;
        }
    }
    return total;
}

function percent(part, whole) {
    if (!(whole > 0)) return 0;
    return (part / whole) * 100;
}

function topTerrainText(terrain, resource, limit = 4) {
    return Object.entries(terrain || {})
        .map(([id, yields]) => [id, Number(yields?.[resource]) || 0])
        .filter(([, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id, value]) => `${id}:${value}`)
        .join(",");
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

function chooseAction(engine, {
    preferInvestigation = false,
    landSelection = "GROWTH"
} = {}) {
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
        if (landSelection === "GROWTH") {
            landOptions.sort((a, b) => scoreLandOption(b, state) - scoreLandOption(a, state));
        }
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
        sockets: countDiscoveredSockets(state),
        offeredLandIds: offering
            .map(card => definitionOf(card))
            .filter(definition => definition?.category === "LAND")
            .map(definition => String(definition.id || "UNKNOWN"))
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

    assert.equal(preview.production.grossFood, 5, "Stage1 HQ gross food baseline must remain 5");
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
    assert.equal(readMaxDefense(state) > 5, true, "FOREST Zone path must make pre-Trial defense growth possible");
    assert.equal(state.maxEmber > 20, true, "Stage1 Link must expand Ember capacity");
}

function runSeedTrace(seed, {
    landSelection = "GROWTH",
    printDiagnostics = true,
    requireMystic = true
} = {}) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        enemyObservationProjector: stage1EconomyObservationProjector
    });
    const trace = [];
    const settlements = [];
    const placementOrigins = new Map();
    const chosenLandCards = [];
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
            preferInvestigation: verse >= 8 && !investigationExecuted,
            landSelection
        });
        assert.ok(action, `seed ${seed} V${verse}: Offering must contain at least one actionable card`);

        const beforeAction = {
            food: engine.state.food,
            material: engine.state.wood ?? engine.state.material ?? 0,
            mystic: engine.state.mystic,
            ember: engine.state.ember
        };

        if (action.type === "LAND") {
            const placementGroupsBefore = listPlacementGroupIds(engine.state);
            const rotated = makeRotatedInstance(action.card, action.placement);
            const result = engine.placeLand(
                action.placement.clickedR,
                action.placement.clickedC,
                rotated,
                action.placement.rotation,
                { type: "OFFERING", index: action.index }
            );
            assert.equal(result?.success, true, `seed ${seed} V${verse}: selected LAND action must commit`);
            recordPlacementOrigin(engine.state, placementGroupsBefore, action, placementOrigins);
            chosenLandCards.push({
                id: String(action.definition?.id || "UNKNOWN"),
                cells: countShapeCells(action.placement.shape),
                multiAttribute: String(action.definition?.id || "").startsWith("CARD_MULTI_")
            });
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
            mystic: engine.state.mystic,
            ember: engine.state.ember
        };
        const settlementPreview = engine.previewTurnEndMaintenance();
        const settlementBreakdown = engine.state.getResourceBreakdown();
        const productionContribution = analyzeProductionContribution(engine.state, placementOrigins);
        const boundary = engine.nextTurn();
        settlements.push({
            verse,
            actionType: action.type,
            territoryTiles: engine.state.getTerritoryTileCount(),
            actionFoodDelta: beforeSettlement.food - beforeAction.food,
            actionMaterialDelta: beforeSettlement.material - beforeAction.material,
            actionMysticDelta: beforeSettlement.mystic - beforeAction.mystic,
            actionEmberDelta: beforeSettlement.ember - beforeAction.ember,
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
            materialBreakdown: settlementBreakdown?.wood || null,
            productionContribution
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

    if (printDiagnostics) {
        for (const row of trace) printTrace(row);
    }

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
    if (requireMystic) {
        assert.equal(verse15.mystic > 0, true, `seed ${seed}: Mystic must be live by Verse15`);
    }
    assert.equal(verse15.defense >= 5, true, `seed ${seed}: defense must not regress below HQ baseline`);
    assert.equal(
        investigationExecuted,
        true,
        `seed ${seed}: representative Stage1 path must execute at least one Investigation after unlock`
    );

    const totalGrossFood = settlements.reduce((sum, row) => sum + row.grossFood, 0);
    const totalFoodMaintenance = settlements.reduce((sum, row) => sum + row.foodCost, 0);
    const totalMaterialProduction = settlements.reduce((sum, row) => sum + row.materialProduction, 0);
    const totalActionFoodDelta = settlements.reduce((sum, row) => sum + row.actionFoodDelta, 0);
    const totalActionMaterialDelta = settlements.reduce((sum, row) => sum + row.actionMaterialDelta, 0);
    const totalActionMysticDelta = settlements.reduce((sum, row) => sum + row.actionMysticDelta, 0);
    const totalActionEmberDelta = settlements.reduce((sum, row) => sum + row.actionEmberDelta, 0);
    const firstSettlement = settlements[0];
    const lastSettlement = settlements[settlements.length - 1];
    const productionContribution = sumContributionRows(settlements);
    if (printDiagnostics) console.log(
        [
            `ECON seed=${seed}`,
            `settlements=${settlements.length}`,
            `grossFood=${totalGrossFood}`,
            `foodMaintenance=${totalFoodMaintenance}`,
            `foodNetSupply=${totalGrossFood - totalFoodMaintenance}`,
            `materialProduction=${totalMaterialProduction}`,
            `actionFoodDelta=${totalActionFoodDelta}`,
            `actionMaterialDelta=${totalActionMaterialDelta}`,
            `actionMysticDelta=${totalActionMysticDelta}`,
            `actionEmberDelta=${totalActionEmberDelta}`,
            `grossFoodRamp=${firstSettlement?.grossFood ?? 0}->${lastSettlement?.grossFood ?? 0}`,
            `materialRamp=${firstSettlement?.materialProduction ?? 0}->${lastSettlement?.materialProduction ?? 0}`,
            `tiles=${firstSettlement?.territoryTiles ?? 0}->${lastSettlement?.territoryTiles ?? 0}`
        ].join(" ")
    );

    if (printDiagnostics) console.log(
        [
            `PROD_CONTRIB seed=${seed}`,
            `food=HQ:${productionContribution.hqFood},cells:${productionContribution.baseCellFood},zone:${productionContribution.zoneFood},socket:${productionContribution.socketFood},vicinity:${productionContribution.vicinityFood},irrigation:${productionContribution.irrigationFood},blocks:${productionContribution.blockFood},other:${productionContribution.otherFood}`,
            `material=HQ:${productionContribution.hqMaterial},cells:${productionContribution.baseCellMaterial},zone:${productionContribution.zoneMaterial},socket:${productionContribution.socketMaterial},vicinity:${productionContribution.vicinityMaterial},blocks:${productionContribution.blockMaterial},other:${productionContribution.otherMaterial}`,
            `multiSubset=🌾${productionContribution.multiCellFood}/🧱${productionContribution.multiCellMaterial}`,
            `topFoodTerrain=${topTerrainText(productionContribution.terrain, "food")}`,
            `topMaterialTerrain=${topTerrainText(productionContribution.terrain, "material")}`
        ].join(" ")
    );

    return { trace, settlements, productionContribution, chosenLandCards, landSelection };
}


function formatRange(values) {
    const finite = values.filter(Number.isFinite);
    if (finite.length === 0) return "n/a";
    return `${Math.min(...finite)}..${Math.max(...finite)}`;
}



function printStage1CardYieldHorizon() {
    const engine = GameEngine.createGame({ runSeed: 20260924, firstRun: true });
    const horizons = Object.freeze({
        V1: 14,
        V4: 11,
        V8: 7,
        V12: 3
    });
    const cards = LAND_CARDS_MASTER
        .filter(card => card.category === "LAND" && Number(card.minStage || 1) <= 1)
        .map(card => {
            const preview = resolveCardProductionPreview(card);
            assert.notEqual(preview.status, "UNRESOLVED", `${card.id} production must resolve`);
            const yields = preview.totalYields || {};
            return {
                id: card.id,
                rarity: card.rarity,
                weight: resolveOfferingWeight(card, engine.state),
                cells: countShapeCells(card.shape),
                multiAttribute: String(card.id).startsWith("CARD_MULTI_"),
                food: Number(yields.food) || 0,
                material: Number(yields.wood) || 0,
                defense: Number(yields.defense) || 0,
                mystic: Number(yields.mystic) || 0
            };
        })
        .sort((a, b) => (
            (b.food + b.material) - (a.food + a.material)
            || b.cells - a.cells
            || a.id.localeCompare(b.id)
        ));

    console.log("=== Stage1 Card Yield Horizon / base recurring value only ===");
    for (const card of cards) {
        const horizonText = Object.entries(horizons)
            .map(([verse, turns]) => (
                `${verse}=🌾${card.food * turns}/🧱${card.material * turns}/🛡️${card.defense * turns}/✨${card.mystic * turns}`
            ))
            .join(",");
        console.log(
            [
                "CARD_HORIZON",
                card.id,
                `rarity=${card.rarity}`,
                `weight=${card.weight}`,
                `cells=${card.cells}`,
                `multi=${card.multiAttribute}`,
                `perVerse=🌾${card.food}/🧱${card.material}/🛡️${card.defense}/✨${card.mystic}`,
                horizonText
            ].join(" ")
        );
    }

    const plains1x1 = cards.find(card => card.id === "CARD_PLAINS_1X1");
    const plains1x2 = cards.find(card => card.id === "CARD_PLAINS_1X2");
    const multiPlainsForest = cards.find(card => card.id === "CARD_MULTI_PLAINS_FOREST_1X2");
    assert.equal(plains1x2.food, plains1x1.food * 2, "Plains 1x2 must carry two cells of recurring food");
    assert.equal(multiPlainsForest.food, 6, "Plains+Forest Multi must preserve canonical 4+2 food");
    assert.equal(multiPlainsForest.material, 2, "Plains+Forest Multi must preserve canonical Forest material");
}

function printLandPickSummary(runs) {
    const picks = runs.flatMap(run => run.chosenLandCards || []);
    const counts = new Map();
    for (const pick of picks) counts.set(pick.id, (counts.get(pick.id) || 0) + 1);
    const twoCell = picks.filter(pick => pick.cells >= 2);
    const multi = picks.filter(pick => pick.multiAttribute);

    console.log(
        [
            "LAND_PICK_SUMMARY",
            `landActions=${picks.length}`,
            `twoCell=${twoCell.length}(${percent(twoCell.length, picks.length).toFixed(1)}%)`,
            `multiAttribute=${multi.length}(${percent(multi.length, picks.length).toFixed(1)}%)`,
            `cards=${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => `${id}:${count}`).join(",")}`
        ].join(" ")
    );
}



function withStage1SingleCellOnly(callback) {
    const changed = LAND_CARDS_MASTER
        .filter(card => Number(card.minStage || 1) <= 1 && countShapeCells(card.shape) >= 2)
        .map(card => ({ card, minStage: card.minStage }));

    for (const entry of changed) {
        entry.card.minStage = 2;
    }

    try {
        return callback(changed.map(entry => entry.card.id));
    } finally {
        for (const entry of changed) {
            entry.card.minStage = entry.minStage;
        }
    }
}

function printSingleCellOnlyImpact(currentRuns, singleCellRuns, removedCardIds) {
    const current = strategySnapshot("CURRENT_FIRST_LEGAL", currentRuns);
    const single = strategySnapshot("STAGE1_1X1_ONLY", singleCellRuns);

    const avgDelta = (nextValues, baseValues) => average(nextValues) - average(baseValues);
    console.log(
        [
            "SINGLE_CELL_ONLY_IMPACT",
            `removed=${removedCardIds.join(",")}`,
            `currentV15=🌾${formatRange(current.food)}(avg${average(current.food).toFixed(1)})/🧱${formatRange(current.material)}(avg${average(current.material).toFixed(1)})/🛡️${formatRange(current.defense)}/tiles${formatRange(current.tiles)}`,
            `singleV15=🌾${formatRange(single.food)}(avg${average(single.food).toFixed(1)})/🧱${formatRange(single.material)}(avg${average(single.material).toFixed(1)})/🛡️${formatRange(single.defense)}/tiles${formatRange(single.tiles)}`,
            `deltaAvg=🌾${avgDelta(single.food, current.food).toFixed(1)}/🧱${avgDelta(single.material, current.material).toFixed(1)}/tiles${avgDelta(single.tiles, current.tiles).toFixed(1)}`,
            `singleTwoCell=${single.twoCell}/${single.landActions}`,
            `singleMulti=${single.multi}/${single.landActions}`
        ].join(" ")
    );

    assert.equal(single.twoCell, 0, "Stage1 1x1-only experiment must never place a 2+ cell LAND");
    assert.equal(single.multi, 0, "Stage1 1x1-only experiment must never place a Multi-Attribute LAND");
    assert.equal(
        singleCellRuns.every(run => run.trace.every(row => row.offeringCount > 0)),
        true,
        "Stage1 1x1-only experiment must not create an empty Offering"
    );
}


function withStage1RareNormal1x2(weightScale, callback) {
    const changed = LAND_CARDS_MASTER
        .filter(card => Number(card.minStage || 1) <= 1 && countShapeCells(card.shape) >= 2)
        .map(card => ({
            card,
            minStage: card.minStage,
            weight: card.weight
        }));

    for (const entry of changed) {
        if (String(entry.card.id || "").startsWith("CARD_MULTI_")) {
            entry.card.minStage = 2;
        } else {
            entry.card.weight = Number(entry.card.weight || 0) * weightScale;
        }
    }

    try {
        return callback({
            weightScale,
            normal1x2Ids: changed
                .filter(entry => !String(entry.card.id || "").startsWith("CARD_MULTI_"))
                .map(entry => entry.card.id),
            movedMultiIds: changed
                .filter(entry => String(entry.card.id || "").startsWith("CARD_MULTI_"))
                .map(entry => entry.card.id)
        });
    } finally {
        for (const entry of changed) {
            entry.card.minStage = entry.minStage;
            entry.card.weight = entry.weight;
        }
    }
}

function rareNormal1x2Snapshot(name, runs, normal1x2Ids) {
    const base = strategySnapshot(name, runs);
    const normalSet = new Set(normal1x2Ids);
    const offeredVerses = runs
        .flatMap(run => run.trace)
        .filter(row => (row.offeredLandIds || []).some(id => normalSet.has(id))).length;
    const totalVerses = runs.reduce((sum, run) => sum + run.trace.length, 0);
    const picks = runs
        .flatMap(run => run.chosenLandCards || [])
        .filter(pick => normalSet.has(pick.id));
    return {
        ...base,
        offeredVerses,
        totalVerses,
        normal1x2Picks: picks.length
    };
}

function printRareNormal1x2Impact(currentRuns, singleCellRuns, scenarios) {
    const current = strategySnapshot("CURRENT_FIRST_LEGAL", currentRuns);
    const single = strategySnapshot("STAGE1_1X1_ONLY", singleCellRuns);
    console.log(
        [
            "RARE_NORMAL_1X2_BASELINES",
            `current=🌾${average(current.food).toFixed(1)}/🧱${average(current.material).toFixed(1)}/tiles${average(current.tiles).toFixed(1)}`,
            `oneByOne=🌾${average(single.food).toFixed(1)}/🧱${average(single.material).toFixed(1)}/tiles${average(single.tiles).toFixed(1)}`
        ].join(" ")
    );

    for (const scenario of scenarios) {
        for (const [strategy, strategyRuns] of [
            ["FIRST_LEGAL", scenario.runsFirstLegal],
            ["GROWTH", scenario.runsGrowth]
        ]) {
            const snap = rareNormal1x2Snapshot(
                `NORMAL_1X2_WEIGHT_${Math.round(scenario.weightScale * 100)}PCT_${strategy}`,
                strategyRuns,
                scenario.normal1x2Ids
            );
            console.log(
                [
                    "RARE_NORMAL_1X2_IMPACT",
                    `scale=${scenario.weightScale}`,
                    `strategy=${strategy}`,
                    `normal=${scenario.normal1x2Ids.join(",")}`,
                    `movedMulti=${scenario.movedMultiIds.join(",")}`,
                    `V15🌾=${formatRange(snap.food)} avg=${average(snap.food).toFixed(1)}`,
                    `V15🧱=${formatRange(snap.material)} avg=${average(snap.material).toFixed(1)}`,
                    `V15🛡️=${formatRange(snap.defense)}`,
                    `tiles=${formatRange(snap.tiles)} avg=${average(snap.tiles).toFixed(1)}`,
                    `1x2OfferedVerses=${snap.offeredVerses}/${snap.totalVerses}(${percent(snap.offeredVerses, snap.totalVerses).toFixed(1)}%)`,
                    `1x2Picks=${snap.normal1x2Picks}/${snap.landActions}(${percent(snap.normal1x2Picks, snap.landActions).toFixed(1)}%)`,
                    `multiPicks=${snap.multi}`
                ].join(" ")
            );

            assert.equal(snap.multi, 0, "rare normal 1x2 experiment must move Multi-Attribute LAND to Stage2");
            assert.equal(
                strategyRuns.every(run => run.trace.every(row => row.offeringCount > 0)),
                true,
                "rare normal 1x2 experiment must not create empty Offerings"
            );
        }
    }
}

function average(values) {
    const finite = values.filter(Number.isFinite);
    return finite.length > 0
        ? finite.reduce((sum, value) => sum + value, 0) / finite.length
        : Number.NaN;
}

function strategySnapshot(name, runs) {
    const finals = runs.map(run => run.trace.find(row => row.verse === 15));
    const picks = runs.flatMap(run => run.chosenLandCards || []);
    const twoCell = picks.filter(pick => pick.cells >= 2).length;
    const multi = picks.filter(pick => pick.multiAttribute).length;
    return {
        name,
        food: finals.map(row => row.food),
        material: finals.map(row => row.material),
        defense: finals.map(row => row.defense),
        mystic: finals.map(row => row.mystic),
        ember: finals.map(row => row.ember),
        tiles: finals.map(row => row.territoryTiles),
        landActions: picks.length,
        twoCell,
        multi
    };
}

function printStrategySensitivitySummary(growthRuns, neutralRuns) {
    for (const snapshot of [
        strategySnapshot("GROWTH", growthRuns),
        strategySnapshot("FIRST_LEGAL", neutralRuns)
    ]) {
        console.log(
            [
                "STRATEGY_SUMMARY",
                `name=${snapshot.name}`,
                `V15🌾=${formatRange(snapshot.food)} avg=${average(snapshot.food).toFixed(1)}`,
                `V15🧱=${formatRange(snapshot.material)} avg=${average(snapshot.material).toFixed(1)}`,
                `V15🛡️=${formatRange(snapshot.defense)}`,
                `V15✨=${formatRange(snapshot.mystic)}`,
                `V15🔥=${formatRange(snapshot.ember)}`,
                `tiles=${formatRange(snapshot.tiles)} avg=${average(snapshot.tiles).toFixed(1)}`,
                `twoCell=${snapshot.twoCell}/${snapshot.landActions}(${percent(snapshot.twoCell, snapshot.landActions).toFixed(1)}%)`,
                `multi=${snapshot.multi}/${snapshot.landActions}(${percent(snapshot.multi, snapshot.landActions).toFixed(1)}%)`
            ].join(" ")
        );
    }
}

function printProductionContributionSummary(runs) {
    const combined = sumContributionRows(runs.flatMap(run => run.settlements));
    const foodComponents = {
        hq: combined.hqFood,
        cells: combined.baseCellFood,
        zone: combined.zoneFood,
        sockets: combined.socketFood,
        vicinity: combined.vicinityFood,
        irrigation: combined.irrigationFood,
        blocks: combined.blockFood + combined.specialFood,
        other: combined.otherFood
    };
    const materialComponents = {
        hq: combined.hqMaterial,
        cells: combined.baseCellMaterial,
        zone: combined.zoneMaterial,
        sockets: combined.socketMaterial,
        vicinity: combined.vicinityMaterial,
        blocks: combined.blockMaterial + combined.specialMaterial,
        other: combined.otherMaterial
    };

    const formatShares = (components, total) => Object.entries(components)
        .map(([key, value]) => `${key}=${value}(${percent(value, total).toFixed(1)}%)`)
        .join(",");

    console.log(
        [
            "PROD_CONTRIB_SUMMARY",
            `foodTotal=${combined.grossFood}`,
            `foodShares=${formatShares(foodComponents, combined.grossFood)}`,
            `materialTotal=${combined.totalMaterial}`,
            `materialShares=${formatShares(materialComponents, combined.totalMaterial)}`,
            `multiCellSubset=🌾${combined.multiCellFood}(${percent(combined.multiCellFood, combined.baseCellFood).toFixed(1)}%ofCells)/🧱${combined.multiCellMaterial}(${percent(combined.multiCellMaterial, combined.baseCellMaterial).toFixed(1)}%ofCells)`,
            `topFoodTerrain=${topTerrainText(combined.terrain, "food", 6)}`,
            `topMaterialTerrain=${topTerrainText(combined.terrain, "material", 6)}`
        ].join(" ")
    );

    assert.equal(
        Object.values(foodComponents).reduce((sum, value) => sum + value, 0),
        combined.grossFood,
        "food contribution audit must reconstruct cumulative gross production"
    );
    assert.equal(
        Object.values(materialComponents).reduce((sum, value) => sum + value, 0),
        combined.totalMaterial,
        "material contribution audit must reconstruct cumulative production"
    );
}

function printEconomySummary(runs) {
    const perRun = runs.map(run => {
        const first = run.trace.find(row => row.verse === 1);
        const final = run.trace.find(row => row.verse === 15);
        return {
            grossFood: run.settlements.reduce((sum, row) => sum + row.grossFood, 0),
            foodMaintenance: run.settlements.reduce((sum, row) => sum + row.foodCost, 0),
            foodNetSupply: run.settlements.reduce((sum, row) => sum + row.netFood, 0),
            actionFoodDelta: run.settlements.reduce((sum, row) => sum + row.actionFoodDelta, 0),
            materialProduction: run.settlements.reduce((sum, row) => sum + row.materialProduction, 0),
            actionMaterialDelta: run.settlements.reduce((sum, row) => sum + row.actionMaterialDelta, 0),
            startingFood: first?.food ?? Number.NaN,
            finalFood: final?.food ?? Number.NaN,
            startingMaterial: first?.material ?? Number.NaN,
            finalMaterial: final?.material ?? Number.NaN
        };
    });

    console.log(
        [
            "ECON_SUMMARY",
            `seeds=${perRun.length}`,
            `grossFood=${formatRange(perRun.map(row => row.grossFood))}`,
            `foodMaintenance=${formatRange(perRun.map(row => row.foodMaintenance))}`,
            `foodNetSupply=${formatRange(perRun.map(row => row.foodNetSupply))}`,
            `actionFoodDelta=${formatRange(perRun.map(row => row.actionFoodDelta))}`,
            `foodStock=${formatRange(perRun.map(row => row.startingFood))}->${formatRange(perRun.map(row => row.finalFood))}`,
            `materialProduction=${formatRange(perRun.map(row => row.materialProduction))}`,
            `actionMaterialDelta=${formatRange(perRun.map(row => row.actionMaterialDelta))}`,
            `materialStock=${formatRange(perRun.map(row => row.startingMaterial))}->${formatRange(perRun.map(row => row.finalMaterial))}`
        ].join(" ")
    );
}

console.log("=== Stage1 Offering / Economy / Board Playability Audit ===");

printStage1CardYieldHorizon();
testFoodSettlementUsesGrossProductionOnce();
testReserveDoesNotPoisonOfferingOrOverchargeEmber();
testStage1MultiAttributeEligibility();
testZoneAndLinkAreAimableOnFiveByFive();

const runs = TRACE_SEEDS.map(runSeedTrace);
const traces = runs.map(run => run.trace);
const finals = traces.map(trace => trace.find(row => row.verse === 15));
assert.equal(
    finals.some(row => row.defense > 5),
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

printEconomySummary(runs);
printProductionContributionSummary(runs);
printLandPickSummary(runs);

const neutralRuns = TRACE_SEEDS.map(seed => runSeedTrace(seed, {
    landSelection: "FIRST_LEGAL",
    printDiagnostics: false,
    requireMystic: false
}));
assert.equal(
    neutralRuns.every(run => run.trace.every(row => row.offeringCount > 0)),
    true,
    "neutral Stage1 strategy must not create an Offering dead-end"
);
assert.equal(
    neutralRuns.every(run => run.settlements.length === 14),
    true,
    "neutral Stage1 strategy must also reach Verse15 with fourteen settlements"
);
printStrategySensitivitySummary(runs, neutralRuns);

const singleCellExperiment = withStage1SingleCellOnly(removedCardIds => ({
    removedCardIds,
    runs: TRACE_SEEDS.map(seed => runSeedTrace(seed, {
        landSelection: "FIRST_LEGAL",
        printDiagnostics: false,
        requireMystic: false
    }))
}));
assert.equal(
    singleCellExperiment.runs.every(run => run.settlements.length === 14),
    true,
    "Stage1 1x1-only experiment must reach Verse15 on all audited seeds"
);
printSingleCellOnlyImpact(
    neutralRuns,
    singleCellExperiment.runs,
    singleCellExperiment.removedCardIds
);

const rareNormal1x2Scenarios = [0.25, 0.10, 0.05].map(weightScale =>
    withStage1RareNormal1x2(weightScale, config => ({
        ...config,
        runsFirstLegal: TRACE_SEEDS.map(seed => runSeedTrace(seed, {
            landSelection: "FIRST_LEGAL",
            printDiagnostics: false,
            requireMystic: false
        })),
        runsGrowth: TRACE_SEEDS.map(seed => runSeedTrace(seed, {
            landSelection: "GROWTH",
            printDiagnostics: false,
            requireMystic: false
        }))
    }))
);
assert.equal(
    rareNormal1x2Scenarios.every(scenario =>
        [...scenario.runsFirstLegal, ...scenario.runsGrowth]
            .every(run => run.settlements.length === 14)
    ),
    true,
    "all rare normal 1x2 scenarios must reach Verse15"
);
printRareNormal1x2Impact(
    neutralRuns,
    singleCellExperiment.runs,
    rareNormal1x2Scenarios
);

console.log(
    `PASS Stage1 playability audit: ${TRACE_SEEDS.length} seeds x Verse1-15 + reserve + food settlement + Multi-Attribute + Zone/Link`
);
