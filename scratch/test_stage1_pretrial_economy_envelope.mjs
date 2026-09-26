import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    rotatePlacementClockwise
} from "../game/src/core/placement_geometry.js";
import { SPECIAL_BLOCK_TYPES } from "../game/src/core/special_block_domain.js";

const SEEDS = Object.freeze([
    20260920, 20260921, 20260922, 20260923,
    20260924, 20260925, 20260926, 20260927
]);

const INVESTMENT_IDS = Object.freeze([
    "CMD_LOGGING_CAMP",
    "CMD_GRANARY",
    "CMD_AGRICULTURAL_REFORM",
    "CMD_WETLAND_RECLAMATION"
]);

function definitionOf(card) { return card?.terrain || card || null; }
function countShapeCells(shape) {
    return (shape || []).reduce((sum, row) => sum + (row || []).filter(v => v === 1).length, 0);
}
function geometryKey(shape, anchor, attributeCells) {
    return JSON.stringify({ shape, anchor, attributes: (attributeCells || []).map(cell => ({
        r: cell.r, c: cell.c,
        terrainId: cell.terrainId || cell.id || cell.terrain?.terrainId || cell.terrain?.id || null
    })) });
}
function enumerateLegalPlacements(state, card) {
    const definition = definitionOf(card);
    let shape = resolvePlacementShape(card);
    let anchor = resolvePlacementAnchor(card, shape);
    let attributeCells = resolvePlacementAttributeCells(card);
    const seen = new Set(), placements = [];
    const size = state.grid.length;
    for (let rotation = 0; rotation < 4; rotation += 1) {
        const key = geometryKey(shape, anchor, attributeCells);
        if (!seen.has(key)) {
            seen.add(key);
            for (let clickedR = 0; clickedR < size; clickedR += 1) {
                for (let clickedC = 0; clickedC < size; clickedC += 1) {
                    const startR = clickedR - anchor.r, startC = clickedC - anchor.c;
                    if (state.canPlaceShape(startR, startC, shape, definition, attributeCells)?.can === true) {
                        placements.push({ clickedR, clickedC, shape, anchor, attributeCells });
                    }
                }
            }
        }
        const rotated = rotatePlacementClockwise(shape, anchor, attributeCells);
        shape = rotated.shape; anchor = rotated.anchor; attributeCells = rotated.attributeCells;
    }
    return placements;
}
function makeRotatedInstance(card, placement) {
    return { ...card, currentShape: placement.shape, currentAnchor: placement.anchor,
        ...(placement.attributeCells ? { currentCells: placement.attributeCells } : {}) };
}
function scoreLandOption(option, state) {
    const d = option.definition, id = String(d?.id || ""), y = d?.yields || {};
    let score = countShapeCells(option.placement.shape) * 100;
    score += (Number(y.food) || 0) * 8 + (Number(y.defense) || 0) * 7;
    score += (Number(y.wood ?? y.material) || 0) * 4 + (Number(y.mystic) || 0) * 2;
    if (id.includes("FOREST")) score += 30;
    if (id.includes("PLAINS")) score += state.food < 45 ? 45 : 20;
    if (id.includes("HILL")) score += 15;
    return score;
}
function chooseGrowthLand(engine) {
    const options = [];
    for (let index = 0; index < (engine.state.handOffering || []).length; index++) {
        const card = engine.state.handOffering[index], definition = definitionOf(card);
        if (definition?.category !== "LAND") continue;
        const placements = enumerateLegalPlacements(engine.state, card);
        if (placements.length) options.push({ card, index, definition, placement: placements[0] });
    }
    options.sort((a, b) => scoreLandOption(b, engine.state) - scoreLandOption(a, engine.state));
    return options[0] || null;
}
function material(state) { return Math.max(0, Number(state.wood ?? state.material ?? 0) || 0); }
function defense(engine) {
    return Math.max(0, Number(engine.getTrialAvailableDefense?.() ?? engine.state.currentDefense ?? engine.state.defense ?? 0) || 0);
}
function affordable(state, cost) {
    const materialCost = Number(cost?.wood ?? cost?.material ?? 0) || 0;
    return (Number(cost?.food) || 0) <= state.food
        && materialCost <= material(state)
        && (Number(cost?.mystic) || 0) <= state.mystic
        && (Number(cost?.ember) || 0) <= state.ember;
}
function countActiveInvestments(state) {
    let count = 0;
    for (const row of state.grid || []) for (const cell of row || []) {
        const id = cell?.specialBlock?.definitionId || cell?.specialBlock?.type;
        if (cell?.specialBlock?.state !== "DAMAGED" && [SPECIAL_BLOCK_TYPES.LOGGING_CAMP, SPECIAL_BLOCK_TYPES.GRANARY].includes(id)) count++;
    }
    for (const zone of Object.values(state.mergedBlocks || {})) {
        if (zone?.conversion?.state === "ACTIVE" && zone?.conversion?.definitionId === "AGRICULTURAL_REFORM") count++;
    }
    return count;
}
function findInvestmentAction(engine, firstEligible) {
    const stageNum = Number(engine.state.stage?.id || 1);
    const h2Count = engine.deckManager?._countE2HillsOnBoard?.() || 0;
    for (let index = 0; index < (engine.state.handOffering || []).length; index++) {
        const card = engine.state.handOffering[index];
        if (!INVESTMENT_IDS.includes(card?.id)) continue;
        const eligible = engine.deckManager.isCardEligible(card, stageNum, h2Count, {
            ignoreCooldown: true, ignoreHold: true, placeabilityCache: new WeakMap()
        }) === true;
        if (!eligible) continue;
        if (firstEligible[card.id] == null) firstEligible[card.id] = engine.state.turn;

        // Investment-variant Wetland Reclamation requires explicit player variant choice.
        // Record its real eligibility, but do not synthesize a choice in this envelope trace.
        if (card.id === "CMD_WETLAND_RECLAMATION") continue;

        const quote = engine.getCommandCardExecutionCost(card);
        if (quote?.success === false) continue;
        const cost = quote?.resources || card.cost || {};
        if (!affordable(engine.state, cost)) continue;
        let target = null;
        if (engine.commandCardRequiresTarget(card)) {
            const targets = engine.getCommandCardExecutionTargets(card);
            if (!Array.isArray(targets) || !targets.length) continue;
            target = targets[0];
        }
        return { card, index, target, cost };
    }
    return null;
}
function run(seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        firstRun: true,
        cardRuntimeActivationProvider: () => ({ activeCardIds: [...INVESTMENT_IDS] })
    });
    const spends = [], firstEligible = {};
    let totalSpend = 0;

    while (engine.state.turn < 15) {
        let acted = engine.state.hasPickedThisTurn === true;
        if (!acted) {
            const investment = findInvestmentAction(engine, firstEligible);
            if (investment) {
                const before = material(engine.state);
                const result = engine.playCommandCard(
                    investment.card,
                    { type: "OFFERING", index: investment.index },
                    investment.target
                );
                if (result?.success === true) {
                    const spent = Math.max(0, before - material(engine.state));
                    totalSpend += spent;
                    spends.push({ verse: engine.state.turn, cardId: investment.card.id, materialSpend: spent });
                    acted = true;
                }
            }
        }
        if (!acted) {
            let option = chooseGrowthLand(engine);
            if (!option && engine.state.hasMulliganedThisTurn !== true && engine.state.ember > 1) {
                const mulligan = engine.mulligan();
                assert.equal(mulligan?.success, true, `seed ${seed} V${engine.state.turn}: Mulligan fallback must succeed`);
                option = chooseGrowthLand(engine);
            }
            assert.ok(option, `seed ${seed} V${engine.state.turn}: normal Offering + one Mulligan must expose a legal LAND fallback`);
            const placed = engine.placeLand(option.placement.clickedR, option.placement.clickedC,
                makeRotatedInstance(option.card, option.placement), 0,
                { type: "OFFERING", index: option.index });
            assert.equal(placed?.success, true);
        }
        const before = engine.state.turn;
        engine.nextTurn();
        assert.equal(engine.state.turn, before + 1);
        assert.ok(engine.state.ember > 0, `seed ${seed}: Stage1 trace must survive to V15`);
    }

    const production = engine.productionCalculator.calculateTotalProduction(engine.state);
    return Object.freeze({
        seed,
        verse: engine.state.turn,
        food: Math.max(0, Number(engine.state.food) || 0),
        material: material(engine.state),
        defense: defense(engine),
        grossFoodPerVerse: Math.max(0, Number(production.grossFood) || 0),
        grossMaterialPerVerse: Math.max(0, Number(production.totalMaterial ?? production.totalWood) || 0),
        boardInvestmentSpend: totalSpend,
        activeInvestments: countActiveInvestments(engine.state),
        spends: Object.freeze(spends),
        firstEligible: Object.freeze({ ...firstEligible })
    });
}
function summary(values) {
    const a = [...values].filter(Number.isFinite).sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return { min:a[0]??null, median:a.length?(a.length%2?a[m]:(a[m-1]+a[m])/2):null, max:a.at(-1)??null };
}

console.log("\n=== Stage1 pre-Trial economy envelope (no Trial cost) ===");
const rows = SEEDS.map(run);
assert.equal(rows.every(row => row.verse === 15), true);
assert.ok(rows.some(row => row.boardInvestmentSpend > 0), "normal Offering traces must execute real paid Board investments");

for (const row of rows) console.log("STAGE1_PRETRIAL_ECONOMY_SNAPSHOT", JSON.stringify(row));
console.log("STAGE1_PRETRIAL_ECONOMY_ENVELOPE", JSON.stringify({
    seeds: rows.length,
    food: summary(rows.map(r=>r.food)),
    material: summary(rows.map(r=>r.material)),
    defense: summary(rows.map(r=>r.defense)),
    grossFoodPerVerse: summary(rows.map(r=>r.grossFoodPerVerse)),
    grossMaterialPerVerse: summary(rows.map(r=>r.grossMaterialPerVerse)),
    boardInvestmentSpend: summary(rows.map(r=>r.boardInvestmentSpend)),
    activeInvestments: summary(rows.map(r=>r.activeInvestments)),
    firstEligibleVerse: Object.fromEntries(INVESTMENT_IDS.map(id => [id, summary(rows.map(r=>r.firstEligible[id]).filter(Number.isFinite))]))
}));
console.log("✅ Stage1 pre-Trial economy envelope PASS");
