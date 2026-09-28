import assert from "node:assert/strict";
import { GlobalEventPublicPresentationReadModel } from "../game/src/presentation/global_event/global_event_public_presentation_read_model.js";
import { GlobalEventPresentationRuntimeIntegration } from "../game/src/ui/global_event_presentation_runtime_integration.js";
import { GlobalEventAdvisorPresentationIntegration } from "../game/src/ui/global_event_advisor_presentation_integration.js";
import { FirstRunState } from "../game/src/tutorial/first_run_state.js";
import { resolveAdvisorSemanticScene } from "../game/src/ui/advisor/advisor_semantic_scene_consumer.js";

function createManager() {
    const listeners = new Set();
    return {
        state: { turn: 7, activeGlobalEvents: [] },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        emit(note) { for (const listener of listeners) listener(note); }
    };
}

function createComponent(order) {
    return {
        shown: [], locked: false,
        mount() { return true; },
        show(view) { order.push("GE_SHOWN"); this.shown.push(view); return true; },
        setInteractionLocked(value) { this.locked = value === true; order.push(this.locked ? "LOCKED" : "UNLOCKED"); },
        hide() { order.push("GE_HIDDEN"); return true; },
        destroy() {}
    };
}

function createAdvisorDock(order, scenes, { emitScene = true } = {}) {
    const listeners = new Set();
    return {
        expanded: 0,
        isEnabled() { return true; },
        expand() { this.expanded += 1; order.push("ADVISOR_EXPANDED"); },
        dialogueSystem: { subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } },
        consumeSemanticScene(scene) {
            scenes.push(scene);
            order.push("SCENE_CONSUMED");
            const resolved = resolveAdvisorSemanticScene(scene);
            if (!emitScene) return false;
            for (const listener of listeners) listener({ event: resolved.advisorEvent });
            return true;
        },
        finish() { for (const listener of listeners) listener(null); }
    };
}

const readModel = new GlobalEventPublicPresentationReadModel();
const projected = readModel.project({ timing: "START", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7, category: "WARNING", importance: "MAJOR" });
assert.equal(projected.titleKey, "EVENT_DEMIHUMAN_TRACES_NAME");
assert.equal(projected.descriptionKey, "EVENT_DEMIHUMAN_TRACES_DESC");
assert.equal(projected.stillId, "STILL_DEMIHUMAN_TRACES");
assert.equal(projected.publicKnowledge, "DEMIHUMAN_ACTIVITY_NEAR_SURVIVAL_ZONE");

const manager = createManager();
const firstRunState = new FirstRunState({ active: true });
const order = [], scenes = [];
const component = createComponent(order);
const advisorDockComponent = createAdvisorDock(order, scenes);
const ui = {
    state: { turn: 7 },
    engine: { globalEventManager: manager, firstRunState },
    advisorDockComponent
};
const advisorPresentationHook = new GlobalEventAdvisorPresentationIntegration(ui);
const runtime = new GlobalEventPresentationRuntimeIntegration(ui, {
    component,
    presentationHook: advisorPresentationHook
});

manager.emit({ timing: "START", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7, category: "WARNING", importance: "MAJOR" });
assert.equal(component.shown.length, 1);
assert.ok(order.indexOf("GE_SHOWN") < order.indexOf("ADVISOR_EXPANDED"));
assert.equal(runtime.isInteractionLocked(), true);
assert.equal(runtime.handleAction("CONFIRM"), false);
assert.equal(scenes.length, 1);
assert.deepEqual(Object.keys(scenes[0].context).sort(), ["category","eventId","firstPresentation","firstRun","presentationKind","publicKnowledge"]);
assert.equal(scenes[0].context.firstRun, true);
assert.equal(scenes[0].context.firstPresentation, true);
assert.equal(resolveAdvisorSemanticScene(scenes[0]).advisorEvent, "GLOBAL_EVENT_PRESENTED_FIRST_RUN");
assert.equal(resolveAdvisorSemanticScene(scenes[0]).topic, "survival");
assert.equal(firstRunState.hasSceneOccurred("GLOBAL_EVENT_DEMIHUMAN_TRACES_ADVISOR_BACKGROUND"), true);

manager.emit({ timing: "START", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7, category: "WARNING", importance: "MAJOR" });
assert.equal(scenes.length, 1);

advisorDockComponent.finish();
assert.equal(runtime.isInteractionLocked(), false);
assert.equal(runtime.handleAction("CONFIRM"), true);

manager.state.activeGlobalEvents = [{ definitionId: "EVENT_DEMIHUMAN_TRACES", runtimeState: {} }];
const restoredOrder = [], restoredScenes = [];
const restoredDock = createAdvisorDock(restoredOrder, restoredScenes);
const restoredUi = {
    state: { turn: 7 },
    engine: { globalEventManager: manager, firstRunState },
    advisorDockComponent: restoredDock
};
const restored = new GlobalEventPresentationRuntimeIntegration(restoredUi, {
    component: createComponent(restoredOrder),
    presentationHook: new GlobalEventAdvisorPresentationIntegration(restoredUi)
});
assert.equal(restored.reconcileActive().eventId, "EVENT_DEMIHUMAN_TRACES");
assert.equal(restoredScenes[0].context.firstPresentation, false);
assert.equal(resolveAdvisorSemanticScene(restoredScenes[0]).advisorEvent, "GLOBAL_EVENT_PRESENTED_BRIEF");
const payloadText = JSON.stringify(restoredScenes[0]);
for (const forbidden of ["enemyRoute","ingress","enemyInternalState","trialVerse","enemyTruth"]) assert.equal(payloadText.includes(forbidden), false);
restoredDock.finish();

const failedState = new FirstRunState({ active: true });
const failedOrder = [], failedScenes = [];
const failedManager = createManager();
const failedDock = createAdvisorDock(failedOrder, failedScenes, { emitScene: false });
const failedUi = {
    state: { turn: 7 },
    engine: { globalEventManager: failedManager, firstRunState: failedState },
    advisorDockComponent: failedDock
};
const failedRuntime = new GlobalEventPresentationRuntimeIntegration(failedUi, {
    component: createComponent(failedOrder),
    presentationHook: new GlobalEventAdvisorPresentationIntegration(failedUi)
});
failedManager.emit({ timing: "START", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7, category: "WARNING", importance: "MAJOR" });
assert.equal(failedRuntime.isInteractionLocked(), false, "failed Advisor emission must not deadlock GE confirmation");
assert.equal(failedState.hasSceneOccurred("GLOBAL_EVENT_DEMIHUMAN_TRACES_ADVISOR_BACKGROUND"), false, "failed Advisor emission must not consume FirstRun background occurrence");
failedRuntime.destroy();

restored.destroy();
runtime.destroy();
console.log("✅ Global Event Advisor / FirstRun Presentation Integration passed");
