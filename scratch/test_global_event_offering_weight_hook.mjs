import assert from "node:assert/strict";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { GlobalEventManager } from "../game/src/systems/global_event_system.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";
import { resolveOfferingWeight } from "../game/src/cards/offering_weight_policy.js";

const EVENT_ID = "EVENT_TEST_OFFERING_WEIGHT";
const eventDef = {
    id: EVENT_ID,
    category: "TEST",
    nameKey: "TEST",
    descKey: "TEST",
    duration: 3,
    conditions: [],
    effects: [{
        type: "OFFERING_WEIGHT_TAG_BOOST",
        tag: "TARGET",
        multiplier: 4
    }],
    endEffects: []
};

GLOBAL_EVENTS_MASTER.push(eventDef);
try {
    const boostedCard = {
        id: "CARD_BOOSTED",
        category: "COMMAND",
        tags: ["TARGET"],
        weight: 1,
        minStage: 1
    };
    const plainCard = {
        id: "CARD_PLAIN",
        category: "COMMAND",
        tags: ["PLAIN"],
        weight: 1,
        minStage: 1
    };

    assert.equal(resolveOfferingWeight(boostedCard, {}, null), 1);
    assert.equal(resolveOfferingWeight(boostedCard, {}, { tagMultipliers: { TARGET: 4 } }), 4);
    assert.equal(resolveOfferingWeight(plainCard, {}, { tagMultipliers: { TARGET: 4 } }), 1);

    const state = {
        turn: 5,
        stage: 1,
        handOffering: [],
        reserveSlots: [],
        activeGlobalEvents: [{ definitionId: EVENT_ID, remainingTurns: 2, runtimeState: {} }],
        eventCooldowns: {},
        temporaryWeightModifiers: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        countE2HillsOnBoard() { return 0; }
    };
    const engine = {
        runSeed: 1,
        gameplayRandom: {
            nextFloat: () => 0.6,
            nextInt: (min) => min,
            nextId: (prefix, scope) => `${prefix}_${scope}_TEST`
        }
    };
    const ge = new GlobalEventManager(state, engine);
    engine.globalEventManager = ge;
    state.globalEventManager = ge;

    const deck = new DeckManager(state, engine);
    deck.getLandCardMaster = () => [boostedCard, plainCard];
    deck.isCardEligible = () => true;

    const pickedWithEvent = deck.drawSingleCard();
    assert.equal(
        pickedWithEvent?.cardMasterId,
        "CARD_BOOSTED",
        "active GE tag boost must affect the actual Offering weighted draw"
    );

    state.activeGlobalEvents = [];
    const pickedWithoutEvent = deck.drawSingleCard();
    assert.equal(
        pickedWithoutEvent?.cardMasterId,
        "CARD_PLAIN",
        "without the GE boost the same RNG roll should follow base weights"
    );

    // Multipliers compose generically across active events; Card Core does not
    // need event IDs or GE-specific branching.
    const secondEventId = "EVENT_TEST_OFFERING_WEIGHT_2";
    GLOBAL_EVENTS_MASTER.push({
        id: secondEventId,
        category: "TEST",
        nameKey: "TEST2",
        descKey: "TEST2",
        duration: 2,
        conditions: [],
        effects: [{
            type: "OFFERING_WEIGHT_TAG_BOOST",
            tag: "TARGET",
            multiplier: 1.5
        }],
        endEffects: []
    });
    try {
        state.activeGlobalEvents = [
            { definitionId: EVENT_ID, remainingTurns: 2, runtimeState: {} },
            { definitionId: secondEventId, remainingTurns: 2, runtimeState: {} }
        ];
        const ctx = deck._resolveOfferingWeightContext();
        assert.equal(ctx.tagMultipliers.TARGET, 6);
        assert.equal(resolveOfferingWeight(boostedCard, state, ctx), 6);
    } finally {
        const idx = GLOBAL_EVENTS_MASTER.findIndex(def => def.id === secondEventId);
        if (idx >= 0) GLOBAL_EVENTS_MASTER.splice(idx, 1);
    }

    console.log("PASS global event offering weight hook");
} finally {
    const idx = GLOBAL_EVENTS_MASTER.findIndex(def => def.id === EVENT_ID);
    if (idx >= 0) GLOBAL_EVENTS_MASTER.splice(idx, 1);
}
