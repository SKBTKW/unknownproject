import assert from "assert/strict";
import fs from "fs";

const ui = fs.readFileSync(new URL("../game/src/ui/ui_controller.js", import.meta.url), "utf8");
const tutorial = fs.readFileSync(new URL("../game/src/tutorial/first_run_trial_tutorial_service.js", import.meta.url), "utf8");
const state = fs.readFileSync(new URL("../game/src/tutorial/first_run_state.js", import.meta.url), "utf8");
const routeBridge = fs.readFileSync(new URL("../game/src/ui/trial_route_board_selection_bridge.js", import.meta.url), "utf8");

assert.match(ui, /getFirstRunTrialTutorialPolicy/);
assert.match(ui, /ROUTE_ACKNOWLEDGED/);
assert.match(ui, /INTERCEPTION_SELECTED/);
assert.match(ui, /DEFENSE_CHANGED/);
assert.match(ui, /RESULT_OBSERVED/);
assert.match(ui, /FIRST_RUN_TRIAL_CAUSALITY/);
assert.match(ui, /getCurrentTrialCausality/);
assert.match(ui, /CAUSALITY_OBSERVED/);
assert.match(ui, /allowInterceptionSelection/);
assert.match(ui, /allowDefenseInput/);
assert.match(ui, /allowTrialConfirm/);
assert.match(ui, /allowSkipRoute/);

assert.match(routeBridge, /acknowledgeFirstRunTrialRoute/);

assert.match(tutorial, /ROUTE_INTRO/);
assert.match(tutorial, /INTERCEPTION_INTRO/);
assert.match(tutorial, /DEFENSE_ALLOCATION/);
assert.match(tutorial, /FINAL_REVIEW/);
assert.match(tutorial, /RESULT_CAUSALITY/);
assert.match(tutorial, /allowSkipRoute: false/);

assert.match(state, /trialTutorial/);
assert.match(state, /getRestoreState/);
assert.match(state, /restoreState/);

const tutorialFiles = [
    "../game/src/tutorial/first_run_state.js",
    "../game/src/tutorial/first_run_service.js",
    "../game/src/tutorial/first_run_trial_tutorial_service.js"
].map(relative => fs.readFileSync(new URL(relative, import.meta.url), "utf8")).join("\n");

for (const forbidden of [
    "startTrialSession(",
    "trialController.startScenario(",
    "trialActive =",
    ".investigationUnlocked =",
    ".knownEnemyState =",
    "trueEnemyStateService.",
    "warningStateService.markOmen(",
    "warningStateService.markWatch(",
    "expandGrid(",
    "completeAfterPresentationCleanup(",
    "TRIAL_RESULT_SETTLED"
]) {
    assert.equal(
        tutorialFiles.includes(forbidden),
        false,
        `FirstRun tutorial layer must not own canonical Trial/Stage authority: ${forbidden}`
    );
}

console.log("✅ FirstRun Trial UI boundary contract PASS");
