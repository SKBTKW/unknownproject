import assert from "node:assert/strict";
import { PostTrialInterludeProgressService } from "../systems/post_trial_interlude_progress_service.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../presentation/post_trial_interlude_scene_contract.js";

const deferrals = [];
const state = {
    postTrialTransition: {
        transitionId: "POST_TRIAL_1_gate-reset",
        trialIndex: 1,
        scenarioId: "gate-reset",
        runTerminated: false,
        status: "COMPLETED",
        aftermath: {},
        steps: [{ type: "STAGE_ADVANCE", status: "APPLIED", payload: { toStageId: 2 } }],
        presentation: {
            schemaVersion: 1,
            transitionId: "POST_TRIAL_1_gate-reset",
            status: "ACTIVE",
            currentSceneIndex: 4,
            scenes: [
                { id: POST_TRIAL_INTERLUDE_SCENES.AFTERMATH },
                { id: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT },
                { id: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING },
                { id: POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE },
                { id: POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL },
                { id: POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT },
                { id: POST_TRIAL_INTERLUDE_SCENES.CLOSE }
            ],
            completedSceneIds: [
                POST_TRIAL_INTERLUDE_SCENES.AFTERMATH,
                POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
                POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
                POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
            ]
        }
    }
};
const readService = {
    read() {
        return {
            available: true,
            transitionId: state.postTrialTransition.transitionId,
            trialIndex: 1,
            runTerminated: false,
            stepTypes: ["STAGE_ADVANCE"],
            pendingStepTypes: [],
            aftermath: {},
            stageAdvance: { status: "APPLIED", payload: { toStageId: 2 } }
        };
    }
};
const presentationBridge = {
    setEnabled() {},
    setStageGateDeferred(enabled) {
        deferrals.push(Boolean(enabled));
    }
};

const service = new PostTrialInterludeProgressService({
    state,
    readService,
    presentationBridge
});
const resumed = service.ensureSession();
assert.equal(resumed.success, true);
assert.equal(resumed.currentScene.id, POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL);
assert.equal(deferrals.at(-1), false);

console.log("diagnose_post_trial_stage_gate_resume: OK");
