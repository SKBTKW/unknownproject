import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import {
    SPECIAL_BLOCK_TYPES,
    getSpecialBlockDefinition
} from "../game/src/core/special_block_domain.js";
import { SpecialBlockProductionResolver } from "../game/src/core/special_block_production.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";
import {
    evaluateFirstRunBurdenAgainstSamples,
    STAGE1_TRIAL1_PROBE_PLANS
} from "./trial_deployment_balance_probe.mjs";

const SEEDS = Object.freeze([
    20260920, 20260921, 20260922, 20260923,
    20260924, 20260925, 20260926, 20260927
]);

const CANDIDATES = Object.freeze([
    Object.freeze({ id: "C15_B1_R1", cost: 15, base: 1, relation: 1 }),
    Object.freeze({ id: "C20_B1_R1", cost: 20, base: 1, relation: 1 }),
    Object.freeze({ id: "C20_B2_R1", cost: 20, base: 2, relation: 1 }),
    Object.freeze({ id: "C20_B2_R2", cost: 20, base: 2, relation: 2 }),
    Object.freeze({ id: "C30_B2_R1", cost: 30, base: 2, relation: 1 })
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
        options.push({ card, index, definition, placement: placements[0] });
    }
    options.sort((a, b) => scoreLandOption(b, engine.state) - scoreLandOption(a, engine.state));
    return options[0] || null;
}

function readDefense(engine) {
    if (typeof engine.getTrialAvailableDefense === "function") {
        return Math.max(0, Number(engine.getTrialAvailableDefense()) || 0);
    }
    return Math.max(0, Number(engine.state.currentDefense ?? engine.state.defense ?? 0) || 0);
}

function createCandidateProductionResolver(candidate) {
    const canonical = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.LOGGING_CAMP);
    const resolved = {
        ...canonical,
        production: {
            ...canonical.production,
            status: "RESOLVED",
            baseYields: { wood: candidate.base },
            perRelationYields: { wood: candidate.relation }
        }
    };
    return new SpecialBlockProductionResolver({
        definitionResolver: id => (
            id === SPECIAL_BLOCK_TYPES.LOGGING_CAMP
                ? resolved
                : getSpecialBlockDefinition(id)
        )
    });
}

function listLoggingCamps(state) {
    const camps = [];
    for (let r = 0; r < (state?.grid?.length || 0); r++) {
        for (let c = 0; c < (state.grid[r]?.length || 0); c++) {
            const entity = state.grid[r][c]?.specialBlock;
            if ((entity?.definitionId || entity?.type) === SPECIAL_BLOCK_TYPES.LOGGING_CAMP) {
                camps.push({ r, c });
            }
        }
    }
    return camps;
}

function isAdjacentToCamp(target, camps) {
    const destination = target?.destination || target?.target || target;
    if (!Number.isInteger(destination?.r) || !Number.isInteger(destination?.c)) return false;
    return camps.some(camp => (
        Math.abs(camp.r - destination.r) + Math.abs(camp.c - destination.c) === 1
    ));
}

function spendMaterial(state, amount) {
    const before = Number(state.wood ?? state.material) || 0;
    if (before < amount) return false;
    const after = before - amount;
    state.wood = after;
    state.material = after;
    return true;
}

function rollbackMaterial(state, amount) {
    const restored = (Number(state.wood ?? state.material) || 0) + amount;
    state.wood = restored;
    state.material = restored;
}

function tryBuildCamp(engine, candidate, { requireAdjacentCamp = false } = {}) {
    const camps = listLoggingCamps(engine.state);
    let targets = engine.boardDomainAdapter?.enumerateLegalSpecialBlockTargets?.(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        { verse: engine.state.turn, cardId: "CMD_LOGGING_CAMP" }
    ) || [];

    if (requireAdjacentCamp) {
        targets = targets.filter(target => isAdjacentToCamp(target, camps));
    }
    if (!targets.length) return null;
    if (!spendMaterial(engine.state, candidate.cost)) return null;

    const selected = targets[0];
    const result = engine.boardDomainAdapter.createSpecialBlock(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        selected,
        { verse: engine.state.turn }
    );
    if (!result?.success) {
        rollbackMaterial(engine.state, candidate.cost);
        return null;
    }

    engine.state.hasPickedThisTurn = true;
    return Object.freeze({
        verse: engine.state.turn,
        cost: candidate.cost,
        target: selected,
        destination: selected.destination || result.target || null,
        sourceClusterSize: selected.sourceClusterSize ?? null
    });
}

function captureSample(engine, id) {
    const production = engine.productionCalculator?.calculateTotalProduction?.(engine.state) || {};
    return Object.freeze({
        id,
        verse: engine.state.turn,
        food: Math.max(0, Number(engine.state.food) || 0),
        material: Math.max(0, Number(engine.state.wood ?? engine.state.material) || 0),
        defense: readDefense(engine),
        grossFoodPerVerse: Math.max(0, Number(production.grossFood) || 0),
        grossMaterialPerVerse: Math.max(0, Number(production.totalMaterial ?? production.totalWood) || 0),
        campProductionPerVerse: Math.max(
            0,
            Number(production.specialBlockProduction?.yields?.wood) || 0
        ),
        campCount: listLoggingCamps(engine.state).length
    });
}

function heavyTrialRecoveryPve(sample) {
    const result = evaluateFirstRunBurdenAgainstSamples({
        samples: [sample],
        plans: STAGE1_TRIAL1_PROBE_PLANS.filter(plan => plan.id === "HEAVY_DEFENSE_FAR")
    });
    assert.equal(result.success, true);
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    return Math.max(
        row.foodCost / sample.grossFoodPerVerse,
        row.materialCost / sample.grossMaterialPerVerse
    );
}

function playRun(seed, candidate = null, mode = "BASELINE") {
    const engine = GameEngine.createGame({ runSeed: seed, firstRun: true });
    if (candidate) {
        engine.state.specialBlockProductionResolver = createCandidateProductionResolver(candidate);
    }

    const builds = [];
    let cumulativeCampProduction = 0;

    while (engine.state.turn < 15) {
        if (candidate && engine.state.hasPickedThisTurn !== true) {
            if (builds.length === 0) {
                const built = tryBuildCamp(engine, candidate);
                if (built) builds.push(built);
            } else if (mode === "PAIR" && builds.length === 1) {
                const built = tryBuildCamp(engine, candidate, { requireAdjacentCamp: true });
                if (built) builds.push(built);
            }
        }

        if (engine.state.hasPickedThisTurn !== true) {
            let option = chooseGrowthLand(engine);
            if (!option && engine.state.hasMulliganedThisTurn !== true && engine.state.ember > 1) {
                const mulligan = engine.mulligan();
                assert.equal(mulligan?.success, true, `seed ${seed} V${engine.state.turn}: Mulligan fallback must succeed`);
                option = chooseGrowthLand(engine);
            }
            assert.ok(option, `seed ${seed} V${engine.state.turn}: normal Offering + one Mulligan must expose a legal LAND fallback`);
            const card = makeRotatedInstance(option.card, option.placement);
            const placed = engine.placeLand(
                option.placement.clickedR,
                option.placement.clickedC,
                card,
                0,
                { type: "OFFERING", index: option.index }
            );
            assert.equal(placed?.success, true, `seed ${seed} V${engine.state.turn}: growth placement`);
        }

        const beforeProduction = engine.productionCalculator?.calculateTotalProduction?.(engine.state) || {};
        cumulativeCampProduction += Math.max(
            0,
            Number(beforeProduction.specialBlockProduction?.yields?.wood) || 0
        );

        const before = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, before + 1, `seed ${seed}: Verse must advance`);
        assert.ok(engine.state.ember > 0, `seed ${seed}: Ember must stay positive`);
    }

    const sample = captureSample(
        engine,
        `${mode}_${candidate?.id || "NONE"}_${seed}`
    );
    return Object.freeze({
        seed,
        mode,
        candidate,
        builds: Object.freeze(builds),
        cumulativeCampProduction,
        sample,
        heavyRecoveryPve: heavyTrialRecoveryPve(sample)
    });
}

function median(values) {
    const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarizeDelta(rows, baselines) {
    const baselineBySeed = new Map(baselines.map(row => [row.seed, row]));
    const materialDelta = [];
    const productionDelta = [];
    const pveDelta = [];
    for (const row of rows) {
        const baseline = baselineBySeed.get(row.seed);
        materialDelta.push(row.sample.material - baseline.sample.material);
        productionDelta.push(row.sample.grossMaterialPerVerse - baseline.sample.grossMaterialPerVerse);
        pveDelta.push(row.heavyRecoveryPve - baseline.heavyRecoveryPve);
    }
    return {
        materialDeltaMin: Math.min(...materialDelta),
        materialDeltaMedian: median(materialDelta),
        materialDeltaMax: Math.max(...materialDelta),
        grossMaterialDeltaMin: Math.min(...productionDelta),
        grossMaterialDeltaMedian: median(productionDelta),
        grossMaterialDeltaMax: Math.max(...productionDelta),
        heavyPveDeltaMin: Math.min(...pveDelta),
        heavyPveDeltaMedian: median(pveDelta),
        heavyPveDeltaMax: Math.max(...pveDelta)
    };
}

console.log("\n=== Stage1 Logging Camp v2 spend-path probe ===");

const baselines = SEEDS.map(seed => playRun(seed));
console.log(
    "LOGGING_CAMP_V2_BASELINE",
    JSON.stringify({
        v15MaterialMin: Math.min(...baselines.map(row => row.sample.material)),
        v15MaterialMedian: median(baselines.map(row => row.sample.material)),
        v15MaterialMax: Math.max(...baselines.map(row => row.sample.material)),
        grossMaterialMin: Math.min(...baselines.map(row => row.sample.grossMaterialPerVerse)),
        grossMaterialMedian: median(baselines.map(row => row.sample.grossMaterialPerVerse)),
        grossMaterialMax: Math.max(...baselines.map(row => row.sample.grossMaterialPerVerse)),
        heavyPveMin: Math.min(...baselines.map(row => row.heavyRecoveryPve)),
        heavyPveMedian: median(baselines.map(row => row.heavyRecoveryPve)),
        heavyPveMax: Math.max(...baselines.map(row => row.heavyRecoveryPve))
    })
);

for (const candidate of CANDIDATES) {
    for (const mode of ["SINGLE", "PAIR"]) {
        const rows = SEEDS.map(seed => playRun(seed, candidate, mode));
        const buildCounts = rows.map(row => row.builds.length);
        const firstBuildVerses = rows
            .map(row => row.builds[0]?.verse)
            .filter(Number.isFinite);
        const secondBuildVerses = rows
            .map(row => row.builds[1]?.verse)
            .filter(Number.isFinite);

        console.log(
            "LOGGING_CAMP_V2_CANDIDATE",
            JSON.stringify({
                candidate,
                mode,
                builtAtLeastOne: buildCounts.filter(value => value >= 1).length,
                builtPair: buildCounts.filter(value => value >= 2).length,
                firstBuildVerseMin: firstBuildVerses.length ? Math.min(...firstBuildVerses) : null,
                firstBuildVerseMedian: median(firstBuildVerses),
                firstBuildVerseMax: firstBuildVerses.length ? Math.max(...firstBuildVerses) : null,
                secondBuildVerseMin: secondBuildVerses.length ? Math.min(...secondBuildVerses) : null,
                secondBuildVerseMedian: median(secondBuildVerses),
                secondBuildVerseMax: secondBuildVerses.length ? Math.max(...secondBuildVerses) : null,
                cumulativeCampProductionMin: Math.min(...rows.map(row => row.cumulativeCampProduction)),
                cumulativeCampProductionMedian: median(rows.map(row => row.cumulativeCampProduction)),
                cumulativeCampProductionMax: Math.max(...rows.map(row => row.cumulativeCampProduction)),
                v15CampProductionMin: Math.min(...rows.map(row => row.sample.campProductionPerVerse)),
                v15CampProductionMedian: median(rows.map(row => row.sample.campProductionPerVerse)),
                v15CampProductionMax: Math.max(...rows.map(row => row.sample.campProductionPerVerse)),
                ...summarizeDelta(rows, baselines)
            })
        );
    }
}

console.log("✅ Stage1 Logging Camp v2 spend-path probe PASS");
