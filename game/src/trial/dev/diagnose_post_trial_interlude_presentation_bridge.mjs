import assert from "node:assert/strict";
import { PostTrialInterludePresentationBridge } from "../presentation/post_trial_interlude_presentation_bridge.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../presentation/post_trial_interlude_scene_contract.js";

const calls = [];
const uiController = {
    setPostTrialStageGateDeferred(enabled) {
        calls.push(["defer", Boolean(enabled)]);
        return Boolean(enabled);
    },
    completePostTrialStagePrelude(options = {}) {
        calls.push(["stage-prelude-complete", options.render]);
        return {
            success: true,
            stageProgression: { success: true, stageId: 2 },
            progression: { success: true }
        };
    }
};
const advisorPresenter = {
    present(scene) {
        calls.push(["advisor", scene.sceneId]);
        return { success: true, spoken: true };
    }
};

const bridge = new PostTrialInterludePresentationBridge({
    uiController,
    advisorPresenter
});

assert.equal(bridge.setEnabled(true), true);
assert.equal(calls.length, 0, "Enabling interlude must not implicitly defer Stage cleanup");

assert.equal(bridge.setStageGateDeferred(true), true);
assert.deepEqual(calls[0], ["defer", true]);

let result = bridge.presentAdvisorScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    payload: {}
});
assert.equal(result.spoken, true);
assert.deepEqual(calls[1], ["advisor", POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT]);

result = bridge.completeScene(POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING);
assert.equal(result.success, true);
assert.equal(result.stageGateOpened, false);
assert.equal(calls.some(call => call[0] === "stage-prelude-complete"), false);

result = bridge.completeScene(POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE);
assert.equal(result.success, true);
assert.equal(result.stageGateOpened, true);
assert.equal(result.stageProgression.stageId, 2);
assert.deepEqual(calls.at(-1), ["stage-prelude-complete", false]);

bridge.setEnabled(false);
assert.deepEqual(calls.at(-1), ["defer", false]);
result = bridge.presentAdvisorScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    payload: {}
});
assert.equal(result.spoken, false);
assert.equal(result.reason, "POST_TRIAL_INTERLUDE_DISABLED");

console.log("diagnose_post_trial_interlude_presentation_bridge: OK");
