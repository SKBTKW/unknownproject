import assert from "node:assert/strict";

import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES
} from "../game/src/core/special_block_domain.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    resolveSpecialBlockProduction,
    SPECIAL_BLOCK_PRODUCTION_STATUS
} from "../game/src/core/special_block_production.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy } from "../game/src/systems/card_runtime_policy.js";

console.log("\nStage1 Logging Camp Domain Bridge v1");

function cell(r, c, terrain = null) {
    return {
        r, c,
        placed: Boolean(terrain),
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        terrain,
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

const forest = {
    id: "GL2_FOREST",
    terrainId: "GL2_FOREST",
    zoneCategory: "FOREST",
    gl: 2,
    e: 1,
    food: 2,
    wood: 2,
    material: 2,
    defense: 2,
    mystic: 0
};

const grid = [
    [cell(0, 0, forest), cell(0, 1, forest), cell(0, 2)],
    [cell(1, 0, forest), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)]
];

const loggingCard = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_LOGGING_CAMP");
assert.ok(loggingCard);
assert.deepEqual(loggingCard.cost, {});
assert.equal(loggingCard.reqForestNearby, undefined);
assert.deepEqual(loggingCard.effects, [{
    type: "DOMAIN_ACTION",
    action: "CREATE_SPECIAL_BLOCK",
    blockType: "LOGGING_CAMP",
    paymentMode: "DOMAIN_QUOTE",
    logActivation: true
}]);

// Product v1 resolves the Board-owned quote and SOURCE_SIZE production.
// Card stays declarative: it names LOGGING_CAMP and pays the exact Board quote.
{
    const state = {
        turn: 6,
        stage: { id: 1 },
        food: 50,
        wood: 50,
        material: 50,
        defense: 5,
        mystic: 0,
        ember: 10,
        grid,
        handOffering: [loggingCard],
        reserveSlots: [null],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        hasPickedThisTurn: false,
        addLog() {}
    };
    const boardDomainAdapter = new BoardDomainAdapter({ state });
    const legalBoardTargets = boardDomainAdapter.enumerateLegalSpecialBlockTargets(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        { verse: state.turn, cardId: loggingCard.id }
    );
    assert.ok(legalBoardTargets.length > 0, "forest cluster should be Board-legal");

    const engine = {
        state,
        boardDomainAdapter,
        cardRuntimeActivationProvider: () => ({ activeCardIds: [loggingCard.id] })
    };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    assert.equal(attachCardRuntimePolicy(deck).success, true);

    const quote = deck.quoteCardExecutionCost(loggingCard);
    assert.equal(quote.success, true);
    assert.deepEqual(quote.resources, { wood: 20 });
    assert.equal(quote.source, "DOMAIN_QUOTE");
    assert.equal(quote.quote?.status, SPECIAL_BLOCK_COST_STATUS.RESOLVED);

    const targets = deck.enumerateCardExecutionTargets(loggingCard);
    assert.ok(targets.length > 0);
    assert.equal(targets.every(target => target.cost?.wood === 20), true);
    assert.equal(
        deck.isCardEligible(loggingCard, 1, 0),
        true,
        "ID-scoped prototype activation may expose the resolved Logging Camp"
    );

    const target = targets.find(candidate => candidate.r === 0 && candidate.c === 0) || targets[0];
    const sourceSize = target.sourceClusterSize || 3;
    const beforeWood = state.wood;
    const result = deck.playCommandCard(loggingCard, { r: target.r, c: target.c }, 0, -1);
    assert.equal(result.success, true);
    assert.equal(state.wood, beforeWood - 20);
    assert.equal(state.material, state.wood);
    assert.equal(state.hasPickedThisTurn, true);

    const builtCell = state.grid[target.r][target.c];
    assert.equal(builtCell.specialBlock?.definitionId, SPECIAL_BLOCK_TYPES.LOGGING_CAMP);
    assert.deepEqual(builtCell.specialBlock?.paidCost, { wood: 20 });
    assert.equal(builtCell.specialBlock?.baseTerrainEffect?.glDelta, -1);
    assert.equal(builtCell.specialBlock?.sourceGroupReference?.initialSize, sourceSize);

    const production = resolveSpecialBlockProduction(
        state,
        builtCell,
        { r: target.r, c: target.c }
    );
    assert.equal(production.status, SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED);
    assert.equal(production.yields.wood, sourceSize);
    assert.equal(production.yields.food, 0);
    assert.equal(production.yields.defense, 0);
    assert.equal(production.yields.mystic, 0);

    assert.equal(
        deck.enumerateCardExecutionTargets(loggingCard)
            .some(candidate => candidate.r === target.r && candidate.c === target.c),
        false,
        "occupied Logging Camp cell must not remain an execution target"
    );
}

// The generic Special Block DOMAIN_QUOTE bridge becomes executable once Board supplies
// a resolved quote. Payment is atomic and the exact paid cost is forwarded to Board.
{
    const card = {
        id: "TEST_BOARD_QUOTED_SPECIAL_BLOCK",
        category: "COMMAND",
        nameKey: "TEST_BOARD_QUOTED_SPECIAL_BLOCK",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_SPECIAL_BLOCK",
            blockType: "TEST_BLOCK",
            paymentMode: "DOMAIN_QUOTE",
            logActivation: true
        }]
    };
    const state = {
        turn: 7,
        stage: { id: 1 },
        food: 20,
        wood: 10,
        material: 10,
        defense: 5,
        mystic: 2,
        ember: 3,
        grid: [[cell(0, 0, forest)]],
        handOffering: [card],
        reserveSlots: [null],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        hasPickedThisTurn: false,
        logs: [],
        addLog(message) { this.logs.push(message); }
    };

    let createContext = null;
    const board = {
        quoteSpecialBlockCost(type) {
            assert.equal(type, "TEST_BLOCK");
            return {
                status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
                resources: { wood: 6, ember: 1 }
            };
        },
        enumerateLegalSpecialBlockTargets() {
            return [{ r: 0, c: 0 }];
        },
        validateSpecialBlockTarget() {
            return { valid: true, reason: null };
        },
        validateSpecialBlockTargetAfterPayment(type, target, payment) {
            assert.equal(type, "TEST_BLOCK");
            assert.deepEqual(target, { r: 0, c: 0 });
            assert.deepEqual(payment, { wood: 6, ember: 1 });
            return { valid: true, reason: null };
        },
        createSpecialBlock(type, target, context) {
            assert.equal(type, "TEST_BLOCK");
            assert.deepEqual(target, { r: 0, c: 0 });
            createContext = { ...context, paidCost: { ...(context.paidCost || {}) } };
            return {
                success: true,
                entity: { id: "TEST_BLOCK", paidCost: { ...(context.paidCost || {}) } }
            };
        }
    };

    const engine = { state, boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    deck.cycleSystem = null;

    assert.deepEqual(deck.quoteCardExecutionCost(card), {
        success: true,
        resources: { wood: 6, ember: 1 },
        source: "DOMAIN_QUOTE",
        quote: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: 6, ember: 1 }
        }
    });

    assert.deepEqual(deck.enumerateCardExecutionTargets(card), [{
        r: 0,
        c: 0,
        cost: { wood: 6, ember: 1 }
    }]);

    const result = deck.playCommandCard(card, { r: 0, c: 0 }, 0, -1);
    assert.equal(result.success, true);
    assert.equal(state.wood, 4);
    assert.equal(state.material, 4);
    assert.equal(state.ember, 2);
    assert.equal(state.handOffering[0]?.isBlank, true);
    assert.equal(state.hasPickedThisTurn, true);
    assert.equal(createContext.paymentConfirmed, true);
    assert.deepEqual(createContext.paidCost, { wood: 6, ember: 1 });
}

// Stale commit quote must fail after DeckManager payment and trigger its rollback.
{
    const card = {
        id: "TEST_STALE_SPECIAL_BLOCK",
        category: "COMMAND",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_SPECIAL_BLOCK",
            blockType: "TEST_BLOCK",
            paymentMode: "DOMAIN_QUOTE"
        }]
    };
    const state = {
        turn: 8,
        food: 20,
        wood: 10,
        material: 10,
        mystic: 0,
        ember: 3,
        grid: [[cell(0, 0, forest)]],
        handOffering: [card],
        reserveSlots: [null],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        hasPickedThisTurn: false,
        addLog() {}
    };
    let quoteReads = 0;
    let creates = 0;
    const board = {
        quoteSpecialBlockCost() {
            quoteReads += 1;
            const wood = quoteReads >= 3 ? 7 : 6;
            return {
                status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
                resources: { wood, ember: 1 }
            };
        },
        enumerateLegalSpecialBlockTargets() {
            return [{ r: 0, c: 0 }];
        },
        validateSpecialBlockTargetAfterPayment() {
            return { valid: true };
        },
        validateSpecialBlockTarget() {
            return { valid: true };
        },
        createSpecialBlock() {
            creates += 1;
            return { success: true };
        }
    };
    const engine = { state, boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    deck.cycleSystem = null;

    const before = { wood: state.wood, material: state.material, ember: state.ember };
    const result = deck.playCommandCard(card, { r: 0, c: 0 }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "SPECIAL_BLOCK_QUOTE_STALE");
    assert.deepEqual(
        { wood: state.wood, material: state.material, ember: state.ember },
        before,
        "stale Special Block quote must rollback payment exactly"
    );
    assert.equal(state.handOffering[0], card);
    assert.equal(state.hasPickedThisTurn, false);
    assert.equal(creates, 0);
}

console.log("  canonical Logging Camp resolves Board-owned 🧱20 creation cost");
console.log("  SOURCE_SIZE uses the initial forest-cluster snapshot at 🧱+1 per source cell");
console.log("  resolved Board quote pays atomically and forwards paidCost");
console.log("  stale Special Block quote rolls payment back");
console.log("✅ Stage1 Logging Camp Domain Bridge v1 PASS");
