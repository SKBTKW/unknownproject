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

/**
 * Owner-routing boundary for post-Trial skill progression.
 *
 * This router never stores or mutates skills itself. ADVISOR and PLAYER are
 * deliberately symmetric ports. The authority behind the selected owner is the
 * only component allowed to perform the actual skill mutation/persistence.
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

        const authority = this.getAuthority(normalizedOwner);
        if (!authority) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_AUTHORITY_REQUIRED",
                owner: normalizedOwner
            };
        }

        const apply = resolveApply(authority);
        if (!apply) {
            return {
                success: false,
                reason: "POST_TRIAL_SKILL_AUTHORITY_INVALID",
                owner: normalizedOwner
            };
        }

        const request = Object.freeze({
            owner: normalizedOwner,
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
                reason: "POST_TRIAL_SKILL_AUTHORITY_THREW",
                owner: normalizedOwner,
                errorName: error?.name || "Error",
                errorMessage: error?.message || String(error)
            };
        }

        if (!authorityResult || authorityResult.success !== true) {
            return {
                success: false,
                reason: authorityResult?.reason || "POST_TRIAL_SKILL_AUTHORITY_REJECTED",
                owner: normalizedOwner,
                authorityResult: cloneData(authorityResult)
            };
        }

        return {
            success: true,
            owner: normalizedOwner,
            authorityResult: cloneData(authorityResult)
        };
    }
}

export default PostTrialSkillProgressionRouter;
