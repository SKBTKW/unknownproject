import assert from "node:assert/strict";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";

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

function zoneCard() {
    return {
        id: "TEST_ZONE_CONVERSION_CARD",
        category: "DEVELOPMENT",
        rarity: "R",
        cyclePolicy: "UNIQUE",
        isUnique: true,
        nameKey: "TEST_ZONE",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_ZONE_CONVERSION",
            definitionId: "GARRISON_TEST",
            paymentMode: "DOMAIN_QUOTE"
        }]
    };
}

function makeDeck({ staleAtCommit = false } = {}) {
    const card = zoneCard();
    const state = makeState(card);
    let quoteReads = 0;
    let createCalls = 0;

    const board = {
        resolveZoneConversionGroupId(target) {
            return target?.groupId || null;
        },
        quoteZoneConversionCost() {
            quoteReads += 1;
            const wood = staleAtCommit && quoteReads >= 3 ? 9 : 6;
            return { status: "RESOLVED", resources: { wood, ember: 1 } };
        },
        validateZoneConversionCandidateAfterPayment() {
            return { valid: true, reasons: [] };
        },
        validateZoneConversionCandidate() {
            return { valid: true, reasons: [] };
        },
        createZoneConversion() {
            createCalls += 1;
            return { success: true, conversion: { definitionId: "GARRISON_TEST" } };
        }
    };

    const engine = { boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;

    return { card, state, deck, getCreateCalls: () => createCalls };
}

// Commit-time quote changed after preflight: payment and card consumption rollback.
{
    const { card, state, deck, getCreateCalls } = makeDeck({ staleAtCommit: true });
    const before = {
        food: state.food,
        wood: state.wood,
        material: state.material,
        mystic: state.mystic,
        ember: state.ember
    };

    const result = deck.playCommandCard(card, { groupId: "zone_a" }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "ZONE_CONVERSION_QUOTE_STALE");
    assert.deepEqual(
        {
            food: state.food,
            wood: state.wood,
            material: state.material,
            mystic: state.mystic,
            ember: state.ember
        },
        before,
        "stale Zone Conversion commit restores the exact pre-payment balances"
    );
    assert.equal(state.handOffering[0], card, "failed routed commit leaves the card in hand");
    assert.equal(state.hasPickedThisTurn, false);
    assert.deepEqual(state.consumedUniqueCards, []);
    assert.deepEqual(state.usedUniqueCards, []);
    assert.equal(getCreateCalls(), 0, "stale quote never reaches Board mutation");
}

// Stable quote: exact payment, then Board commit, then card/UNIQUE consumption.
{
    const { card, state, deck, getCreateCalls } = makeDeck({ staleAtCommit: false });
    const result = deck.playCommandCard(card, { groupId: "zone_a" }, 0, -1);

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

console.log("test_zone_conversion_card_atomicity: PASS");
