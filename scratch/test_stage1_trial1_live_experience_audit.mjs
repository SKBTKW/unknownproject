import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
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
        territoryTiles: Number(engine.state.getTerritoryTileCount?.() || 0)
    });
}

function playGrowthRun(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true
    });

    while (engine.state.turn < 15) {
        if (engine.state.hasPickedThisTurn !== true) {
            const option = chooseGrowthLand(engine);
            assert.ok(option, `seed ${seed} V${engine.state.turn}: a legal LAND action must exist`);

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

    return captureTrial1Sample(engine, seed);
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

const liveSamples = LIVE_AUDIT_SEEDS.map(playGrowthRun);
assert.equal(liveSamples.length, LIVE_AUDIT_SEEDS.length);
assert.equal(liveSamples.every(row => row.verse === 15), true);
assert.equal(liveSamples.every(row => row.food > 0), true, "all live Stage1 samples must reach Trial1 with food remaining");
assert.equal(liveSamples.every(row => row.material > 0), true, "all live Stage1 samples must reach Trial1 with material remaining");
assert.equal(liveSamples.every(row => row.defense > 0), true, "all live Stage1 samples must reach Trial1 with defense remaining");
assert.equal(liveSamples.every(row => row.ember > 0), true, "all live Stage1 samples must reach Trial1 alive");

for (const row of liveSamples) {
    console.log(
        [
            row.id,
            `V${row.verse}`,
            `🌾${row.food}`,
            `🧱${row.material}`,
            `🛡️${row.defense}/${row.maxDefense}`,
            `🔥${row.ember}`,
            `tiles=${row.territoryTiles}`
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
        `tiles=${formatRange(liveSamples.map(row => row.territoryTiles))}`
    ].join(" ")
);

const firstRunBurden = evaluateFirstRunBurdenAgainstSamples({
    samples: liveSamples,
    plans: STAGE1_TRIAL1_PROBE_PLANS
});
assert.equal(firstRunBurden.success, true);
assert.equal(
    firstRunBurden.rows.length,
    liveSamples.length * STAGE1_TRIAL1_PROBE_PLANS.length
);

for (const row of firstRunBurden.rows) {
    console.log(
        [
            "LIVE_BURDEN",
            row.sampleId,
            row.planId,
            `def=${row.requestedDefense}/${row.defenseAvailable}`,
            `dist=${row.distance}`,
            `share=${(row.burdenShare * 100).toFixed(1)}%`,
            `cost=🌾${row.foodCost}/🧱${row.materialCost}`,
            `remaining=🌾${row.foodRemaining}/🧱${row.materialRemaining}`
        ].join(" ")
    );
}

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
    firstRunBurden.rows.every(row => row.affordable === true),
    true,
    "relative FirstRun burden probe must remain internally affordable for the live samples"
);

console.log("✅ Stage1 Trial1 live experience audit PASS");
