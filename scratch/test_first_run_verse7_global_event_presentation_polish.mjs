import assert from "node:assert/strict";
import fs from "node:fs";
import { GlobalEventPublicPresentationReadModel } from "../game/src/presentation/global_event/global_event_public_presentation_read_model.js";
import { GlobalEventPresentationRuntimeIntegration } from "../game/src/ui/global_event_presentation_runtime_integration.js";
import { I18n } from "../game/src/i18n.js";

function createManager() {
    const listeners = new Set();
    return {
        state: { turn: 7, activeGlobalEvents: [] },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        emit(note) { for (const listener of listeners) listener(note); }
    };
}
function createComponent() {
    return {
        shown: [], locked: false, hidden: true,
        mount() { return true; },
        show(view) { this.shown.push(view); this.hidden = false; return true; },
        setInteractionLocked(value) { this.locked = value === true; },
        hide() { this.hidden = true; return true; },
        destroy() {}
    };
}

const projection = new GlobalEventPublicPresentationReadModel().project({
    timing: "START",
    eventId: "EVENT_DEMIHUMAN_TRACES",
    turn: 7,
    category: "THREAT",
    importance: "MAJOR"
});
assert.equal(projection.eventId, "EVENT_DEMIHUMAN_TRACES");
assert.equal(I18n.t(projection.titleKey), "亜人の痕跡");
assert.match(I18n.t(projection.descriptionKey), /調査/);
assert.equal(projection.actionKind, "CONFIRM");
assert.equal(I18n.t("UI_GLOBAL_EVENT_CONFIRM"), "確認して戻る");

const visualAsset = fs.readFileSync(new URL("../game/assets/events/unknown_traces.svg", import.meta.url), "utf8");
assert.match(visualAsset, /shape-rendering="crispEdges"/, "Verse7 still should keep hard pixel edges");
assert.doesNotMatch(visualAsset, /<(?:linearGradient|radialGradient)\b/i, "Verse7 still should avoid smooth vector gradients");
assert.doesNotMatch(visualAsset, /\b(?:enemy|demihuman|humanoid|figure)\b/i, "Verse7 still must show traces, not reveal the enemy");

const manager = createManager();
const ui = { engine: { globalEventManager: manager } };
const component = createComponent();
const order = [];
const hook = {
    onPresented(view, runtime) {
        order.push("ADVISOR_START");
        runtime.setAdvisorActive(true);
        queueMicrotask(() => {
            order.push("ADVISOR_DONE");
            runtime.releaseInteractionLock();
        });
        return true;
    }
};
const runtime = new GlobalEventPresentationRuntimeIntegration(ui, { component, presentationHook: hook });
manager.emit({ timing: "START", eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7, category: "THREAT", importance: "MAJOR" });
assert.equal(component.shown.length, 1);
assert.equal(runtime.isInteractionLocked(), true);
assert.equal(runtime.handleAction("CONFIRM"), false);
await Promise.resolve();
assert.deepEqual(order, ["ADVISOR_START", "ADVISOR_DONE"]);
assert.equal(runtime.isInteractionLocked(), false);
assert.equal(runtime.handleAction("CONFIRM"), true);
assert.equal(component.hidden, true);

manager.state.activeGlobalEvents = [{ definitionId: "EVENT_DEMIHUMAN_TRACES", runtimeState: {} }];
const restoredComponent = createComponent();
const restoredRuntime = new GlobalEventPresentationRuntimeIntegration(ui, { component: restoredComponent });
assert.equal(restoredRuntime.reconcileActive(), null, "dismissed Verse7 notice must not re-open when presentation state survives restore");
assert.equal(restoredComponent.shown.length, 0);

const before = JSON.stringify({
    warningState: ui.engine.warningState ?? null,
    investigationUnlocked: ui.engine.investigationUnlocked ?? null,
    enemyTruth: ui.engine.enemyTruth ?? null
});
const source = [
    fs.readFileSync(new URL("../game/src/ui/global_event_presentation_runtime_integration.js", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../game/src/ui/global_event_advisor_presentation_integration.js", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../game/src/presentation/global_event/global_event_public_presentation_read_model.js", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../game/src/ui/global_event_presentation_component.js", import.meta.url), "utf8")
].join("\n");
assert.doesNotMatch(source, /from\s+["'][^"']*(?:warning|investigation|enemy_truth)[^"']*["']/i);
assert.doesNotMatch(
    source,
    /from\s+["'][^"']*(?:dice|check_system|gameplay_random|rng)[^"']*["']/i,
    "GE Presentation must not own Shared Dice / Check infrastructure"
);
assert.doesNotMatch(
    source,
    /\b(?:DicePool|roll2d6|roll2D6|checkSystem|gameplayRandom|Math\.random)\b/,
    "GE Presentation must consume resolved public facts only, never roll or resolve checks"
);
assert.equal(JSON.stringify({
    warningState: ui.engine.warningState ?? null,
    investigationUnlocked: ui.engine.investigationUnlocked ?? null,
    enemyTruth: ui.engine.enemyTruth ?? null
}), before);

restoredRuntime.destroy();
runtime.destroy();
console.log("✅ FirstRun Verse7 Global Event Presentation polish passed");
