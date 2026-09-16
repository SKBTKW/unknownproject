import { GlobalEventManager, GLOBAL_EVENT_TIMINGS } from "../game/src/systems/global_event_system.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createState(turn = 6) {
    return {
        turn,
        ember: 20,
        maxEmber: 20,
        food: 50,
        wood: 30,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 0,
        grid: [],
        handOffering: [],
        reserveSlots: [],
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: [],
        lastGlobalEventTurn: 0,
        addLog() {}
    };
}

const state = createState(6);
const manager = new GlobalEventManager(state, null);
assert(Array.isArray(state.scheduledGlobalEvents), "manager must initialize scheduledGlobalEvents");

const scheduled = manager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 7);
assert(scheduled.success === true, "formal GE must be schedulable");
assert(scheduled.alreadyScheduled === false, "first reservation must not be marked duplicate");
assert(state.scheduledGlobalEvents.length === 1, "scheduled GE must be stored exactly once");
assert(state.scheduledGlobalEvents[0].eventId === "EVENT_DEMIHUMAN_TRACES", "scheduled GE id must be retained");
assert(state.scheduledGlobalEvents[0].verse === 7, "scheduled Verse must be retained");

const duplicate = manager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 7);
assert(duplicate.success === true && duplicate.alreadyScheduled === true, "same GE/Verse reservation must be idempotent");
assert(state.scheduledGlobalEvents.length === 1, "duplicate reservation must not duplicate queue state");

assert(manager.scheduleEvent("EVENT_DOES_NOT_EXIST", 7).reason === "GLOBAL_EVENT_NOT_FOUND", "unknown GE must be rejected");
assert(manager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 5).reason === "GLOBAL_EVENT_SCHEDULE_VERSE_PASSED", "past Verse must be rejected");

let starts = 0;
let startTurn = null;
manager.subscribe(note => {
    if (note?.timing === GLOBAL_EVENT_TIMINGS.START && note?.eventId === "EVENT_DEMIHUMAN_TRACES") {
        starts++;
        startTurn = note.turn;
    }
});

manager.director.shouldTriggerEvent = () => false;
const beforeDue = manager.onTurnStart();
assert(beforeDue === null, "scheduled GE must not fire before its Verse");
assert(starts === 0, "no lifecycle START may fire before scheduled Verse");

state.turn = 7;
manager.director.shouldTriggerEvent = () => true;
const onDue = manager.onTurnStart();
assert(onDue?.definitionId === "EVENT_DEMIHUMAN_TRACES", "scheduled GE must fire on scheduled Verse");
assert(starts === 1 && startTurn === 7, "scheduled GE must emit exactly one START lifecycle at the due Verse");
assert(state.scheduledGlobalEvents.length === 0, "fired reservation must be consumed");
assert(state.lastGlobalEventTurn === 7, "scheduled GE must update ordinary GE timing state");

manager.director.shouldTriggerEvent = () => false;
assert(manager.onTurnStart() === null, "consumed reservation must not retrigger");
assert(starts === 1, "consumed reservation must emit START only once");

const delayedState = createState(7);
const delayedManager = new GlobalEventManager(delayedState, null);
delayedManager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 7);
delayedState.activeGlobalEvents.push({
    definitionId: "EVENT_DUMMY_PENDING",
    remainingTurns: 1,
    runtimeState: {
        choice: { eventId: "CHOICE_DUMMY", status: "PENDING" }
    }
});
assert(delayedManager.onTurnStart() === null, "pending choice must defer scheduled GE");
assert(delayedState.scheduledGlobalEvents.length === 1, "deferred scheduled GE must remain queued");
delayedState.activeGlobalEvents = [];
delayedState.turn = 8;
delayedManager.director.shouldTriggerEvent = () => false;
const delayedDue = delayedManager.onTurnStart();
assert(
    delayedDue?.definitionId === "EVENT_DEMIHUMAN_TRACES",
    "overdue scheduled GE must fire after pending choice clears"
);
assert(delayedState.scheduledGlobalEvents.length === 0, "overdue scheduled GE must be consumed after firing");

const failureState = createState(7);
const failureManager = new GlobalEventManager(failureState, null);
failureManager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 7);
failureManager.triggerEvent = () => null;
assert(failureManager.onTurnStart() === null, "failed scheduled trigger must surface as no activation");
assert(
    failureState.scheduledGlobalEvents.length === 1,
    "failed scheduled trigger must remain queued instead of being lost"
);

const persistedState = createState(4);
const persistedManager = new GlobalEventManager(persistedState, null);
persistedManager.scheduleEvent("EVENT_DEMIHUMAN_TRACES", 7);
const serialized = serializeGameState(persistedState);
assert(
    serialized.scheduledGlobalEvents?.[0]?.eventId === "EVENT_DEMIHUMAN_TRACES" &&
    serialized.scheduledGlobalEvents?.[0]?.verse === 7,
    "scheduled GE queue must serialize"
);

const restoredState = {};
hydrateGameState(restoredState, serialized);
assert(
    restoredState.scheduledGlobalEvents?.[0]?.eventId === "EVENT_DEMIHUMAN_TRACES" &&
    restoredState.scheduledGlobalEvents?.[0]?.verse === 7,
    "scheduled GE queue must hydrate"
);
restoredState.scheduledGlobalEvents[0].verse = 8;
assert(serialized.scheduledGlobalEvents[0].verse === 7, "hydrated scheduled GE queue must not alias serialized data");

console.log("✅ Scheduled Global Event contract OK");