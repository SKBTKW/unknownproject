import assert from "node:assert/strict";
import fs from "node:fs";
import { GlobalEventPublicPresentationReadModel } from "../game/src/presentation/global_event/global_event_public_presentation_read_model.js";
import {
    GlobalEventPresentationRuntimeState,
    GLOBAL_EVENT_PRESENTATION_STATES
} from "../game/src/ui/global_event_presentation_runtime_state.js";
import { GlobalEventPresentationRuntimeIntegration } from "../game/src/ui/global_event_presentation_runtime_integration.js";
import { UILayoutConfig } from "../game/src/ui/layout_config.js";
import { GlobalEventPresentationComponent } from "../game/src/ui/global_event_presentation_component.js";
import { projectGlobalEventChoiceToCommonPresentation } from "../game/src/presentation/global_event/global_event_choice_presentation_adapter.js";

const commonRuntimeSource = fs.readFileSync(new URL("../game/src/ui/global_event_presentation_runtime_integration.js", import.meta.url), "utf8");
assert.doesNotMatch(commonRuntimeSource, /EVENT_DEMIHUMAN_TRACES|ADVISOR_SCENES|ADVISOR_EVENTS/, "common GE runtime must not own Advisor/event-specific semantics");

function createManager() {
    const listeners = new Set();
    return {
        state: {
            turn: 7,
            activeGlobalEvents: []
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        emit(note) {
            for (const listener of listeners) listener(note);
        }
    };
}

function createComponentSpy() {
    return {
        root: { hidden: true },
        shown: [],
        hideCount: 0,
        mount() { return true; },
        show(value) {
            this.shown.push(value);
            this.root.hidden = false;
            return true;
        },
        hide() {
            this.hideCount += 1;
            this.root.hidden = true;
            return true;
        },
        destroy() {}
    };
}

const readModel = new GlobalEventPublicPresentationReadModel();
const notice = readModel.project({
    timing: "START",
    eventId: "EVENT_DEMIHUMAN_TRACES",
    turn: 7,
    category: "WARNING",
    importance: "MAJOR"
});
assert.equal(notice.presentationKind, "MAJOR_EVENT");
assert.equal(notice.presentationMode, "NOTICE");
assert.equal(notice.actionKind, "CONFIRM");
assert.equal(notice.stillId, "STILL_DEMIHUMAN_TRACES");
assert.equal(readModel.project({ timing: "START", eventId: "EVENT_UNKNOWN" }), null);
const choiceContract = projectGlobalEventChoiceToCommonPresentation({
    eventId: "CHOICE_SAMPLE",
    category: "THREAT",
    importance: "MAJOR",
    nameKey: "CHOICE_SAMPLE_NAME",
    descKey: "CHOICE_SAMPLE_DESC",
    publicContext: { visibleFacts: ["VISIBLE_A"] },
    choices: [
        { id: "A", labelKey: "CHOICE_A" },
        { id: "B", labelKey: "CHOICE_B" }
    ]
});
assert.equal(choiceContract.presentationMode, "CHOICE");
assert.equal(choiceContract.actionKind, "CHOICE");
assert.deepEqual(choiceContract.actions.map(action => action.id), ["A", "B"]);
assert.deepEqual(choiceContract.publicContext.visibleFacts, ["VISIBLE_A"]);


const state = new GlobalEventPresentationRuntimeState();
assert.equal(state.state, GLOBAL_EVENT_PRESENTATION_STATES.CLOSED);
state.open("EVENT_DEMIHUMAN_TRACES:7");
assert.equal(state.isInteractionLocked(), true);
state.beginResolution();
state.close();
assert.equal(state.isInteractionLocked(), false);

const manager = createManager();
const component = createComponentSpy();
const ui = { engine: { globalEventManager: manager } };
const integration = new GlobalEventPresentationRuntimeIntegration(ui, { component });

manager.emit({
    timing: "START",
    eventId: "EVENT_DEMIHUMAN_TRACES",
    turn: 7,
    category: "WARNING",
    importance: "MAJOR"
});
assert.equal(component.shown.length, 1);
assert.equal(integration.isInteractionLocked(), false, "NOTICE without active Advisor explanation must remain confirmable");

manager.emit({
    timing: "START",
    eventId: "EVENT_DEMIHUMAN_TRACES",
    turn: 7,
    category: "WARNING",
    importance: "MAJOR"
});
assert.equal(component.shown.length, 1, "same START must not duplicate presentation");

assert.equal(integration.handleAction("CONFIRM"), true);
assert.equal(component.hideCount, 1);
assert.equal(integration.isInteractionLocked(), false);

manager.state.activeGlobalEvents = [{
    definitionId: "EVENT_DEMIHUMAN_TRACES",
    remainingTurns: 1,
    runtimeState: {}
}];
assert.equal(integration.reconcileActive(), null, "dismissed notice must not re-present in same runtime");

const restoredComponent = createComponentSpy();
const restored = new GlobalEventPresentationRuntimeIntegration(ui, { component: restoredComponent });
const restoredView = restored.reconcileActive();
assert.equal(restoredView, null, "dismissed notice must remain deduped after runtime restore");
assert.equal(restoredComponent.shown.length, 0);

const unknownComponent = createComponentSpy();
const unknownManager = createManager();
unknownManager.state.activeGlobalEvents = [{ definitionId: "EVENT_UNKNOWN", runtimeState: {} }];
const unknownRuntime = new GlobalEventPresentationRuntimeIntegration(
    { engine: { globalEventManager: unknownManager } },
    { component: unknownComponent }
);
assert.equal(unknownRuntime.reconcileActive(), null);
assert.equal(unknownComponent.shown.length, 0);

assert.equal(UILayoutConfig.globalEventPresentation.overlay.position, "fixed");
assert.equal(UILayoutConfig.globalEventPresentation.overlay.zIndex, "910");
assert.equal(UILayoutConfig.globalEventPresentation.overlay.alignItems, "center");
assert.equal(UILayoutConfig.globalEventPresentation.overlay.justifyContent, "flex-start");
assert.equal(UILayoutConfig.globalEventPresentation.advisorOverlapSafeArea, "IMAGE_RIGHT_EDGE");

const css = fs.readFileSync(new URL("../game/css/0_global_common/global_event_presentation.css", import.meta.url), "utf8");
assert.match(css, /body\[data-global-event-presentation="open"\]/);
assert.match(css, /linear-gradient\(90deg/);
assert.doesNotMatch(css, /!important/);

// The overlay is mounted on startup, before any event has been presented.
// Its hidden attribute must not be overridden by an inline display value.
function element() {
    return {
        style: { removeProperty(key) { delete this[key]; } },
        dataset: {},
        children: [],
        hidden: false,
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        setAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        querySelector() { return null; }
    };
}
const priorDocument = globalThis.document;
const body = element();
body.removeAttribute = () => {};
globalThis.document = { body, createElement: () => element() };
try {
    const surface = new GlobalEventPresentationComponent();
    assert.equal(surface.mount(), true);
    assert.equal(surface.root.hidden, true);
    assert.equal(surface.root.style.display, undefined, "hidden overlay cannot have inline display:flex");
    surface.show({ title: "Event", actions: [{ id: "CONFIRM", label: "Confirm", primary: true }] });
    assert.equal(surface.root.hidden, false);
    assert.equal(surface.root.style.display, "flex");
    surface.hide();
    assert.equal(surface.root.hidden, true);
    assert.equal(surface.root.style.display, undefined, "dismissed overlay must stop intercepting input");
    surface.destroy();
} finally {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
}

restored.destroy();
unknownRuntime.destroy();
integration.destroy();

console.log("✅ Global Event Presentation Foundation contract passed");
