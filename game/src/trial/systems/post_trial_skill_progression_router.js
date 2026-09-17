export const POST_TRIAL_SKILL_OWNER_TYPES = Object.freeze({
    ADVISOR: "ADVISOR",
    PLAYER: "PLAYER"
});

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function normalizeOwner(value) {
    if (value === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR) {
        return POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR;
    }
    if (value === POST_TRIAL_SKILL_OWNER_TYPES.PLAYER) {
        return POST_TRIAL_SKILL_OWNER_TYPES.PLAYER;
    }
    return null;
}

function resolveApply(authority) {
    if (typeof authority === "function") return authority;
    if (authority && typeof authority.applySkillProgression === "function") {
        return request => authority.applySkillProgression(request);
    }
    return null;
}

function createOperationId(owner, context) {
    if (typeof context?.operationId === "string" && context.operationId.length > 0) {
        return context.operationId;
    }
    if (typeof context?.transitionId !== "string" || context.transitionId.length === 0) {
        return null;
    }
    return `${context.transitionId}:SKILL_PROGRESSION:${owner}`;
}

/**
 * Owner-routing boundary for post-Trial skill progression.
 *
 * This router never stores or mutates skills itself. ADVISOR and PLAYER are
 * deliberately symmetric ports. The selected owner authority receives a stable
 * operationId so save/load retries can be idempotent regardless of which owner
 * model is ultimately adopted.
 */
export class PostTrialSkillProgressionRouter {
    constructor({ advisorAuthority = null, playerAuthority = null } = {}) {
        this.advisorAuthority = advisorAuthority;
        this.playerAuthority = playerAuthority;
    }

    getAuthority(owner) {
        const normalizedOwner = normalizeOwner(owner);
        if (normalizedOwner === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR) {
            return this.advisorAuthority;
        }
        if (normalizedOwner === POST_TRIAL_SKILL_OWNER_TYPES.PLAYER) {
            return this.playerAuthority;
        }
        return null;
    }

    apply({ owner = null, payload = null, result = null, context = null } = {}) {
        const normalizedOwner = normalizeOwner(owner);
        if (!normalizedOwner) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_OWNER_INVALID",
                owner: owner ?? null
            };
        }

        const operationId = createOperationId(normalizedOwner, context);
        if (!operationId) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_OPERATION_ID_REQUIRED",
                owner: normalizedOwner
            };
        }

        const authority = this.getAuthority(normalizedOwner);
        if (!authority) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_AUTHORITY_REQUIRED",
                owner: normalizedOwner,
                operationId
            };
        }

        const apply = resolveApply(authority);
        if (!apply) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_AUTHORITY_INVALID",
                owner: normalizedOwner,
                operationId
            };
        }

        const request = Object.freeze({
            operationId,
            owner: normalizedOwner,
            payload: cloneData(payload),
            result: cloneData(result),
            context: {
                ...cloneData(context, {}),
                operationId
            }
        });

        let authorityResult;
        try {
            authorityResult = apply(request);
        } catch (error) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_AUTHORITY_THREW",
                owner: normalizedOwner,
                operationId,
                errorName: error?.name || "Error",
                errorMessage: error?.message || String(error)
            };
        }

        if (!authorityResult || authorityResult.success !== true) {
            return {
                success: false,
                reason: authorityResult?.reason || "POST_TRIAL_SKILL_AUTHORITY_REJECTED",
                owner: normalizedOwner,
                operationId,
                authorityResult: cloneData(authorityResult)
            };
        }

        return {
            success: true,
            owner: normalizedOwner,
            operationId,
            authorityResult: cloneData(authorityResult)
        };
    }
}

export default PostTrialSkillProgressionRouter;
