import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";
import { GlobalEventManager, GLOBAL_EVENT_TIMINGS, GlobalEventSelector } from "../game/src/systems/global_event_system.js";
import { InvestigationUnlockBridge } from "../game/src/warning/systems/investigation_unlock_bridge.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const def = GLOBAL_EVENTS_MASTER.find(event => event.id === "EVENT_DEMIHUMAN_TRACES");
assert(def, "EVENT_DEMIHUMAN_TRACES must be registered in GLOBAL_EVENTS_MASTER");
assert(def.category === "THREAT", "demihuman traces must be a THREAT global event");
assert(def.importance === "MAJOR", "demihuman traces must be a MAJOR global event");
assert(def.duration === 1, "demihuman traces must resolve as a one-verse event");
assert(def.randomEligible === false, "first-contact traces must not enter ordinary random GE selection");
assert(Array.isArray(def.effects) && def.effects.length === 0, "traces must not grant hidden mechanical effects");

const selector = new GlobalEventSelector({ nextFloat: () => 0 });
const selectionState = {
    turn: 7,
    stage: 1,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: []
};
const selected = selector.selectEvent(selectionState, [def]);
assert(selected === null, "demihuman traces must be excluded from ordinary weighted GE selection");

const state = {
    turn: 7,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: [],
    lastGlobalEventTurn: 0,
    addLog() {}
};

const manager = new GlobalEventManager(state, null);
const unlockBridge = new InvestigationUnlockBridge();
const attached = unlockBridge.attach({ state, globalEventManager: manager });
assert(attached.success, "InvestigationUnlockBridge must attach to GlobalEventManager");

let startNotification = null;
const unsubscribe = manager.subscribe(notification => {
    if (notification?.timing === GLOBAL_EVENT_TIMINGS.START &&
        notification?.eventId === "EVENT_DEMIHUMAN_TRACES") {
        startNotification = notification;
    }
});

const instance = manager.triggerEvent("EVENT_DEMIHUMAN_TRACES");
assert(instance?.definitionId === "EVENT_DEMIHUMAN_TRACES", "traces must be directly triggerable as a formal GE");
assert(startNotification?.eventId === "EVENT_DEMIHUMAN_TRACES", "traces must emit the formal GE START lifecycle");
assert(state.investigationUnlocked === true, "traces START must unlock Investigation");
assert(state.investigationUnlockedAtVerse === 7, "Investigation unlock verse must come from the GE lifecycle");

unsubscribe();
unlockBridge.detach();

console.log("✅ EVENT_DEMIHUMAN_TRACES formal GE contract OK");
