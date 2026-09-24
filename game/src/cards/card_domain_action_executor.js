/* =============================================================
   game/src/cards/card_domain_action_executor.js

   Card -> owning-domain execution bridge.
   Card Core declares intent; Board/other domains remain mutation authority.
   ============================================================= */

const CARD_DOMAIN_ACTIONS = Object.freeze({
    CREATE_SPECIAL_BLOCK: "CREATE_SPECIAL_BLOCK",
    CREATE_ZONE_CONVERSION: "CREATE_ZONE_CONVERSION",
    APPLY_DEFENSE_DEVELOPMENT: "APPLY_DEFENSE_DEVELOPMENT"
});

const CARD_DOMAIN_PAYMENT_MODES = Object.freeze({
    CARD_COST: "CARD_COST",
    DOMAIN_QUOTE: "DOMAIN_QUOTE"
});

function resolveTarget(effect, context) {
    return effect?.target || context?.targetTile || null;
}

function normalizeCardCost(cardDefinition) {
    const source = cardDefinition?.legacy || cardDefinition || {};
    const cost = source.cost || {};
    const normalized = {};
    const wood = Number(cost.material ?? cost.wood ?? 0);
    const pairs = [
        ['food', Number(cost.food || 0)],
        ['wood', wood],
        ['defense', Number(cost.defense || 0)],
        ['mystic', Number(cost.mystic || 0)],
        ['ember', Number(cost.ember || 0)]
    ];
    for (const [key, value] of pairs) {
        if (Number.isFinite(value) && value > 0) normalized[key] = value;
    }
    return normalized;
}

function sameResourceCost(left = {}, right = {}) {
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    for (const key of keys) {
        if (Number(left?.[key] || 0) !== Number(right?.[key] || 0)) return false;
    }
    return true;
}

function isSupportedCardPaymentCost(cost = {}) {
    return Number(cost?.defense || 0) === 0;
}

function hasReliableCardPaymentState(state, cost = {}) {
    const woodCost = Number(cost?.wood || 0);
    if (woodCost > 0) {
        if (!Number.isFinite(Number(state?.wood))) return false;
        if (Number(state.wood) < woodCost) return false;
    }
    for (const key of ['food', 'mystic', 'ember']) {
        const required = Number(cost?.[key] || 0);
        if (required > 0 && Number(state?.[key] || 0) < required) return false;
    }
    return true;
}

function resolveZoneGroupId(board, effect, context) {
    if (effect?.targetGroupId !== undefined && effect?.targetGroupId !== null) {
        return String(effect.targetGroupId);
    }
    const target = resolveTarget(effect, context);
    if (typeof board?.resolveZoneConversionGroupId === 'function') {
        return board.resolveZoneConversionGroupId(target);
    }
    if (typeof target === 'string' && target) return target;
    if (target?.groupId !== undefined && target?.groupId !== null) return String(target.groupId);
    return null;
}

function withOptionalActivationLog(effect, context, result) {
    if (!result || result.success === false || effect?.logActivation !== true) return result;
    const state = context?.state;
    if (typeof state?.addLog !== "function") return result;

    const i18n = context?.i18n;
    const name = context?.cardName || context?.cardDefinition?.id || "Card";
    const desc = context?.cardDescription || "";
    const message = i18n?.t
        ? i18n.t("LOG_CMD_ACTIVATED", { name, desc })
        : `📜【${name}】`;
    state.addLog(message || `📜【${name}】`);
    return result;
}

function createCardDomainActionExecutor(engine) {
    const execute = (effect, context = {}) => {
        if (!effect || typeof effect !== "object") {
            return { success: false, reason: "INVALID_DOMAIN_ACTION" };
        }

        if (effect.action === CARD_DOMAIN_ACTIONS.APPLY_DEFENSE_DEVELOPMENT) {
            const defense = engine?.defenseSystem || context?.state?.defenseSystem;
            if (!defense || typeof defense.applyPermanentDefenseDevelopment !== "function") {
                return { success: false, reason: "DEFENSE_DOMAIN_ACTION_UNAVAILABLE" };
            }
            const result = defense.applyPermanentDefenseDevelopment({
                capacityBonus: effect.capacityBonus,
                vicinityDefenseBonus: effect.vicinityDefenseBonus
            });
            return withOptionalActivationLog(effect, context, result);
        }

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_ZONE_CONVERSION) {
            const board = engine?.boardDomainAdapter;
            if (!board || typeof board.createZoneConversion !== "function") {
                return { success: false, reason: "BOARD_ZONE_CONVERSION_UNAVAILABLE" };
            }
            if (!effect.definitionId) {
                return { success: false, reason: "ZONE_CONVERSION_DEFINITION_REQUIRED" };
            }
            const groupId = resolveZoneGroupId(board, effect, context);
            if (!groupId) {
                return { success: false, reason: "ZONE_CONVERSION_TARGET_REQUIRED" };
            }

            const result = board.createZoneConversion(effect.definitionId, groupId, {
                paymentConfirmed: true,
                createdVerse: context?.state?.turn ?? engine?.state?.turn ?? null,
                cardId: context?.cardDefinition?.id || null
            });
            return withOptionalActivationLog(effect, context, result);
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
            const result = board.createSpecialBlock(effect.blockType, target, {
                verse: context?.state?.turn ?? engine?.state?.turn ?? null,
                cardId: context?.cardDefinition?.id || null,
                ...(effect.context || {})
            });
            return withOptionalActivationLog(effect, context, result);
        }

        return { success: false, reason: "UNSUPPORTED_DOMAIN_ACTION" };
    };

    execute.quoteCost = (effect, context = {}) => {
        if (effect?.action !== CARD_DOMAIN_ACTIONS.CREATE_ZONE_CONVERSION) return null;
        if (effect?.paymentMode !== CARD_DOMAIN_PAYMENT_MODES.DOMAIN_QUOTE) return null;

        const board = engine?.boardDomainAdapter;
        if (!board || typeof board.quoteZoneConversionCost !== "function") {
            return { success: false, reason: "BOARD_ZONE_CONVERSION_UNAVAILABLE" };
        }
        if (!effect.definitionId) {
            return { success: false, reason: "ZONE_CONVERSION_DEFINITION_REQUIRED" };
        }

        const quote = board.quoteZoneConversionCost(effect.definitionId);
        if (quote?.status !== "RESOLVED" || !quote?.resources) {
            return { success: false, reason: "ZONE_CONVERSION_COST_UNRESOLVED", quote };
        }
        if (!isSupportedCardPaymentCost(quote.resources)) {
            return {
                success: false,
                reason: "ZONE_CONVERSION_CARD_PAYMENT_RESOURCE_UNSUPPORTED",
                quote
            };
        }
        return {
            success: true,
            resources: { ...quote.resources },
            quote,
            source: "DOMAIN_QUOTE"
        };
    };

    execute.requiresTarget = (effect) =>
        effect?.action === CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK
        || effect?.action === CARD_DOMAIN_ACTIONS.CREATE_ZONE_CONVERSION;

    execute.enumerateTargets = (effect, context = {}) => {
        if (!effect || typeof effect !== "object") return [];

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_ZONE_CONVERSION) {
            const board = engine?.boardDomainAdapter;
            if (
                !board
                || typeof board.enumerateZoneConversionCandidates !== "function"
                || typeof board.quoteZoneConversionCost !== "function"
                || typeof board.validateZoneConversionCandidateAfterPayment !== "function"
            ) {
                return [];
            }
            if (!effect.definitionId) return [];

            const quote = board.quoteZoneConversionCost(effect.definitionId);
            const quotedCost = quote?.resources || {};
            const cardCost = normalizeCardCost(context?.cardDefinition);
            const domainQuoted = effect.paymentMode === CARD_DOMAIN_PAYMENT_MODES.DOMAIN_QUOTE;
            if (
                quote?.status !== "RESOLVED"
                || !isSupportedCardPaymentCost(quotedCost)
                || (!domainQuoted && !sameResourceCost(cardCost, quotedCost))
            ) {
                return [];
            }

            const candidates = board.enumerateZoneConversionCandidates(effect.definitionId) || [];
            return candidates.flatMap(candidate => {
                const groupId = candidate?.groupId;
                if (!groupId) return [];
                const afterPayment = board.validateZoneConversionCandidateAfterPayment(
                    effect.definitionId,
                    groupId,
                    quotedCost
                );
                if (!afterPayment?.valid) return [];

                const semantic = typeof board.readZoneSemantic === "function"
                    ? board.readZoneSemantic(groupId)
                    : null;
                const firstCell = Array.isArray(semantic?.cells)
                    ? [...semantic.cells].sort((a, b) => (a.r - b.r) || (a.c - b.c))[0]
                    : null;
                return [{
                    groupId: String(groupId),
                    ...(firstCell ? { r: firstCell.r, c: firstCell.c } : {}),
                    zoneAttribute: candidate.zoneAttribute || null,
                    cost: quotedCost
                }];
            });
        }

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

        if (effect.action === CARD_DOMAIN_ACTIONS.APPLY_DEFENSE_DEVELOPMENT) {
            const defense = engine?.defenseSystem || context?.state?.defenseSystem;
            if (!defense || typeof defense.applyPermanentDefenseDevelopment !== "function") {
                return { success: false, reason: "DEFENSE_DOMAIN_ACTION_UNAVAILABLE" };
            }
            if (!Number.isFinite(Number(effect.capacityBonus))
                || !Number.isFinite(Number(effect.vicinityDefenseBonus))) {
                return { success: false, reason: "DEFENSE_DEVELOPMENT_VALUES_REQUIRED" };
            }
            return { success: true };
        }

        if (effect.action === CARD_DOMAIN_ACTIONS.CREATE_ZONE_CONVERSION) {
            const board = engine?.boardDomainAdapter;
            if (
                !board
                || typeof board.quoteZoneConversionCost !== "function"
                || typeof board.validateZoneConversionCandidateAfterPayment !== "function"
            ) {
                return { success: false, reason: "BOARD_ZONE_CONVERSION_UNAVAILABLE" };
            }
            if (!effect.definitionId) {
                return { success: false, reason: "ZONE_CONVERSION_DEFINITION_REQUIRED" };
            }

            const groupId = resolveZoneGroupId(board, effect, context);
            if (!groupId) {
                return { success: false, reason: "ZONE_CONVERSION_TARGET_REQUIRED" };
            }

            const quote = board.quoteZoneConversionCost(effect.definitionId);
            if (quote?.status !== "RESOLVED" || !quote?.resources) {
                return { success: false, reason: "ZONE_CONVERSION_COST_UNRESOLVED", quote };
            }

            if (!isSupportedCardPaymentCost(quote.resources)) {
                return {
                    success: false,
                    reason: "ZONE_CONVERSION_CARD_PAYMENT_RESOURCE_UNSUPPORTED",
                    quote
                };
            }

            const domainQuoted = effect.paymentMode === CARD_DOMAIN_PAYMENT_MODES.DOMAIN_QUOTE;
            const cardCost = normalizeCardCost(context?.cardDefinition);
            const paymentCost = domainQuoted
                ? (context?.resolvedPaymentCost || quote.resources)
                : cardCost;

            if (!domainQuoted && !sameResourceCost(cardCost, quote.resources)) {
                return {
                    success: false,
                    reason: "ZONE_CONVERSION_CARD_COST_MISMATCH",
                    cardCost,
                    quote
                };
            }
            if (domainQuoted && !sameResourceCost(paymentCost, quote.resources)) {
                return {
                    success: false,
                    reason: "ZONE_CONVERSION_QUOTE_STALE",
                    paymentCost,
                    quote
                };
            }

            if (!hasReliableCardPaymentState(context?.state, paymentCost)) {
                return {
                    success: false,
                    reason: "ZONE_CONVERSION_CARD_PAYMENT_STATE_UNSAFE",
                    quote
                };
            }

            const validation = board.validateZoneConversionCandidateAfterPayment(
                effect.definitionId,
                groupId,
                quote.resources
            );
            return {
                success: validation?.valid === true,
                reason: validation?.valid === true
                    ? null
                    : (validation?.reasons?.[0] || "ZONE_CONVERSION_TARGET_INVALID"),
                validation,
                quote
            };
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
    CARD_DOMAIN_PAYMENT_MODES,
    createCardDomainActionExecutor
};

export default createCardDomainActionExecutor;
