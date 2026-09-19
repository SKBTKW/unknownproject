import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
    new URL("../../ui/trial_result_ui_controller.js", import.meta.url),
    "utf8"
);

assert.ok(source.includes("setPostTrialStageGateDeferred(enabled)"));
assert.ok(source.includes("completePostTrialStagePrelude()"));
assert.ok(source.includes("const shouldDeferStageGate = Boolean(this.postTrialStageGateDeferred)"));
assert.ok(source.includes("deferred: true"));
assert.ok(source.includes("completeAfterPresentationCleanup"));

console.log("diagnose_post_trial_stage_prelude_gate: OK");
