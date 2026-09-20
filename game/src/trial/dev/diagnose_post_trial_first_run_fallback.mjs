import assert from "node:assert/strict";
import { FirstRunService } from "../../tutorial/first_run_service.js";
import {
    POST_TRIAL_INTERLUDE_SCENES,
    buildPostTrialInterludeSceneSequence,
    requiresPostTrialSystemFallback
} from "../presentation/post_trial_interlude_scene_contract.js";

const readModel = {
    available: true,
    trialIndex: 1,
    runTerminated: false,
    stepTypes: ["STAGE_ADVANCE"],
    pendingStepTypes: ["STAGE_ADVANCE"]
};
const firstRun = new FirstRunService({ enabled: true });
const scenes = buildPostTrialInterludeSceneSequence(readModel, {
    firstRunPolicy: firstRun.getPostTrialInterludePolicy({ readModel })
});
const meaning = scenes.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING);
assert.equal(meaning.required, true);
assert.equal(meaning.systemFallbackRequired, true);
assert.equal(requiresPostTrialSystemFallback(meaning), true);

assert.equal(requiresPostTrialSystemFallback(POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT), true);
assert.equal(requiresPostTrialSystemFallback(POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE), true);

const ordinary = buildPostTrialInterludeSceneSequence(readModel);
const ordinaryMeaning = ordinary.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING);
assert.equal(ordinaryMeaning.required, false);
assert.equal(ordinaryMeaning.systemFallbackRequired, false);
assert.equal(requiresPostTrialSystemFallback(ordinaryMeaning), false);

console.log("diagnose_post_trial_first_run_fallback: OK");
