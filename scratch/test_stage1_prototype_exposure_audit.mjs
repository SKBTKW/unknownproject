import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";

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

const PROTOTYPE_IDS = Object.freeze([
    "CMD_EMERGENCY_LEVY",
    "CMD_VIGILANCE",
    "CMD_REKINDLE_EMBER"
]);

function definition(id) {
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate?.id === id);
    assert.ok(card, `${id} must exist in COMMAND_CARDS_MASTER`);
    return card;
}

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

function probeEligibility(engine, id) {
    const prior = engine.cardRuntimeActivationProvider;
    engine.cardRuntimeActivationProvider = () => ({ activeCardIds: [id] });
    try {
        const stageNum = typeof engine.state.stage === "object"
            ? Number(engine.state.stage?.id || 1)
            : Number(engine.state.stage || 1);
        const h2Count = engine.deckManager._countE2HillsOnBoard();
        return engine.deckManager.isCardEligible(definition(id), stageNum, h2Count) === true;
    } finally {
        engine.cardRuntimeActivationProvider = prior;
    }
}

function capture(engine, seed) {
    const notice = engine.state.getTrialNotice?.() || { active: false, remaining: null };
    const row = {
        seed,
        verse: engine.state.turn,
        food: Number(engine.state.food || 0),
        material: Number(engine.state.wood ?? engine.state.material ?? 0),
        mystic: Number(engine.state.mystic || 0),
        ember: Number(engine.state.ember || 0),
        defense: Number(engine.getTrialAvailableDefense?.() ?? engine.state.currentDefense ?? 0),
        trialNoticeActive: Boolean(notice.active),
        trialRemaining: Number.isFinite(notice.remaining) ? notice.remaining : null,
        eligibility: {}
    };

    for (const id of PROTOTYPE_IDS) {
        row.eligibility[id] = probeEligibility(engine, id);
    }

    return Object.freeze({
        ...row,
        eligibility: Object.freeze({ ...row.eligibility })
    });
}

function playGrowthTrace(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true
    });
    const rows = [];

    while (engine.state.turn < 15) {
        rows.push(capture(engine, seed));

        if (engine.state.hasPickedThisTurn !== true) {
            let option = chooseGrowthLand(engine);
            if (!option && engine.state.hasMulliganedThisTurn !== true && engine.state.ember > 1) {
                const mulligan = engine.mulligan();
                assert.equal(mulligan?.success, true);
                option = chooseGrowthLand(engine);
            }
            assert.ok(option, `seed ${seed} V${engine.state.turn}: legal LAND action required after normal Mulligan fallback`);

            const card = makeRotatedInstance(option.card, option.placement);
            const placed = engine.placeLand(
                option.placement.clickedR,
                option.placement.clickedC,
                card,
                0,
                { type: "OFFERING", index: option.index }
            );
            assert.equal(placed?.success, true, `seed ${seed} V${engine.state.turn}: LAND growth action must succeed`);
        }

        const before = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, before + 1);
        assert.ok(engine.state.ember > 0, `seed ${seed} V${engine.state.turn}: Ember must remain positive`);
    }

    return rows;
}

console.log("\n=== Stage1 prototype exposure audit ===");

const rows = SEEDS.flatMap(playGrowthTrace);
assert.equal(rows.length, SEEDS.length * 14);
assert.equal(
    rows.every(row => PROTOTYPE_IDS.every(id => typeof row.eligibility[id] === "boolean")),
    true
);

for (const id of PROTOTYPE_IDS) {
    const eligible = rows.filter(row => row.eligibility[id]);
    const preNotice = eligible.filter(row => !row.trialNoticeActive);
    const notice = eligible.filter(row => row.trialNoticeActive);
    const verses = [...new Set(eligible.map(row => row.verse))].sort((a, b) => a - b);

    console.log(
        "PROTOTYPE_EXPOSURE",
        JSON.stringify({
            id,
            eligibleSnapshots: eligible.length,
            totalSnapshots: rows.length,
            eligibleRate: Number((eligible.length / rows.length).toFixed(4)),
            preTrialNoticeSnapshots: preNotice.length,
            trialNoticeSnapshots: notice.length,
            earliestVerse: verses[0] ?? null,
            latestVerse: verses.at(-1) ?? null,
            eligibleVerses: verses
        })
    );
}

for (const row of rows.filter(row =>
    PROTOTYPE_IDS.some(id => row.eligibility[id])
)) {
    console.log(
        "PROTOTYPE_ELIGIBLE_ROW",
        JSON.stringify({
            seed: row.seed,
            verse: row.verse,
            food: row.food,
            material: row.material,
            mystic: row.mystic,
            ember: row.ember,
            defense: row.defense,
            trialNoticeActive: row.trialNoticeActive,
            trialRemaining: row.trialRemaining,
            eligible: PROTOTYPE_IDS.filter(id => row.eligibility[id])
        })
    );
}

const production = GameEngine.createGame({ runSeed: 2026092498, firstRun: true });
for (const id of PROTOTYPE_IDS) {
    assert.equal(
        production.deckManager.isCardEligible(definition(id), 1, 0),
        false,
        `production default must keep ${id} dormant`
    );
}

console.log("✅ Stage1 prototype exposure audit PASS");
