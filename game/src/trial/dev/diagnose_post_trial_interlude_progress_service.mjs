import assert from "node:assert/strict";
import { PostTrialInterludeProgressService } from "../systems/post_trial_interlude_progress_service.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../presentation/post_trial_interlude_scene_contract.js";

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

const bridgeCalls = [];
const state = {
    postTrialTransition: {
        transitionId: "POST_TRIAL_1_persisted-interlude",
        trialIndex: 1,
        scenarioId: "persisted-interlude",
        runTerminated: false,
        status: "PENDING_STEPS",
        presentationCleanupComplete: false,
        aftermath: {
            trialIndex: 1,
            turn: 15,
            outcome: "SURVIVED",
            result: { emberRemaining: 12, totalEmberDamage: 2 },
            settlement: { settled: true, runTerminated: false }
        },
        steps: [
            {
                type: "STAGE_ADVANCE",
                status: "PENDING",
                payload: { trialIndex: 1, fromStageId: 1, toStageId: 2, size: 7 }
            }
        ]
    }
};

const readService = {
    read() {
        const transition = state.postTrialTransition;
        return {
            available: true,
            transitionId: transition.transitionId,
            trialIndex: transition.trialIndex,
            scenarioId: transition.scenarioId,
            runTerminated: transition.runTerminated,
            stepTypes: transition.steps.map(step => step.type),
            pendingStepTypes: transition.steps
                .filter(step => step.status === "PENDING")
                .map(step => step.type),
            aftermath: clone(transition.aftermath),
            stageAdvance: {
                status: transition.steps[0].status,
                payload: clone(transition.steps[0].payload)
            }
        };
    }
};
const bridge = {
    setEnabled(enabled) {
        bridgeCalls.push(["enabled", Boolean(enabled)]);
    },
    completeScene(sceneId) {
        bridgeCalls.push(["complete", sceneId]);
        return {
            success: true,
            stageGateOpened: sceneId === POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
        };
    }
};

let service = new PostTrialInterludeProgressService({
    state,
    readService,
    presentationBridge: bridge
});
let started = service.ensureSession();
assert.equal(started.success, true);
assert.equal(started.currentScene.id, POST_TRIAL_INTERLUDE_SCENES.AFTERMATH);
assert.equal(state.postTrialTransition.presentation.currentSceneIndex, 0);

for (const expected of [
    POST_TRIAL_INTERLUDE_SCENES.AFTERMATH,
    POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING
]) {
    const current = service.getCurrentScene();
    assert.equal(current.id, expected);
    const completed = service.completeCurrentScene({ expectedSceneId: expected });
    assert.equal(completed.success, true);
}

assert.equal(service.getCurrentScene().id, POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE);
const serialized = JSON.parse(JSON.stringify(state.postTrialTransition));

// Simulated save/load: a fresh service resumes the persisted scene cursor.
const restoredState = { postTrialTransition: serialized };
const restoredReadService = {
    read() {
        const transition = restoredState.postTrialTransition;
        return {
            available: true,
            transitionId: transition.transitionId,
            trialIndex: transition.trialIndex,
            scenarioId: transition.scenarioId,
            runTerminated: transition.runTerminated,
            stepTypes: transition.steps.map(step => step.type),
            pendingStepTypes: transition.steps.filter(step => step.status === "PENDING").map(step => step.type),
            aftermath: clone(transition.aftermath),
            stageAdvance: {
                status: transition.steps[0].status,
                payload: clone(transition.steps[0].payload)
            }
        };
    }
};
service = new PostTrialInterludeProgressService({
    state: restoredState,
    readService: restoredReadService,
    presentationBridge: bridge
});
started = service.ensureSession();
assert.equal(started.currentScene.id, POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE);
assert.equal(started.presentation.completedSceneIds.includes(POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT), true);

let completed = service.completeCurrentScene({
    expectedSceneId: POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
});
assert.equal(completed.success, true);
assert.equal(completed.bridgeResult.stageGateOpened, true);
assert.equal(service.getCurrentScene().id, POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL);

for (const expected of [
    POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL,
    POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    POST_TRIAL_INTERLUDE_SCENES.CLOSE
]) {
    assert.equal(service.getCurrentScene().id, expected);
    completed = service.completeCurrentScene({ expectedSceneId: expected });
    assert.equal(completed.success, true);
}
assert.equal(completed.completed, true);
assert.equal(service.getCurrentScene(), null);
assert.equal(
    restoredState.postTrialTransition.presentation.status,
    "COMPLETED"
);

console.log("diagnose_post_trial_interlude_progress_service: OK");
