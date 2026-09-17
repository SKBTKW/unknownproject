import assert from "node:assert/strict";
import {
    PostTrialStepAuthorityRouter,
    POST_TRIAL_AUTHORITY_STEP_TYPES
} from "../systems/post_trial_step_authority_router.js";

const calls = [];
const rewardAuthority = ({ type, payload, result, context }) => {
    calls.push({ type, payload, result, context });
    return { success: true, appliedRewardId: result?.selectedRewardId || null };
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
    context: { trialIndex: 1 }
});
assert.equal(reward.success, true);
assert.equal(reward.authorityResult.appliedRewardId, "B");
assert.equal(calls.length, 1);

const unlock = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.UNLOCK_APPLY,
    payload: { unlockId: "NEXT_TIER" },
    context: { trialIndex: 1 }
});
assert.equal(unlock.success, true);
assert.equal(unlock.authorityResult.appliedUnlockId, "NEXT_TIER");

const final = router.apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.FINAL_RUN_COMPLETION,
    result: { endingToken: "EPILOGUE" },
    context: { trialIndex: 3 }
});
assert.equal(final.success, true);
assert.equal(final.authorityResult.endingToken, "EPILOGUE");

const missing = new PostTrialStepAuthorityRouter().apply({
    type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION
});
assert.equal(missing.success, false);
assert.equal(missing.reason, "POST_TRIAL_STEP_AUTHORITY_REQUIRED");

const unsupported = router.apply({ type: "UNKNOWN_STEP" });
assert.equal(unsupported.success, false);
assert.equal(unsupported.reason, "POST_TRIAL_STEP_AUTHORITY_TYPE_UNSUPPORTED");

const rejected = new PostTrialStepAuthorityRouter({
    rewardAuthority: () => ({ success: false, reason: "REWARD_REJECTED" })
}).apply({ type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION });
assert.equal(rejected.success, false);
assert.equal(rejected.reason, "REWARD_REJECTED");

const thrown = new PostTrialStepAuthorityRouter({
    rewardAuthority: () => { throw new Error("boom"); }
}).apply({ type: POST_TRIAL_AUTHORITY_STEP_TYPES.REWARD_SELECTION });
assert.equal(thrown.success, false);
assert.equal(thrown.reason, "POST_TRIAL_STEP_AUTHORITY_THREW");
assert.equal(thrown.errorMessage, "boom");

console.log("diagnose_post_trial_step_authority_router: OK");
