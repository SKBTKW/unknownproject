/* =============================================================
   game/src/cards/card_domain_action_executor.js

   Card -> owning-domain execution bridge.
   Card Core declares intent; Board/other domains remain mutation authority.
   ============================================================= */

const CARD_DOMAIN_ACTIONS = Object.freeze({
    CREATE_SPECIAL_BLOCK: "CREATE_SPECIAL_BLOCK"
});

function resolveTarget(effect, context) {
    return effect?.target || context?.targetTile || null;
}

function createCardDomainActionExecutor(engine) {
    const execute = (effect, context = {}) => {
        if (!effect || typeof effect !== "object") {
            return { success: false, reason: "INVALID_DOMAIN_ACTION" };
        }

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK) {
            const board = engine?.boardDomainAdapter;
            if (!board || typeof board.createSpecialBlock !== "function") {
                return { success: false, reason: "BOARD_DOMAIN_ACTION_UNAVAILABLE" };
            }
            if (!effect.blockType) {
                return { success: false, reason: "SPECIAL_BLOCK_TYPE_REQUIRED" };
            }
            const target = resolveTarget(effect, context);
            if (!target) {
                return { success: false, reason: "SPECIAL_BLOCK_TARGET_REQUIRED" };
            }
            return board.createSpecialBlock(effect.blockType, target, {
                verse: context?.state?.turn ?? engine?.state?.turn ?? null,
                cardId: context?.cardDefinition?.id || null,
                ...(effect.context || {})
            });
        }

        return { success: false, reason: "UNSUPPORTED_DOMAIN_ACTION" };
    };

    execute.requiresTarget = (effect) =>
        effect?.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK;

    execute.enumerateTargets = (effect, context = {}) => {
        if (!effect || typeof effect !== "object") return [];

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK) {
            const board = engine?.boardDomainAdapter;
            if (!board || typeof board.enumerateLegalSpecialBlockTargets !== "function") {
                return [];
            }
            if (!effect.blockType) return [];
            return board.enumerateLegalSpecialBlockTargets(
                effect.blockType,
                {
                    verse: context?.state?.turn ?? engine?.state?.turn ?? null,
                    cardId: context?.cardDefinition?.id || null,
                    ...(effect.context || {})
                }
            ) || [];
        }

        return [];
    };

    execute.preflight = (effect, context = {}) => {
        if (!effect || typeof effect !== "object") {
            return { success: false, reason: "INVALID_DOMAIN_ACTION" };
        }

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK) {
            const board = engine?.boardDomainAdapter;
            if (!board || typeof board.validateSpecialBlockTarget !== "function") {
                return { success: false, reason: "BOARD_DOMAIN_ACTION_UNAVAILABLE" };
            }
            if (!effect.blockType) {
                return { success: false, reason: "SPECIAL_BLOCK_TYPE_REQUIRED" };
            }
            const target = resolveTarget(effect, context);
            if (!target) {
                return { success: false, reason: "SPECIAL_BLOCK_TARGET_REQUIRED" };
            }
            const validation = board.validateSpecialBlockTarget(
                effect.blockType,
                target,
                {
                    verse: context?.state?.turn ?? engine?.state?.turn ?? null,
                    cardId: context?.cardDefinition?.id || null,
                    ...(effect.context || {})
                }
            );
            return {
                success: validation?.valid === true,
                reason: validation?.valid === true
                    ? null
                    : (validation?.reason || "SPECIAL_BLOCK_TARGET_INVALID"),
                validation
            };
        }

        return { success: false, reason: "UNSUPPORTED_DOMAIN_ACTION" };
    };

    return execute;
}

export {
    CARD_DOMAIN_ACTIONS,
    createCardDomainActionExecutor
};

export default createCardDomainActionExecutor;
