import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { LAND_SYSTEM_DATA } from "../game/src/data/land_system.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";
import {
    ECONOMY_COST_AUTHORING_ANCHORS_V1,
    classifyEconomyPveForAuthoring
} from "./economy_cost_authoring_anchors_v1.mjs";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";
import {
    evaluateFirstRunBurdenAgainstSamples,
    STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923,
    STAGE1_TRIAL1_PROBE_PLANS
} from "./trial_deployment_balance_probe.mjs";

const LIVE_AUDIT_SEEDS = Object.freeze([
    20260920,
    20260921,
    20260922,
    20260923,
    20260924,
    20260925,
    20260926,
    20260927
]);

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

    for (let rotation = 0; rotation < 4; rotation += 1) {
        const key = geometryKey(shape, anchor, attributeCells);
        if (!seen.has(key)) {
            seen.add(key);
            for (let clickedR = 0; clickedR < size; clickedR += 1) {
                for (let clickedC = 0; clickedC < size; clickedC += 1) {
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

function chooseGrowthLand(engine) {
    const options = [];
    for (let index = 0; index < (engine.state.handOffering || []).length; index += 1) {
        const card = engine.state.handOffering[index];
        const definition = definitionOf(card);
        if (definition?.category !== "LAND") continue;

        const placements = enumerateLegalPlacements(engine.state, card);
        if (!placements.length) continue;

        options.push({
            card,
            index,
            definition,
            placement: placements[0]
        });
    }

    options.sort((a, b) => scoreLandOption(b, engine.state) - scoreLandOption(a, engine.state));
    return options[0] || null;
}

function readDefense(engine) {
    if (typeof engine.getTrialAvailableDefense === "function") {
        return Math.max(0, Number(engine.getTrialAvailableDefense()) || 0);
    }
    return Math.max(
        0,
        Number(engine.state.currentDefense ?? engine.state.defense ?? 0) || 0
    );
}

function captureTrial1Sample(engine, seed) {
    const production = engine.productionCalculator?.calculateTotalProduction?.(engine.state) || null;
    const grossFoodPerVerse = Math.max(0, Number(production?.grossFood) || 0);
    const grossMaterialPerVerse = Math.max(
        0,
        Number(production?.totalMaterial ?? production?.totalWood) || 0
    );

    return Object.freeze({
        id: `LIVE_SEED_${seed}`,
        seed,
        verse: engine.state.turn,
        food: Math.max(0, Number(engine.state.food) || 0),
        material: Math.max(0, Number(engine.state.wood ?? engine.state.material ?? 0) || 0),
        defense: readDefense(engine),
        maxDefense: Math.max(
            0,
            Number(engine.state.maxDefense ?? engine.state.defense ?? 0) || 0
        ),
        ember: Math.max(0, Number(engine.state.ember) || 0),
        territoryTiles: Number(engine.state.getTerritoryTileCount?.() || 0),
        grossFoodPerVerse,
        grossMaterialPerVerse,
        foodMaintenancePerVerse: Math.max(0, Number(production?.foodCost) || 0),
        netFoodPerVerse: Number(production?.netFood) || 0
    });
}

function countE2HillsOnBoard(state) {
    let count = 0;
    for (const row of state?.grid || []) {
        for (const cell of row || []) {
            const terrainId = cell?.terrain?.terrainId || cell?.terrain?.id || null;
            if (cell?.placed && terrainId === "E2_HILL") count += 1;
        }
    }
    return count;
}

function captureStage1EconomyCheckpoint(engine, seed) {
    const production = engine.productionCalculator?.calculateTotalProduction?.(engine.state) || null;
    const h2Count = countE2HillsOnBoard(engine.state);
    const eligibleResourceCostCardIds = COMMAND_CARDS_MASTER
        .filter(card => Number(card?.minStage || 1) <= 1)
        .map(card => ({ card, cost: readFoodMaterialCost(card) }))
        .filter(entry => entry.cost.food > 0 || entry.cost.material > 0)
        .filter(({ card }) => engine.deckManager?.isCardEligible?.(
            card,
            1,
            h2Count,
            { ignoreCooldown: true, ignoreHold: true }
        ) === true)
        .map(({ card }) => card.id);

    return Object.freeze({
        seed,
        verse: engine.state.turn,
        grossFoodPerVerse: Math.max(0, Number(production?.grossFood) || 0),
        grossMaterialPerVerse: Math.max(
            0,
            Number(production?.totalMaterial ?? production?.totalWood) || 0
        ),
        eligibleResourceCostCardIds: Object.freeze(eligibleResourceCostCardIds)
    });
}

function playGrowthRun(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        // This audit owns the pre-existing Trial authoring anchor, not the new
        // Stage1 Board Investment envelope. Keep that baseline isolated here;
        // 담당A hands the live investment envelope to 담당B separately.
        cardRuntimeActivationProvider: () => ({ activeCardIds: [] })
    });
    const economyTimeline = [];

    while (engine.state.turn < 15) {
        economyTimeline.push(captureStage1EconomyCheckpoint(engine, seed));

        if (engine.state.hasPickedThisTurn !== true) {
            let option = chooseGrowthLand(engine);
            if (!option && engine.state.hasMulliganedThisTurn !== true && engine.state.ember > 1) {
                const mulligan = engine.mulligan();
                assert.equal(mulligan?.success, true);
                option = chooseGrowthLand(engine);
            }
            assert.ok(option, `seed ${seed} V${engine.state.turn}: a legal LAND action must exist after normal Mulligan fallback`);

            const card = makeRotatedInstance(option.card, option.placement);
            const placed = engine.placeLand(
                option.placement.clickedR,
                option.placement.clickedC,
                card,
                0,
                { type: "OFFERING", index: option.index }
            );
            assert.equal(
                placed?.success,
                true,
                `seed ${seed} V${engine.state.turn}: representative growth action must place successfully`
            );
        }

        const before = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, before + 1, `seed ${seed}: Verse must advance normally`);
        assert.ok(engine.state.ember > 0, `seed ${seed} V${engine.state.turn}: Ember must remain positive`);
    }

    economyTimeline.push(captureStage1EconomyCheckpoint(engine, seed));
    return Object.freeze({
        sample: captureTrial1Sample(engine, seed),
        economyTimeline: Object.freeze(economyTimeline)
    });
}

function range(values) {
    return {
        min: Math.min(...values),
        max: Math.max(...values)
    };
}

function formatRange(values) {
    const r = range(values);
    return r.min === r.max ? String(r.min) : `${r.min}..${r.max}`;
}

function summarizeLegacyDrift(liveSamples) {
    const legacyFood = range(STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923.map(row => row.food));
    const legacyMaterial = range(STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923.map(row => row.material));
    const legacyDefense = range(STAGE1_TRIAL1_AUDIT_ENVELOPE_20260923.map(row => row.defense));

    const liveFood = range(liveSamples.map(row => row.food));
    const liveMaterial = range(liveSamples.map(row => row.material));
    const liveDefense = range(liveSamples.map(row => row.defense));

    return {
        legacyFood,
        legacyMaterial,
        legacyDefense,
        liveFood,
        liveMaterial,
        liveDefense
    };
}

console.log("\n=== Stage1 Trial1 live experience audit ===");

const growthRuns = LIVE_AUDIT_SEEDS.map(playGrowthRun);
const liveSamples = growthRuns.map(run => run.sample);
const stage1EconomyTimeline = growthRuns.flatMap(run => run.economyTimeline);
assert.equal(liveSamples.length, LIVE_AUDIT_SEEDS.length);
assert.equal(
    stage1EconomyTimeline.length,
    LIVE_AUDIT_SEEDS.length * 15,
    "Stage1 economy curve must capture every Verse start from V1 through V15"
);
assert.equal(liveSamples.every(row => row.verse === 15), true);
assert.equal(liveSamples.every(row => row.food > 0), true, "all live Stage1 samples must reach Trial1 with food remaining");
assert.equal(liveSamples.every(row => row.material > 0), true, "all live Stage1 samples must reach Trial1 with material remaining");
assert.equal(liveSamples.every(row => row.defense > 0), true, "all live Stage1 samples must reach Trial1 with defense remaining");
assert.equal(liveSamples.every(row => row.ember > 0), true, "all live Stage1 samples must reach Trial1 alive");
assert.equal(
    liveSamples.every(row => row.grossFoodPerVerse > 0),
    true,
    "every live Stage1 sample must expose positive gross food production for PVE"
);
assert.equal(
    liveSamples.every(row => row.grossMaterialPerVerse > 0),
    true,
    "every live Stage1 sample must expose positive gross material production for PVE"
);

for (const row of liveSamples) {
    console.log(
        [
            row.id,
            `V${row.verse}`,
            `🌾${row.food}`,
            `🧱${row.material}`,
            `🛡️${row.defense}/${row.maxDefense}`,
            `🔥${row.ember}`,
            `tiles=${row.territoryTiles}`,
            `gross=🌾${row.grossFoodPerVerse}/🧱${row.grossMaterialPerVerse} perV`,
            `foodMaint=${row.foodMaintenancePerVerse}`,
            `net🌾=${row.netFoodPerVerse}`
        ].join(" ")
    );
}

console.log(
    [
        "LIVE_V15_RANGE",
        `🌾${formatRange(liveSamples.map(row => row.food))}`,
        `🧱${formatRange(liveSamples.map(row => row.material))}`,
        `🛡️${formatRange(liveSamples.map(row => row.defense))}`,
        `🔥${formatRange(liveSamples.map(row => row.ember))}`,
        `tiles=${formatRange(liveSamples.map(row => row.territoryTiles))}`,
        `gross🌾/V=${formatRange(liveSamples.map(row => row.grossFoodPerVerse))}`,
        `gross🧱/V=${formatRange(liveSamples.map(row => row.grossMaterialPerVerse))}`
    ].join(" ")
);

for (let verse = 1; verse <= 15; verse += 1) {
    const checkpoints = stage1EconomyTimeline.filter(row => row.verse === verse);
    assert.equal(
        checkpoints.length,
        LIVE_AUDIT_SEEDS.length,
        `V${verse} economy curve must contain one checkpoint per seed`
    );
    const food = rangeWithMedian(checkpoints.map(row => row.grossFoodPerVerse));
    const material = rangeWithMedian(checkpoints.map(row => row.grossMaterialPerVerse));
    console.log(
        [
            "STAGE1_PRODUCTION_CURVE",
            `V${verse}`,
            `gross🌾=${food.min}..${food.max} med=${food.median.toFixed(1)}`,
            `gross🧱=${material.min}..${material.max} med=${material.median.toFixed(1)}`
        ].join(" ")
    );
}

const authoringBlockVerseUnits = resolveCanonicalBlockVerseUnits();
const authoringCostGrid = Object.freeze({
    food: Object.freeze([5, 10, 15, 20, 30]),
    material: Object.freeze([5, 10, 15, 20, 30, 50, 70])
});

for (const verse of [4, 7, 10, 15]) {
    const checkpoints = stage1EconomyTimeline.filter(row => row.verse === verse);
    assert.equal(checkpoints.length, LIVE_AUDIT_SEEDS.length);

    for (const [resource, costs] of Object.entries(authoringCostGrid)) {
        const perVerseKey = resource === "food"
            ? "grossFoodPerVerse"
            : "grossMaterialPerVerse";
        const blockUnit = authoringBlockVerseUnits[resource];
        assert.ok(blockUnit > 0, `${resource} authoring BVE unit must remain positive`);

        for (const cost of costs) {
            const pve = rangeWithMedian(
                checkpoints.map(row => cost / row[perVerseKey])
            );
            console.log(
                [
                    "AUTHORING_COST_GRID",
                    `V${verse}`,
                    resource,
                    `cost=${cost}`,
                    `BVE=${(cost / blockUnit).toFixed(2)}`,
                    `PVE=${pve.min.toFixed(2)}..${pve.max.toFixed(2)} med=${pve.median.toFixed(2)}`
                ].join(" ")
            );
        }
    }
}

const stage1CostCardsForEligibility = COMMAND_CARDS_MASTER
    .filter(card => Number(card?.minStage || 1) <= 1)
    .map(card => ({ card, cost: readFoodMaterialCost(card) }))
    .filter(entry => entry.cost.food > 0 || entry.cost.material > 0);

const firstEligibleCardScaleRows = [];

for (const { card, cost } of stage1CostCardsForEligibility) {
    const firstEligible = growthRuns
        .map(run => run.economyTimeline.find(row =>
            row.eligibleResourceCostCardIds.includes(card.id)
        ) || null)
        .filter(Boolean);

    if (firstEligible.length === 0) {
        console.log(
            "STAGE1_CARD_FIRST_ELIGIBLE",
            card.id,
            "eligibleSeeds=0/8"
        );
        continue;
    }

    const verses = rangeWithMedian(firstEligible.map(row => row.verse));
    const recoveryPve = rangeWithMedian(firstEligible.map(row => {
        const foodPve = cost.food > 0 ? cost.food / row.grossFoodPerVerse : 0;
        const materialPve = cost.material > 0 ? cost.material / row.grossMaterialPerVerse : 0;
        return Math.max(foodPve, materialPve);
    }));

    const classification = classifyEconomyPveForAuthoring(recoveryPve.max);
    firstEligibleCardScaleRows.push(Object.freeze({
        id: card.id,
        eligibleSeeds: firstEligible.length,
        verses,
        recoveryPve,
        classification
    }));

    console.log(
        [
            "STAGE1_CARD_FIRST_ELIGIBLE",
            card.id,
            `eligibleSeeds=${firstEligible.length}/${LIVE_AUDIT_SEEDS.length}`,
            `firstV=${verses.min}..${verses.max} med=${verses.median.toFixed(1)}`,
            `cost=🌾${cost.food}/🧱${cost.material}`,
            `firstEligiblePVE=${recoveryPve.min.toFixed(2)}..${recoveryPve.max.toFixed(2)} med=${recoveryPve.median.toFixed(2)}`,
            `class=${classification}`
        ].join(" ")
    );
}

const firstRunBurden = evaluateFirstRunBurdenAgainstSamples({
    samples: liveSamples,
    plans: STAGE1_TRIAL1_PROBE_PLANS
});
assert.equal(firstRunBurden.success, true);
assert.equal(
    firstRunBurden.rows.length,
    liveSamples.length * STAGE1_TRIAL1_PROBE_PLANS.length
);

const liveSampleById = new Map(liveSamples.map(sample => [sample.id, sample]));
const pveRows = [];

for (const row of firstRunBurden.rows) {
    const sample = liveSampleById.get(row.sampleId);
    assert.ok(sample, `PVE sample must exist for ${row.sampleId}`);

    const foodPve = row.foodCost / sample.grossFoodPerVerse;
    const materialPve = row.materialCost / sample.grossMaterialPerVerse;
    const recoveryPve = Math.max(foodPve, materialPve);
    assert.equal(Number.isFinite(foodPve), true);
    assert.equal(Number.isFinite(materialPve), true);
    assert.equal(Number.isFinite(recoveryPve), true);

    pveRows.push(Object.freeze({
        ...row,
        grossFoodPerVerse: sample.grossFoodPerVerse,
        grossMaterialPerVerse: sample.grossMaterialPerVerse,
        foodPve,
        materialPve,
        recoveryPve
    }));

    console.log(
        [
            "LIVE_BURDEN",
            row.sampleId,
            row.planId,
            `def=${row.requestedDefense}/${row.defenseAvailable}`,
            `dist=${row.distance}`,
            `share=${(row.burdenShare * 100).toFixed(1)}%`,
            `cost=🌾${row.foodCost}/🧱${row.materialCost}`,
            `remaining=🌾${row.foodRemaining}/🧱${row.materialRemaining}`,
            `PVE=🌾${foodPve.toFixed(2)}V/🧱${materialPve.toFixed(2)}V`,
            `recovery=${recoveryPve.toFixed(2)}V`
        ].join(" ")
    );
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

for (const planId of ["HEAVY_DEFENSE_FAR", "ALL_DEFENSE_FAR"]) {
    const selected = pveRows.filter(row => row.planId === planId);
    const foodValues = selected.map(row => row.foodPve);
    const materialValues = selected.map(row => row.materialPve);
    const recoveryValues = selected.map(row => row.recoveryPve);

    console.log(
        [
            "PVE_SUMMARY",
            planId,
            `🌾=${Math.min(...foodValues).toFixed(2)}..${Math.max(...foodValues).toFixed(2)}V med=${median(foodValues).toFixed(2)}V`,
            `🧱=${Math.min(...materialValues).toFixed(2)}..${Math.max(...materialValues).toFixed(2)}V med=${median(materialValues).toFixed(2)}V`,
            `recovery=${Math.min(...recoveryValues).toFixed(2)}..${Math.max(...recoveryValues).toFixed(2)}V med=${median(recoveryValues).toFixed(2)}V`
        ].join(" ")
    );
}

function resolveCanonicalBlockVerseUnits() {
    const plains = LAND_SYSTEM_DATA?.terrains?.GL1_PLAINS || null;
    const mountain = LAND_SYSTEM_DATA?.terrains?.E3_MOUNTAIN || null;
    const food = Number(
        plains?.baseYieldsPerTile?.food
        ?? plains?.yields?.food
        ?? plains?.food
        ?? 0
    );
    const material = Number(
        mountain?.baseYieldsPerTile?.material
        ?? mountain?.baseYieldsPerTile?.wood
        ?? mountain?.yields?.material
        ?? mountain?.yields?.wood
        ?? mountain?.material
        ?? mountain?.wood
        ?? 0
    );
    return Object.freeze({
        food: Math.max(0, food),
        material: Math.max(0, material)
    });
}

function readFoodMaterialCost(definition) {
    const cost = definition?.cost || {};
    return Object.freeze({
        food: Math.max(0, Number(cost.food) || 0),
        material: Math.max(0, Number(cost.material ?? cost.wood) || 0)
    });
}

function rangeWithMedian(values) {
    const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
    assert.ok(sorted.length > 0);
    const mid = Math.floor(sorted.length / 2);
    const medianValue = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return Object.freeze({
        min: sorted[0],
        median: medianValue,
        max: sorted[sorted.length - 1]
    });
}

const blockVerseUnits = resolveCanonicalBlockVerseUnits();
assert.ok(blockVerseUnits.food > 0, "plains food BVE unit must remain positive");
assert.ok(blockVerseUnits.material > 0, "mountain material BVE unit must remain positive");
assert.equal(
    blockVerseUnits.food,
    ECONOMY_COST_AUTHORING_ANCHORS_V1.bve.foodPerBve,
    "food BVE authoring anchor must track canonical Plains output"
);
assert.equal(
    blockVerseUnits.material,
    ECONOMY_COST_AUTHORING_ANCHORS_V1.bve.materialPerBve,
    "material BVE authoring anchor must track canonical Mountain output"
);

console.log(
    "BVE_UNITS",
    `🌾1BVE=${blockVerseUnits.food}`,
    `🧱1BVE=${blockVerseUnits.material}`
);

const stage1ResourceCostCards = COMMAND_CARDS_MASTER
    .filter(card => Number(card?.minStage || 1) <= 1)
    .map(card => ({ card, cost: readFoodMaterialCost(card) }))
    .filter(entry => entry.cost.food > 0 || entry.cost.material > 0);

assert.ok(stage1ResourceCostCards.length > 0, "Stage1 must expose resource-cost cards for economy scale comparison");

const stage1CardScaleRows = [];
for (const { card, cost } of stage1ResourceCostCards) {
    const foodBve = cost.food / blockVerseUnits.food;
    const materialBve = cost.material / blockVerseUnits.material;
    const recoveryBve = Math.max(foodBve, materialBve);
    const pveAcrossLiveStage1 = liveSamples.map(sample => {
        const foodPve = cost.food > 0 ? cost.food / sample.grossFoodPerVerse : 0;
        const materialPve = cost.material > 0 ? cost.material / sample.grossMaterialPerVerse : 0;
        return Math.max(foodPve, materialPve);
    });
    const pve = rangeWithMedian(pveAcrossLiveStage1);

    stage1CardScaleRows.push(Object.freeze({
        id: card.id,
        cost,
        foodBve,
        materialBve,
        recoveryBve,
        pve
    }));

    console.log(
        [
            "STAGE1_CARD_SCALE",
            card.id,
            `cost=🌾${cost.food}/🧱${cost.material}`,
            `BVE=🌾${foodBve.toFixed(2)}/🧱${materialBve.toFixed(2)} recovery=${recoveryBve.toFixed(2)}`,
            `V15_PVE=${pve.min.toFixed(2)}..${pve.max.toFixed(2)} med=${pve.median.toFixed(2)}`
        ].join(" ")
    );
}

const maxStage1CardPve = Math.max(...stage1CardScaleRows.map(row => row.pve.max));
const maxStage1CardBve = Math.max(...stage1CardScaleRows.map(row => row.recoveryBve));
const heavyTrialPve = rangeWithMedian(
    pveRows
        .filter(row => row.planId === "HEAVY_DEFENSE_FAR")
        .map(row => row.recoveryPve)
);
const allTrialPve = rangeWithMedian(
    pveRows
        .filter(row => row.planId === "ALL_DEFENSE_FAR")
        .map(row => row.recoveryPve)
);

assert.ok(
    heavyTrialPve.min > maxStage1CardPve,
    "FirstRun Trial1 heavy deployment must remain categorically heavier than every current Stage1 food/material card cost"
);

const authoringAnchors = ECONOMY_COST_AUTHORING_ANCHORS_V1.pve;
assert.ok(
    maxStage1CardPve <= authoringAnchors.matureStage1CardReferenceMax,
    `current Stage1 Verse15 card max PVE ${maxStage1CardPve.toFixed(2)} exceeds mature-stage reference anchor ${authoringAnchors.matureStage1CardReferenceMax.toFixed(2)}`
);
assert.ok(
    heavyTrialPve.min >= authoringAnchors.firstRunTrial1Heavy.min
        && heavyTrialPve.max <= authoringAnchors.firstRunTrial1Heavy.max,
    `FirstRun Trial1 heavy PVE ${heavyTrialPve.min.toFixed(2)}..${heavyTrialPve.max.toFixed(2)} moved outside authoring anchor ${authoringAnchors.firstRunTrial1Heavy.min.toFixed(2)}..${authoringAnchors.firstRunTrial1Heavy.max.toFixed(2)}`
);
assert.ok(
    allTrialPve.min >= authoringAnchors.firstRunTrial1AllIn.min
        && allTrialPve.max <= authoringAnchors.firstRunTrial1AllIn.max,
    `FirstRun Trial1 all-in PVE ${allTrialPve.min.toFixed(2)}..${allTrialPve.max.toFixed(2)} moved outside authoring anchor ${authoringAnchors.firstRunTrial1AllIn.min.toFixed(2)}..${authoringAnchors.firstRunTrial1AllIn.max.toFixed(2)}`
);

const stage1ExplicitGeCosts = GLOBAL_EVENTS_MASTER
    .filter(event => Number(event?.minStage || 1) <= 1)
    .map(event => ({ event, cost: readFoodMaterialCost(event) }))
    .filter(entry => entry.cost.food > 0 || entry.cost.material > 0);

console.log(
    "AUTHORING_ANCHOR_STATUS",
    JSON.stringify({
        matureStage1CardReference: {
            maxObservedV15Pve: Number(maxStage1CardPve.toFixed(2)),
            anchorMax: authoringAnchors.matureStage1CardReferenceMax,
            classification: classifyEconomyPveForAuthoring(maxStage1CardPve)
        },
        liveFirstEligibleCards: {
            count: firstEligibleCardScaleRows.length,
            cards: firstEligibleCardScaleRows.map(row => ({
                id: row.id,
                eligibleSeeds: row.eligibleSeeds,
                firstVerseMin: row.verses.min,
                firstVerseMedian: Number(row.verses.median.toFixed(1)),
                firstVerseMax: row.verses.max,
                firstEligiblePveMin: Number(row.recoveryPve.min.toFixed(2)),
                firstEligiblePveMedian: Number(row.recoveryPve.median.toFixed(2)),
                firstEligiblePveMax: Number(row.recoveryPve.max.toFixed(2)),
                classification: row.classification
            }))
        },
        strategicOpen: authoringAnchors.strategicAuthoringSpace,
        heavyTrial: {
            observed: {
                min: Number(heavyTrialPve.min.toFixed(2)),
                max: Number(heavyTrialPve.max.toFixed(2))
            },
            anchor: authoringAnchors.firstRunTrial1Heavy
        },
        allInTrial: {
            observed: {
                min: Number(allTrialPve.min.toFixed(2)),
                max: Number(allTrialPve.max.toFixed(2))
            },
            anchor: authoringAnchors.firstRunTrial1AllIn
        }
    })
);

console.log(
    "ECONOMY_SCALE_GAP",
    JSON.stringify({
        blockVerseUnit: blockVerseUnits,
        stage1ResourceCostCardCount: stage1CardScaleRows.length,
        currentStage1CardMaxRecoveryBve: Number(maxStage1CardBve.toFixed(2)),
        currentStage1CardMaxV15Pve: Number(maxStage1CardPve.toFixed(2)),
        firstRunTrial1HeavyRecoveryPve: {
            min: Number(heavyTrialPve.min.toFixed(2)),
            median: Number(heavyTrialPve.median.toFixed(2)),
            max: Number(heavyTrialPve.max.toFixed(2))
        },
        firstRunTrial1AllRecoveryPve: {
            min: Number(allTrialPve.min.toFixed(2)),
            median: Number(allTrialPve.median.toFixed(2)),
            max: Number(allTrialPve.max.toFixed(2))
        },
        stage1GlobalEventsWithExplicitFoodMaterialCost: stage1ExplicitGeCosts.length,
        openAuthoringSpacePve: {
            aboveCurrentCards: Number(maxStage1CardPve.toFixed(2)),
            belowHeavyTrial: Number(heavyTrialPve.min.toFixed(2))
        }
    })
);

const drift = summarizeLegacyDrift(liveSamples);
console.log(
    "LEGACY_ENVELOPE_DRIFT",
    JSON.stringify(drift)
);

// The 2026-09-23 envelope remains a historical probe input only.
// This live audit intentionally does not assert equality with it: HQ balance,
// Offering mix and future Stage1 economy changes must be reflected by rerunning
// the actual game path rather than editing another hard-coded balance table.
assert.equal(
    pveRows.every(row => row.affordable === true),
    true,
    "relative FirstRun burden probe must remain internally affordable for the live samples"
);

console.log("✅ Stage1 Trial1 live experience audit PASS");
