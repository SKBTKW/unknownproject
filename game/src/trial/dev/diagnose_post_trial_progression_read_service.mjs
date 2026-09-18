import assert from "node:assert/strict";
import { PostTrialProgressionReadService } from "../presentation/post_trial_progression_read_service.js";

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

const state = {
    transition: null
};

const source = {
    getTransition() {
        return clone(state.transition);
    },
    getCurrentPendingStep() {
        return clone(state.transition?.steps?.find(step => step.status === "PENDING") || null);
    },
    getPendingSteps() {
        return clone(state.transition?.steps?.filter(step => step.status === "PENDING") || []);
    },
    canResumeNormalProgression() {
        return !state.transition || state.transition.status === "COMPLETED";
    }
};

const readService = new PostTrialProgressionReadService(source);

// Before any settled Trial there is no Post-Trial transition and normal Verse
// progression remains available.
assert.deepEqual(readService.read(), {
    available: false,
    transitionId: null,
    trialIndex: null,
    scenarioId: null,
    status: null,
    presentationCleanupComplete: false,
    currentStep: null,
    pendingStepTypes: [],
    aftermath: null,
    runTerminated: false,
    canResumeNormalProgression: true
});

state.transition = {
    schemaVersion: 5,
    transitionId: "POST_TRIAL_1_read-model",
    trialIndex: 1,
    scenarioId: "read-model",
    status: "PENDING_STEPS",
    presentationCleanupComplete: true,
    runTerminated: false,
    aftermath: {
        trialIndex: 1,
        outcome: "SURVIVED",
        result: { emberRemaining: 11 }
    },
    steps: [
        {
            type: "REWARD_SELECTION",
            status: "APPLIED",
            payload: { choices: ["A", "B"] },
            result: { selected: "A" }
        },
        {
            type: "UNLOCK_APPLY",
            status: "PENDING",
            payload: { unlockId: "NEXT" }
        },
        {
            type: "STAGE_ADVANCE",
            status: "PENDING",
            payload: { toStageId: 2 }
        }
    ]
};

const projected = readService.read();
assert.equal(projected.available, true);
assert.equal(projected.transitionId, "POST_TRIAL_1_read-model");
assert.equal(projected.trialIndex, 1);
assert.equal(projected.status, "PENDING_STEPS");
assert.equal(projected.presentationCleanupComplete, true);
assert.deepEqual(projected.pendingStepTypes, ["UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.deepEqual(projected.currentStep, {
    type: "UNLOCK_APPLY",
    status: "PENDING",
    payload: { unlockId: "NEXT" }
});
assert.equal(projected.aftermath.result.emberRemaining, 11);
assert.equal(projected.canResumeNormalProgression, false);

// Consumers cannot mutate the transition SSOT by editing a projection.
projected.currentStep.payload.unlockId = "MUTATED";
projected.pendingStepTypes.push("MUTATED");
projected.aftermath.result.emberRemaining = 999;
const reread = readService.read();
assert.equal(reread.currentStep.payload.unlockId, "NEXT");
assert.deepEqual(reread.pendingStepTypes, ["UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.equal(reread.aftermath.result.emberRemaining, 11);
assert.equal(state.transition.steps[1].payload.unlockId, "NEXT");

// The read boundary follows the authoritative progression source without owning
// mutation or caching stale state.
state.transition.steps[1].status = "APPLIED";
const afterUnlock = readService.read();
assert.equal(afterUnlock.currentStep.type, "STAGE_ADVANCE");
assert.deepEqual(afterUnlock.pendingStepTypes, ["STAGE_ADVANCE"]);

state.transition.steps[2].status = "APPLIED";
state.transition.status = "COMPLETED";
const completed = readService.read();
assert.equal(completed.currentStep, null);
assert.deepEqual(completed.pendingStepTypes, []);
assert.equal(completed.canResumeNormalProgression, true);

console.log("diagnose_post_trial_progression_read_service: OK");
