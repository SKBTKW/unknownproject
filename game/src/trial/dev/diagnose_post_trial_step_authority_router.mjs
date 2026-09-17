import assert from "node:assert/strict";
import {
    PostTrialStepAuthorityRouter,
    POST_TRIAL_AUTHORITY_STEP_TYPES
} from "../systems/post_trial_step_authority_router.js";

const transitionContext = {
    transitionId: "POST_TRIAL_1_router-test",
    trialIndex: 1
};
const calls = [];
const rewardAuthority = request => {
    calls.push(request);
    return {
        success: true,
        appliedRewardId: request.result?.selectedRewardId || null
    };
};
const unlockAuthority = {
    applyPostTrialStep(request) {
        return { success: true, appliedUnlockId: request.payload?.unlockId || null };
    }
};
const finalAuthority = {
    applyPostTrialStep(request) {
        return { success: true, endingToken: request.result?.endingToken || null };
    }
};

const router = new PostTrialStepAuthorityRouter({
    rewardAuthority,
    unlockAuthority,
    finalRunCompletionAuthority: finalAuthority
});

const reward = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION,
    payload: { choices: ["A", "B"] },
    result: { selectedRewardId: "B" },
    context: transitionContext
});
assert.equal(reward.success, true);
assert.equal(reward.authorityResult.appliedRewardId, "B");
assert.equal(reward.operationId, "POST_TRIAL_1_router-test:REWARD_SELECTION");
assert.equal(calls[0].operationId, reward.operationId);
assert.equal(calls[0].context.operationId, reward.operationId);

const unlock = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.UNLOCK_APPLY,
    payload: { unlockId: "NEXT_TIER" },
    context: transitionContext
});
assert.equal(unlock.success, true);
assert.equal(unlock.authorityResult.appliedUnlockId, "NEXT_TIER");
assert.equal(unlock.operationId, "POST_TRIAL_1_router-test:UNLOCK_APPLY");

const final = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.FINAL_RUN_COMPLETION,
    result: { endingToken: "EPILOGUE" },
    context: { transitionId: "POST_TRIAL_3_final", trialIndex: 3 }
});
assert.equal(final.success, true);
assert.equal(final.authorityResult.endingToken, "EPILOGUE");
assert.equal(final.operationId, "POST_TRIAL_3_final:FINAL_RUN_COMPLETION");

// A fresh router after save/load derives exactly the same operation id. The
// concrete authority can therefore safely deduplicate a replayed mutation.
const reloadedCalls = [];
const reloadedRouter = new PostTrialStepAuthorityRouter({
    rewardAuthority: request => {
        reloadedCalls.push(request.operationId);
        return { success: true };
    }
});
const reloaded = reloadedRouter.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION,
    result: { selectedRewardId: "B" },
    context: transitionContext
});
assert.equal(reloaded.success, true);
assert.equal(reloaded.operationId, reward.operationId);
assert.deepEqual(reloadedCalls, [reward.operationId]);

const missingOperationId = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION
});
assert.equal(missingOperationId.success, false);
assert.equal(missingOperationId.reason, "POST_TRIAL_STEP_OPERATION_ID_REQUIRED");

const missingAuthority = new PostTrialStepAuthorityRouter().apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION,
    context: transitionContext
});
assert.equal(missingAuthority.success, false);
assert.equal(missingAuthority.reason, "POST_TRIAL_STEP_AUTHORITY_REQUIRED");

const unsupported = router.apply({
    type: "UNKNOWN_STEP",
    context: transitionContext
});
assert.equal(unsupported.success, false);
assert.equal(unsupported.reason, "POST_TRIAL_STEP_AUTHORITY_TYPE_UNSUPPORTED");

const rejected = new PostTrialStepAuthorityRouter({
    rewardAuthority: () => ({ success: false, reason: "REWARD_REJECTED" })
}).apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION,
    context: transitionContext
});
assert.equal(rejected.success, false);
assert.equal(rejected.reason, "REWARD_REJECTED");
assert.equal(rejected.operationId, reward.operationId);

const thrown = new PostTrialStepAuthorityRouter({
    rewardAuthority: () => { throw new Error("boom"); }
}).apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION,
    context: transitionContext
});
assert.equal(thrown.success, false);
assert.equal(thrown.reason, "POST_TRIAL_STEP_AUTHORITY_THREW");
assert.equal(thrown.errorMessage, "boom");
assert.equal(thrown.operationId, reward.operationId);

console.log("diagnose_post_trial_step_authority_router: OK");
