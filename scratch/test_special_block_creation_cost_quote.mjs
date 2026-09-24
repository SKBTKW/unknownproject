import assert from "node:assert/strict";

import {
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES,
    resolveSpecialBlockCreationCost
} from "../game/src/core/special_block_domain.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";

console.log("\nSpecial Block creation-cost quote boundary");

assert.deepEqual(
    resolveSpecialBlockCreationCost({ id: "UNRESOLVED" }),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null }
);
assert.deepEqual(
    resolveSpecialBlockCreationCost({
        id: "RESOLVED",
        creationCost: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: 6, ember: 1 }
        }
    }),
    {
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources: { wood: 6, ember: 1 }
    }
);
assert.deepEqual(
    resolveSpecialBlockCreationCost({
        id: "INVALID",
        creationCost: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: -1 }
        }
    }),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null }
);

const unresolvedService = new SpecialBlockService({ grid: [] });
assert.deepEqual(
    unresolvedService.quoteCost(SPECIAL_BLOCK_TYPES.LOGGING_CAMP),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null },
    "foundation must not invent Logging Camp balance values"
);

function makeState(card) {
    return {
        turn: 10,
        stage: { id: 1 },
        food: 20,
        wood: 20,
        material: 20,
        defense: 5,
        currentDefense: 5,
        mystic: 3,
        ember: 5,
        maxEmber: 20,
        handOffering: [card],
        reserveSlots: [null],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        hasPickedThisTurn: false,
        hasReservedThisTurn: false,
        hasMulliganedThisTurn: false,
        grid: [],
        mergedBlocks: {},
        addLog() {}
    };
}

function specialBlockCard() {
    return {
        id: "TEST_SPECIAL_BLOCK_CARD",
        category: "DEVELOPMENT",
        rarity: "R",
        cyclePolicy: "UNIQUE",
        isUnique: true,
        nameKey: "TEST_SPECIAL_BLOCK",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_SPECIAL_BLOCK",
            blockType: "LOGGING_CAMP",
            paymentMode: "DOMAIN_QUOTE"
        }]
    };
}

function makeDeck({ staleAtCommit = false, unresolved = false } = {}) {
    const card = specialBlockCard();
    const state = makeState(card);
    let quoteReads = 0;
    let createCalls = 0;

    const board = {
        quoteSpecialBlockCost() {
            quoteReads += 1;
            if (unresolved) return { status: "UNRESOLVED", resources: null };
            const wood = staleAtCommit && quoteReads >= 3 ? 9 : 6;
            return { status: "RESOLVED", resources: { wood, ember: 1 } };
        },
        validateSpecialBlockTarget() {
            return { valid: true };
        },
        validateSpecialBlockTargetAfterPayment(_type, _target, payment) {
            return {
                valid: Number(payment?.wood || 0) > 0,
                projectedPayment: { ...payment }
            };
        },
        enumerateLegalSpecialBlockTargets() {
            return [{ r: 1, c: 1 }];
        },
        createSpecialBlock() {
            createCalls += 1;
            return { success: true, entity: { definitionId: "LOGGING_CAMP" } };
        }
    };

    const engine = { boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;

    return { card, state, deck, getCreateCalls: () => createCalls };
}

// Unresolved Board cost fails closed before payment.
{
    const { card, state, deck, getCreateCalls } = makeDeck({ unresolved: true });
    const before = { wood: state.wood, material: state.material, ember: state.ember };
    const result = deck.playCommandCard(card, { r: 1, c: 1 }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "SPECIAL_BLOCK_COST_UNRESOLVED");
    assert.deepEqual(
        { wood: state.wood, material: state.material, ember: state.ember },
        before
    );
    assert.equal(state.handOffering[0], card);
    assert.equal(getCreateCalls(), 0);
}

// Commit-time quote changed after preflight: payment and card consumption roll back.
{
    const { card, state, deck, getCreateCalls } = makeDeck({ staleAtCommit: true });
    const before = {
        food: state.food,
        wood: state.wood,
        material: state.material,
        mystic: state.mystic,
        ember: state.ember
    };

    const result = deck.playCommandCard(card, { r: 1, c: 1 }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "SPECIAL_BLOCK_QUOTE_STALE");
    assert.deepEqual(
        {
            food: state.food,
            wood: state.wood,
            material: state.material,
            mystic: state.mystic,
            ember: state.ember
        },
        before,
        "stale Special Block quote restores the exact pre-payment balances"
    );
    assert.equal(state.handOffering[0], card);
    assert.equal(state.hasPickedThisTurn, false);
    assert.deepEqual(state.consumedUniqueCards, []);
    assert.deepEqual(state.usedUniqueCards, []);
    assert.equal(getCreateCalls(), 0);
}

// Stable quote: exact payment, then Board commit, then card/UNIQUE consumption.
{
    const { card, state, deck, getCreateCalls } = makeDeck();
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.deepEqual(targets, [{ r: 1, c: 1, cost: { wood: 6, ember: 1 } }]);

    const result = deck.playCommandCard(card, { r: 1, c: 1 }, 0, -1);
    assert.equal(result.success, true);
    assert.equal(state.wood, 14);
    assert.equal(state.material, 14);
    assert.equal(state.ember, 4);
    assert.equal(state.handOffering[0]?.isBlank, true);
    assert.equal(state.hasPickedThisTurn, true);
    assert.equal(state.consumedUniqueCards.includes(card.id), true);
    assert.equal(state.usedUniqueCards.includes(card.id), true);
    assert.equal(getCreateCalls(), 1);
}

console.log("  unresolved costs fail closed");
console.log("  stale quoted payment rolls back atomically");
console.log("  stable DOMAIN_QUOTE pays once then commits Board mutation");
console.log("✅ Special Block creation-cost quote boundary PASS");
