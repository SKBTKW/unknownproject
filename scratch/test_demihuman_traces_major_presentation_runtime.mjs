import assert from "node:assert/strict";
import { GlobalEventManager } from "../game/src/systems/global_event_system.js";
import { GlobalEventMajorPresentationRuntimeIntegration } from "../game/src/ui/global_event_major_presentation_runtime_integration.js";

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
const shown = [];
const component = {
    show(presentation) {
        shown.push(presentation);
        return true;
    },
    hide() {
        return true;
    }
};

const integration = new GlobalEventMajorPresentationRuntimeIntegration({
    engine: { globalEventManager: manager },
    component
});

assert.deepEqual(integration.attachResult, { success: true });
manager.triggerEvent("EVENT_DEMIHUMAN_TRACES");

assert.equal(shown.length, 1, "Traces START must reach the major-event component");
assert.equal(shown[0].eventId, "EVENT_DEMIHUMAN_TRACES");
assert.equal(shown[0].titleKey, "EVENT_UNKNOWN_TRACES_NAME");
assert.equal(shown[0].descriptionKey, "EVENT_UNKNOWN_TRACES_DESC");
assert.equal(shown[0].stillId, "STILL_UNKNOWN_TRACES");
assert.equal(shown[0].publicKnowledge, "ANOMALY_ONLY");

manager.emitLifecycle("START", { id: "EVENT_COLD_WAVE", category: "ENVIRONMENT", importance: "MAJOR" }, 7);
assert.equal(shown.length, 1, "unmapped Global Events must remain hidden");

integration.destroy();
manager.emitLifecycle("START", { id: "EVENT_DEMIHUMAN_TRACES", category: "THREAT", importance: "MAJOR" }, 7);
assert.equal(shown.length, 1, "destroy must detach lifecycle presentation");

console.log("✅ Demihuman Traces major presentation runtime integration OK");
