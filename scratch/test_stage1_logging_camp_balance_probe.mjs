import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { SPECIAL_BLOCK_TYPES } from "../game/src/core/special_block_domain.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";

const SEEDS = Object.freeze([
    20260920, 20260921, 20260922, 20260923,
    20260924, 20260925, 20260926, 20260927
]);
const COST_CANDIDATES = Object.freeze([15, 20, 30]);
const PER_SOURCE_MATERIAL_CANDIDATES = Object.freeze([1, 2]);

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

function captureOpportunity(engine, seed) {
    const production = engine.productionCalculator?.calculateTotalProduction?.(engine.state) || {};
    const grossMaterialPerVerse = Math.max(
        0,
        Number(production?.totalMaterial ?? production?.totalWood) || 0
    );
    const materialBalance = Math.max(
        0,
        Number(engine.state.wood ?? engine.state.material) || 0
    );
    const targets = engine.boardDomainAdapter?.enumerateLegalSpecialBlockTargets?.(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        { verse: engine.state.turn, cardId: "CMD_LOGGING_CAMP" }
    ) || [];
    const sourceSizes = targets
        .map(target => Number(target.sourceClusterSize))
        .filter(Number.isInteger)
        .filter(value => value > 0);

    return Object.freeze({
        seed,
        verse: engine.state.turn,
        targetCount: targets.length,
        sourceSizes: Object.freeze(sourceSizes),
        minSourceSize: sourceSizes.length ? Math.min(...sourceSizes) : null,
        maxSourceSize: sourceSizes.length ? Math.max(...sourceSizes) : null,
        materialBalance,
        grossMaterialPerVerse
    });
}

function playGrowthRun(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        cardRuntimeActivationProvider: () => ({ activeCardIds: [] })
    });
    const timeline = [];

    while (engine.state.turn < 15) {
        timeline.push(captureOpportunity(engine, seed));

        if (engine.state.hasPickedThisTurn !== true) {
            const option = chooseGrowthLand(engine);
            assert.ok(option, `seed ${seed} V${engine.state.turn}: legal LAND action required`);
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

        const before = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, before + 1, `seed ${seed}: Verse must advance`);
        assert.ok(engine.state.ember > 0, `seed ${seed}: Ember must stay positive`);
    }

    timeline.push(captureOpportunity(engine, seed));
    return Object.freeze({ seed, timeline: Object.freeze(timeline) });
}

function median(values) {
    const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

console.log("\n=== Stage1 Logging Camp SOURCE_SIZE / cost probe ===");

const runs = SEEDS.map(playGrowthRun);
const firstLegal = runs
    .map(run => run.timeline.find(row => row.targetCount > 0) || null)
    .filter(Boolean);

assert.ok(firstLegal.length > 0, "at least one seeded Stage1 trace must expose a legal Logging Camp target");

for (const row of firstLegal) {
    console.log(
        "LOGGING_CAMP_FIRST_LEGAL",
        `seed=${row.seed}`,
        `V${row.verse}`,
        `targets=${row.targetCount}`,
        `sourceSize=${row.minSourceSize}..${row.maxSourceSize}`,
        `material=${row.materialBalance}`,
        `grossMaterial/V=${row.grossMaterialPerVerse}`
    );
}

const firstVerses = firstLegal.map(row => row.verse);
const firstSizes = firstLegal.flatMap(row => row.sourceSizes);
console.log(
    "LOGGING_CAMP_FIRST_LEGAL_SUMMARY",
    JSON.stringify({
        eligibleSeeds: firstLegal.length,
        totalSeeds: SEEDS.length,
        verseMin: Math.min(...firstVerses),
        verseMedian: median(firstVerses),
        verseMax: Math.max(...firstVerses),
        sourceSizeMin: Math.min(...firstSizes),
        sourceSizeMedian: median(firstSizes),
        sourceSizeMax: Math.max(...firstSizes)
    })
);

for (const cost of COST_CANDIDATES) {
    const pve = firstLegal
        .filter(row => row.grossMaterialPerVerse > 0)
        .map(row => cost / row.grossMaterialPerVerse);

    console.log(
        "LOGGING_CAMP_COST_CANDIDATE",
        JSON.stringify({
            materialCost: cost,
            affordableSeedsAtFirstLegal: firstLegal.filter(row => row.materialBalance >= cost).length,
            eligibleSeeds: firstLegal.length,
            firstLegalPveMin: Math.min(...pve),
            firstLegalPveMedian: median(pve),
            firstLegalPveMax: Math.max(...pve)
        })
    );

    for (const perSourceMaterial of PER_SOURCE_MATERIAL_CANDIDATES) {
        const paybacks = firstLegal.flatMap(row => row.sourceSizes.map(sourceSize => (
            cost / (sourceSize * perSourceMaterial)
        )));
        console.log(
            "LOGGING_CAMP_PRODUCTION_CANDIDATE",
            JSON.stringify({
                materialCost: cost,
                perSourceMaterial,
                sourceSizeBasis: "INITIAL_SNAPSHOT",
                grossPaybackVerseMin: Math.min(...paybacks),
                grossPaybackVerseMedian: median(paybacks),
                grossPaybackVerseMax: Math.max(...paybacks)
            })
        );
    }
}

const v15 = runs
    .map(run => run.timeline.find(row => row.verse === 15 && row.targetCount > 0) || null)
    .filter(Boolean);
if (v15.length) {
    const v15Sizes = v15.flatMap(row => row.sourceSizes);
    console.log(
        "LOGGING_CAMP_V15_LEGAL_SUMMARY",
        JSON.stringify({
            eligibleSeeds: v15.length,
            targetCountMin: Math.min(...v15.map(row => row.targetCount)),
            targetCountMedian: median(v15.map(row => row.targetCount)),
            targetCountMax: Math.max(...v15.map(row => row.targetCount)),
            sourceSizeMin: Math.min(...v15Sizes),
            sourceSizeMedian: median(v15Sizes),
            sourceSizeMax: Math.max(...v15Sizes)
        })
    );
}

console.log("✅ Stage1 Logging Camp SOURCE_SIZE / cost probe PASS");
