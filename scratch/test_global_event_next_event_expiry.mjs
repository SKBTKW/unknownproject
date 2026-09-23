import assert from "node:assert/strict";
import { GlobalEventManager } from "../game/src/systems/global_event_system.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const CHAIN_EVENT_ID = "EVENT_TEST_NEXT_EXPIRY_SOURCE";
const FOLLOW_EVENT_ID = "EVENT_TEST_NEXT_EXPIRY_FOLLOW";

const chainEvent = {
    id: CHAIN_EVENT_ID,
    category: "TEST",
    nameKey: "TEST_CHAIN",
    descKey: "TEST_CHAIN_DESC",
    duration: 1,
    baseWeight: 1,
    conditions: [],
    effects: [{
        type: "EVENT_WEIGHT_MODIFIER",
        targetTag: FOLLOW_EVENT_ID,
        multiplier: 3,
        expiry: { type: "NEXT_GLOBAL_EVENT" }
    }],
    endEffects: []
};
const followEvent = {
    id: FOLLOW_EVENT_ID,
    category: "TEST",
    nameKey: "TEST_FOLLOW",
    descKey: "TEST_FOLLOW_DESC",
    duration: 1,
    baseWeight: 1,
    conditions: [],
    effects: [],
    endEffects: []
};

GLOBAL_EVENTS_MASTER.push(chainEvent, followEvent);
try {
    const state = {
        turn: 10,
        lastGlobalEventTurn: 1,
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: [
            {
                targetTag: CHAIN_EVENT_ID,
                multiplier: 2,
                expiry: { type: "NEXT_GLOBAL_EVENT" },
                appliedTurn: 9
            },
            {
                targetTag: "LONG_LIVED",
                multiplier: 4,
                expiry: { type: "TURN_COUNT", value: 3 },
                appliedTurn: 9
            }
        ],
        scheduledGlobalEvents: [],
        addLog() {}
    };
    const engine = {
        runSeed: 1,
        gameplayRandom: {
            nextFloat: () => 0,
            nextInt: (min) => min
        }
    };
    const manager = new GlobalEventManager(state, engine);

    // Failed trigger must not consume waiting modifiers.
    assert.equal(manager.triggerEvent("EVENT_DOES_NOT_EXIST"), null);
    assert.equal(state.temporaryWeightModifiers.length, 2);

    // The modifier waiting for the next event is consumed by this successful
    // event, while TURN_COUNT survives and the current event's newly-created
    // NEXT_GLOBAL_EVENT modifier remains for the following event.
    const first = manager.triggerEvent(CHAIN_EVENT_ID);
    assert.equal(first?.definitionId, CHAIN_EVENT_ID);
    assert.equal(state.temporaryWeightModifiers.length, 2);
    assert.equal(
        state.temporaryWeightModifiers.some(mod => mod.targetTag === CHAIN_EVENT_ID),
        false
    );
    assert.equal(
        state.temporaryWeightModifiers.some(mod => mod.targetTag === "LONG_LIVED"),
        true
    );
    assert.equal(
        state.temporaryWeightModifiers.some(mod =>
            mod.targetTag === FOLLOW_EVENT_ID
            && mod.expiry?.type === "NEXT_GLOBAL_EVENT"
        ),
        true
    );

    // The newly-created modifier is consumed by the next successful GE.
    const second = manager.triggerEvent(FOLLOW_EVENT_ID);
    assert.equal(second?.definitionId, FOLLOW_EVENT_ID);
    assert.equal(
        state.temporaryWeightModifiers.some(mod => mod.expiry?.type === "NEXT_GLOBAL_EVENT"),
        false
    );
    assert.equal(
        state.temporaryWeightModifiers.some(mod => mod.targetTag === "LONG_LIVED"),
        true
    );

    // TURN_COUNT cleanup remains owned by tickTurn and is not affected by
    // NEXT_GLOBAL_EVENT consumption.
    manager.tickTurn();
    assert.equal(
        state.temporaryWeightModifiers.some(mod => mod.targetTag === "LONG_LIVED"),
        true
    );

    console.log("PASS global event next-event expiry");
} finally {
    for (const id of [CHAIN_EVENT_ID, FOLLOW_EVENT_ID]) {
        const index = GLOBAL_EVENTS_MASTER.findIndex(def => def.id === id);
        if (index >= 0) GLOBAL_EVENTS_MASTER.splice(index, 1);
    }
}
