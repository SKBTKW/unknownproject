import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/systems/deck_manager.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";
import {
    resolveFirstRunTrial1DeploymentBurdenShare
} from "../game/src/trial/config/first_run_trial1_relative_deployment_policy_v1.js";

const SEEDS = Object.freeze([
    20260920,
    20260921,
    20260922,
    20260923,
    20260924,
    20260925,
    20260926,
    20260927
]);

const SPEND_PRIORITY = Object.freeze([
    "CMD_EMERGENCY_LEVY",
    "CMD_VIGILANCE",
    "CMD_REKINDLE_EMBER"
]);

const SPEND_CARD_BY_ID = new Map(
    COMMAND_CARDS_MASTER
        .filter(card => Number(card.minStage || 1) === 1)
        .filter(card => SPEND_PRIORITY.includes(card.id))
        .map(card => [card.id, card])
);

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
        ...(placement.attributeCells ? { currentCells: placement.attributeCells } : {})
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

function currentMaterial(state) {
    return Math.max(0, Number(state.wood ?? state.material ?? 0) || 0);
}

function currentDefense(engine) {
    return Math.max(
        0,
        Number(
            engine.getTrialAvailableDefense?.()
            ?? engine.state.currentDefense
            ?? engine.state.defense
            ?? 0
        ) || 0
    );
}

function resolveExecutableSpend(engine, usedIds) {
    const stageNum = Number(engine.state.stage?.id || 1);
    const h2Count = engine.deckManager?._countE2HillsOnBoard?.() || 0;

    for (const id of SPEND_PRIORITY) {
        if (usedIds.has(id)) continue;
        const card = SPEND_CARD_BY_ID.get(id);
        if (!card) continue;

        const eligible = engine.deckManager?.isCardEligible?.(
            card,
            stageNum,
            h2Count,
            {
                ignoreCooldown: true,
                ignoreHold: true,
                placeabilityCache: new WeakMap()
            }
        ) === true;
        if (!eligible) continue;

        const quote = engine.getCommandCardExecutionCost(card);
        if (quote?.success === false) continue;
        const cost = quote?.resources || card.cost || {};
        const materialCost = Number(cost.material ?? cost.wood ?? 0) || 0;
        if ((Number(cost.food) || 0) > engine.state.food) continue;
        if (materialCost > currentMaterial(engine.state)) continue;
        if ((Number(cost.ember) || 0) > engine.state.ember) continue;
        if ((Number(cost.mystic) || 0) > engine.state.mystic) continue;

        let target = null;
        if (engine.commandCardRequiresTarget(card)) {
            const targets = engine.getCommandCardExecutionTargets(card);
            if (!Array.isArray(targets) || targets.length === 0) continue;
            target = targets[0];
        }

        return { card, target, quote };
    }

    return null;
}

function runStage1Path(seed, {
    allowSpend = true,
    activatePrototypeSpends = false
} = {}) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        ...(activatePrototypeSpends
            ? {
                cardRuntimeActivationProvider: () => ({
                    activeCardIds: [...SPEND_PRIORITY]
                })
            }
            : {})
    });
    const usedIds = new Set();
    const spends = [];

    while (engine.state.turn < 15) {
        let acted = engine.state.hasPickedThisTurn === true;

        if (!acted && allowSpend && engine.state.turn >= 8 && spends.length < 2) {
            const spend = resolveExecutableSpend(engine, usedIds);
            if (spend) {
                const before = {
                    food: engine.state.food,
                    material: currentMaterial(engine.state),
                    ember: engine.state.ember,
                    mystic: engine.state.mystic
                };
                const result = engine.playCommandCard(
                    spend.card,
                    { type: "OFFERING", index: -1 },
                    spend.target
                );
                if (result?.success === true) {
                    usedIds.add(spend.card.id);
                    spends.push({
                        verse: engine.state.turn,
                        cardId: spend.card.id,
                        quotedCost: { ...(spend.quote?.resources || spend.card.cost || {}) },
                        before,
                        after: {
                            food: engine.state.food,
                            material: currentMaterial(engine.state),
                            ember: engine.state.ember,
                            mystic: engine.state.mystic
                        }
                    });
                    acted = true;
                }
            }
        }

        if (!acted) {
            const option = chooseGrowthLand(engine);
            assert.ok(option, `seed ${seed} V${engine.state.turn}: legal LAND action required when no spend action executes`);
            const card = makeRotatedInstance(option.card, option.placement);
            const placed = engine.placeLand(
                option.placement.clickedR,
                option.placement.clickedC,
                card,
                0,
                { type: "OFFERING", index: option.index }
            );
            assert.equal(placed?.success, true);
        }

        const beforeVerse = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, beforeVerse + 1);
        assert.ok(engine.state.ember > 0, `seed ${seed} must remain alive through Stage1 spend-path audit`);
    }

    return Object.freeze({
        id: `${activatePrototypeSpends ? "PROTOTYPE_SPEND" : (allowSpend ? "PRODUCTION" : "BASELINE")}_SEED_${seed}`,
        seed,
        food: Math.max(0, Number(engine.state.food) || 0),
        material: currentMaterial(engine.state),
        defense: currentDefense(engine),
        ember: Math.max(0, Number(engine.state.ember) || 0),
        territoryTiles: Number(engine.state.getTerritoryTileCount?.() || 0),
        spends: Object.freeze(spends.map(entry => Object.freeze(entry)))
    });
}

function ratio(part, whole) {
    if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
    return part / whole;
}

function pct(value) {
    return Number.isFinite(value) ? (value * 100).toFixed(1) + "%" : "n/a";
}

function summarize(values) {
    const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!finite.length) return { min: null, median: null, max: null };
    const mid = Math.floor(finite.length / 2);
    const median = finite.length % 2 === 0
        ? (finite[mid - 1] + finite[mid]) / 2
        : finite[mid];
    return {
        min: finite[0],
        median,
        max: finite[finite.length - 1]
    };
}

function evaluateProductDeployment({ baseline, sample, planId, requestedDefense, distance }) {
    const defenseAvailable = Math.max(0, Number(sample.defense) || 0);
    const committedDefense = Math.min(
        defenseAvailable,
        requestedDefense === Number.MAX_SAFE_INTEGER
            ? defenseAvailable
            : Math.max(0, Number(requestedDefense) || 0)
    );
    const burdenShare = resolveFirstRunTrial1DeploymentBurdenShare({
        requestedDefense: committedDefense,
        defenseAvailable,
        distance
    });
    const foodCost = Math.ceil(sample.food * burdenShare);
    const materialCost = Math.ceil(sample.material * burdenShare);
    const foodAfter = sample.food - foodCost;
    const materialAfter = sample.material - materialCost;
    const preTrialFoodBurden = 1 - ratio(sample.food, baseline.food);
    const preTrialMaterialBurden = 1 - ratio(sample.material, baseline.material);
    const totalFoodBurden = 1 - ratio(foodAfter, baseline.food);
    const totalMaterialBurden = 1 - ratio(materialAfter, baseline.material);

    return Object.freeze({
        seed: sample.seed,
        planId,
        requestedDefense: committedDefense,
        defenseAvailable,
        distance,
        burdenShare,
        baselineFood: baseline.food,
        baselineMaterial: baseline.material,
        preTrialFood: sample.food,
        preTrialMaterial: sample.material,
        foodCost,
        materialCost,
        foodAfter,
        materialAfter,
        preTrialFoodBurden,
        preTrialMaterialBurden,
        totalFoodBurden,
        totalMaterialBurden
    });
}

console.log("\n=== Stage1 executable spend-path + product Trial1 burden audit ===");

const baselines = new Map(
    SEEDS.map(seed => [seed, runStage1Path(seed, { allowSpend: false })])
);
const productionSamples = SEEDS.map(seed =>
    runStage1Path(seed, {
        allowSpend: true,
        activatePrototypeSpends: false
    })
);
const prototypeSamples = SEEDS.map(seed =>
    runStage1Path(seed, {
        allowSpend: true,
        activatePrototypeSpends: true
    })
);

const productionSpendCount = productionSamples.reduce(
    (sum, sample) => sum + sample.spends.length,
    0
);
const prototypeSpendCount = prototypeSamples.reduce(
    (sum, sample) => sum + sample.spends.length,
    0
);

assert.equal(
    productionSpendCount,
    0,
    "production-default Stage1 must keep cost-bearing non-LAND prototype cards dormant"
);
assert.ok(
    prototypeSpendCount > 0,
    "ID-scoped prototype activation must expose at least one executable pre-Trial spend path"
);

function evaluateSampleSet(label, samples) {
    const rows = [];
    for (const sample of samples) {
        const baseline = baselines.get(sample.seed);
        console.log(
            [
                label,
                sample.id,
                `baseline=🌾${baseline.food}/🧱${baseline.material}/🛡️${baseline.defense}`,
                `preTrial=🌾${sample.food}/🧱${sample.material}/🛡️${sample.defense}`,
                `🔥${sample.ember}`,
                `tiles=${sample.territoryTiles}`,
                `spends=${sample.spends.map(entry => `${entry.cardId}@V${entry.verse}`).join(",") || "NONE"}`
            ].join(" ")
        );

        for (const plan of plans) {
            const row = evaluateProductDeployment({
                baseline,
                sample,
                planId: plan.id,
                requestedDefense: plan.requestedDefense,
                distance: plan.distance
            });
            rows.push(row);
            console.log(
                [
                    "PRODUCT_BURDEN",
                    label,
                    `seed=${row.seed}`,
                    row.planId,
                    `def=${row.requestedDefense}/${row.defenseAvailable}`,
                    `deployment=${pct(row.burdenShare)}`,
                    `preTrial=🌾${pct(row.preTrialFoodBurden)}/🧱${pct(row.preTrialMaterialBurden)}`,
                    `cost=🌾${row.foodCost}/🧱${row.materialCost}`,
                    `final=🌾${row.foodAfter}/🧱${row.materialAfter}`,
                    `total=🌾${pct(row.totalFoodBurden)}/🧱${pct(row.totalMaterialBurden)}`
                ].join(" ")
            );
        }
    }
    return rows;
}

const plans = Object.freeze([
    Object.freeze({ id: "HEAVY_DEFENSE_FAR", requestedDefense: 24, distance: 4 }),
    Object.freeze({ id: "ALL_DEFENSE_FAR", requestedDefense: Number.MAX_SAFE_INTEGER, distance: 4 })
]);

const productionRows = evaluateSampleSet("PRODUCTION", productionSamples);
const prototypeRows = evaluateSampleSet("PROTOTYPE", prototypeSamples);

for (const rows of [productionRows, prototypeRows]) {
    assert.equal(
        rows.every(row =>
            row.foodCost <= row.preTrialFood
            && row.materialCost <= row.preTrialMaterial
            && row.foodAfter >= 0
            && row.materialAfter >= 0
        ),
        true,
        "product relative deployment cost must remain affordable against the live pre-Trial balance"
    );
}

const productionFull = productionRows.filter(row => row.planId === "ALL_DEFENSE_FAR");
assert.equal(
    productionFull.every(row => Number(row.burdenShare.toFixed(2)) === 0.80),
    true,
    "full-defense far deployment must remain the 80% product cap"
);
assert.equal(
    productionFull.every(row =>
        Math.abs(row.totalFoodBurden - row.burdenShare) < 0.01
        && Math.abs(row.totalMaterialBurden - row.burdenShare) < 0.01
    ),
    true,
    "with no production pre-Trial command sinks, total resource burden should equal the deployment burden"
);

function printSummary(label, rows) {
    for (const plan of plans) {
        const selected = rows.filter(row => row.planId === plan.id);
        const food = summarize(selected.map(row => row.totalFoodBurden));
        const material = summarize(selected.map(row => row.totalMaterialBurden));
        console.log(
            [
                "TOTAL_BURDEN_SUMMARY",
                label,
                plan.id,
                `food=${pct(food.min)}..${pct(food.max)} med=${pct(food.median)}`,
                `material=${pct(material.min)}..${pct(material.max)} med=${pct(material.median)}`,
                `over80=${selected.filter(row => row.totalFoodBurden > 0.80 || row.totalMaterialBurden > 0.80).length}/${selected.length}`
            ].join(" ")
        );
    }
}

printSummary("PRODUCTION", productionRows);
printSummary("PROTOTYPE", prototypeRows);

console.log(
    "EXEC_SPEND_RESULT",
    JSON.stringify({
        productionSpendCount,
        prototypeSpendCount,
        productPolicy: "FIRST_RUN_TRIAL1_RELATIVE_V1",
        productionConclusion: "no live pre-Trial command sink yet; current total burden equals deployment burden",
        prototypeConclusion: "future live sinks must trigger a deployment-burden retune instead of stacking blindly"
    })
);

console.log("✅ Stage1 executable spend-path + product Trial1 burden audit PASS");
