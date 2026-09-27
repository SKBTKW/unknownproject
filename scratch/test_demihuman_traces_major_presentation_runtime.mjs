import assert from "node:assert/strict";
import fs from "node:fs";
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

const browserBootstrap = fs.readFileSync(new URL("../game/index.html", import.meta.url), "utf8");
assert.match(browserBootstrap, /new GlobalEventMajorPresentationRuntimeIntegration\(\{ engine \}\)/,
    "production browser must attach the presentation bridge to the live GameEngine");
assert.ok(browserBootstrap.indexOf("new GlobalEventMajorPresentationRuntimeIntegration")
    < browserBootstrap.indexOf("ui.init();"), "presentation must attach before normal play begins");
assert.ok(fs.statSync(new URL("../game/assets/events/unknown_traces.svg", import.meta.url)).size > 0,
    "the public traces still must be shipped with the game");

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
