import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
    new URL("../../ui/trial_result_ui_controller.js", import.meta.url),
    "utf8"
);

assert.ok(source.includes('!transition.presentation && transition.status === "COMPLETED"'));
assert.ok(source.includes("this.postTrialInterludeComponent?.close?.()"));

console.log("diagnose_post_trial_interlude_legacy_restore_guard: OK");
