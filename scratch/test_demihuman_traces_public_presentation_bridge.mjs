import assert from "node:assert/strict";
import { GlobalEventManager } from "../game/src/systems/global_event_system.js";
import { GlobalEventPublicPresentationBridge } from "../game/src/presentation/global_event/global_event_public_presentation_bridge.js";

const state = {
    turn: 7,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: [],
    scheduledGlobalEvents: [],
    lastGlobalEventTurn: 0,
    addLog() {}
};

const manager = new GlobalEventManager(state, null);
const emitted = [];
const bridge = new GlobalEventPublicPresentationBridge({
    sink: presentation => emitted.push(presentation)
});

assert.deepEqual(
    bridge.attach(),
    { success: false, reason: "GLOBAL_EVENT_LIFECYCLE_REQUIRED" },
    "attach must fail closed without a lifecycle source"
);

const noSinkBridge = new GlobalEventPublicPresentationBridge();
assert.deepEqual(
    noSinkBridge.attach({ globalEventManager: manager }),
    { success: false, reason: "PRESENTATION_SINK_REQUIRED" },
    "attach must fail closed without a presentation sink"
);

assert.deepEqual(
    bridge.attach({ globalEventManager: manager }),
    { success: true },
    "bridge must subscribe to Global Event lifecycle"
);

manager.triggerEvent("EVENT_DEMIHUMAN_TRACES");
assert.equal(emitted.length, 1, "Traces START must emit one public presentation request");
assert.equal(emitted[0].eventId, "EVENT_DEMIHUMAN_TRACES");
assert.equal(emitted[0].titleKey, "EVENT_UNKNOWN_TRACES_NAME");
assert.equal(emitted[0].descriptionKey, "EVENT_UNKNOWN_TRACES_DESC");
assert.equal(emitted[0].publicKnowledge, "ANOMALY_ONLY");

manager.emitLifecycle("END", { id: "EVENT_DEMIHUMAN_TRACES", category: "THREAT", importance: "MAJOR" }, 7);
assert.equal(emitted.length, 1, "END must not emit a new presentation request");

manager.emitLifecycle("START", { id: "EVENT_COLD_WAVE", category: "ENVIRONMENT", importance: "MAJOR" }, 7);
assert.equal(emitted.length, 1, "unmapped events must fail closed");

const firstUnsubscribe = bridge.unsubscribe;
assert.equal(typeof firstUnsubscribe, "function");
assert.deepEqual(
    bridge.attach({ globalEventManager: manager }),
    { success: true },
    "reattach must succeed"
);
assert.notEqual(bridge.unsubscribe, firstUnsubscribe, "reattach must replace the old subscription");

bridge.detach();
assert.equal(bridge.unsubscribe, null, "detach must clear the subscription");

manager.emitLifecycle("START", { id: "EVENT_DEMIHUMAN_TRACES", category: "THREAT", importance: "MAJOR" }, 7);
assert.equal(emitted.length, 1, "detached bridge must not receive lifecycle events");

console.log("✅ Demihuman Traces public presentation bridge OK");
