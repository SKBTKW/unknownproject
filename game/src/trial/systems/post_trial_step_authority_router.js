const SUPPORTED_STEP_TYPES = Object.freeze({
    REWARD_SELECTION: "REWARD_SELECTION",
    UNLOCK_APPLY: "UNLOCK_APPLY",
    FINAL_RUN_COMPLETION: "FINAL_RUN_COMPLETION"
});

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function resolveAuthorityApply(authority) {
    if (typeof authority === "function") return authority;
    if (authority && typeof authority.applyPostTrialStep === "function") {
        return request => authority.applyPostTrialStep(request);
    }
    return null;
}

/**
 * Routes semantic Post-Trial steps to their actual mutation authorities.
 *
 * The router never applies rewards, unlocks, or Run completion itself. It only
 * chooses the configured authority for the requested step and reports whether
 * that authority confirmed success. PostTrialProgressionService may mark a step
 * APPLIED only after this boundary succeeds.
 */
export class PostTrialStepAuthorityRouter {
    constructor({
        rewardAuthority = null,
        unlockAuthority = null,
        finalRunCompletionAuthority = null
    } = {}) {
        this.rewardAuthority = rewardAuthority;
        this.unlockAuthority = unlockAuthority;
        this.finalRunCompletionAuthority = finalRunCompletionAuthority;
    }

    getAuthority(type) {
        if (type === SUPPORTED_STEP_TYPES.REWARD_SELECTION) return this.rewardAuthority;
        if (type === SUPPORTED_STEP_TYPES.UNLOCK_APPLY) return this.unlockAuthority;
        if (type === SUPPORTED_STEP_TYPES.FINAL_RUN_COMPLETION) {
            return this.finalRunCompletionAuthority;
        }
        return null;
    }

    apply({ type = null, payload = null, result = null, context = null } = {}) {
        const supported = Object.values(SUPPORTED_STEP_TYPES).includes(type);
        if (!supported) {
            return {
                success: false,
                reason: "POST_TRIAL_STEP_AUTHORITY_TYPE_UNSUPPORTED",
                stepType: type
            };
        }

        const authority = this.getAuthority(type);
        if (!authority) {
            return {
                success: false,
                reason: "POST_TRIAL_STEP_AUTHORITY_REQUIRED",
                stepType: type
            };
        }

        const apply = resolveAuthorityApply(authority);
        if (!apply) {
            return {
                success: false,
                reason: "POST_TRIAL_STEP_AUTHORITY_INVALID",
                stepType: type
            };
        }

        const request = Object.freeze({
            type,
            payload: cloneData(payload),
            result: cloneData(result),
            context: cloneData(context)
        });

        let authorityResult;
        try {
            authorityResult = apply(request);
        } catch (error) {
            return {
                success: false,
                reason: "POST_TRIAL_STEP_AUTHORITY_THREW",
                stepType: type,
                errorName: error?.name || "Error",
                errorMessage: error?.message || String(error)
            };
        }

        if (!authorityResult || authorityResult.success !== true) {
            return {
                success: false,
                reason: authorityResult?.reason || "POST_TRIAL_STEP_AUTHORITY_REJECTED",
                stepType: type,
                authorityResult: cloneData(authorityResult)
            };
        }

        return {
            success: true,
            stepType: type,
            authorityResult: cloneData(authorityResult)
        };
    }
}

export { SUPPORTED_STEP_TYPES as POST_TRIAL_AUTHORITY_STEP_TYPES };
export default PostTrialStepAuthorityRouter;
