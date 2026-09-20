import assert from "node:assert/strict";
import fs from "node:fs";

const uiSource = fs.readFileSync(
    new URL("../../ui/trial_result_ui_controller.js", import.meta.url),
    "utf8"
);
const bridgeSource = fs.readFileSync(
    new URL("../presentation/post_trial_interlude_presentation_bridge.js", import.meta.url),
    "utf8"
);
const progressSource = fs.readFileSync(
    new URL("../systems/post_trial_interlude_progress_service.js", import.meta.url),
    "utf8"
);

assert.ok(uiSource.includes("configurePostTrialInterlude()"));
assert.ok(uiSource.includes("handleSettledTrialExitReady()"));
assert.ok(uiSource.includes("preparePostTrialInterlude()"));
assert.ok(uiSource.includes("resumePostTrialInterludeIfNeeded()"));
assert.ok(uiSource.includes("new AdvisorPostTrialScenePresenter"));
assert.ok(uiSource.includes("new PostTrialInterludePresentationBridge"));
assert.ok(uiSource.includes("new PostTrialInterludeProgressService"));
assert.ok(uiSource.includes("new PostTrialInterludeComponent"));
assert.ok(uiSource.includes("onExitReady: () => this.handleSettledTrialExitReady()"));

assert.ok(bridgeSource.includes("setStageGateDeferred(enabled)"));
assert.ok(bridgeSource.includes("completePostTrialStagePrelude?.({ render: false })"));
assert.ok(progressSource.includes("hasStagePrelude"));
assert.ok(progressSource.includes("active && hasStagePrelude"));

console.log("diagnose_post_trial_interlude_runtime_wiring: OK");
