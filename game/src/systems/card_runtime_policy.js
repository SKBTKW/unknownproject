export const CARD_RUNTIME_ACTIVE_CATEGORIES = Object.freeze([
    "LAND",
    "INVESTIGATION"
]);

export const CARD_RUNTIME_DEFAULT_ACTIVE_CARD_IDS = Object.freeze([]);

function normalizeActiveCardIds(value) {
    const source = value instanceof Set
        ? [...value]
        : (Array.isArray(value) ? value : []);

    return Object.freeze(
        [...new Set(
            source
                .map(id => String(id || "").trim())
                .filter(Boolean)
        )]
    );
}

export function resolveCardRuntimeActivationPolicy(deckManager = null) {
    const provider = deckManager?.engine?.cardRuntimeActivationProvider || null;
    const context = Object.freeze({
        state: deckManager?.state || null,
        engine: deckManager?.engine || null,
        deckManager
    });

    const provided = typeof provider === "function"
        ? provider(context)
        : provider?.getPolicy?.(context) ?? provider;

    const requestedIds = Array.isArray(provided) || provided instanceof Set
        ? provided
        : provided?.activeCardIds;

    return Object.freeze({
        activeCardIds: normalizeActiveCardIds(
            requestedIds ?? CARD_RUNTIME_DEFAULT_ACTIVE_CARD_IDS
        ),
        source: provided ? "PROVIDER" : "DEFAULT"
    });
}

function resolveActiveCardIds(policy = null) {
    if (!policy) return CARD_RUNTIME_DEFAULT_ACTIVE_CARD_IDS;
    if (Array.isArray(policy) || policy instanceof Set) {
        return normalizeActiveCardIds(policy);
    }
    return normalizeActiveCardIds(policy.activeCardIds);
}

export function isCardRuntimeActive(card, policy = null) {
    const definition = card?.terrain || card || null;
    if (!definition) return false;

    if (CARD_RUNTIME_ACTIVE_CATEGORIES.includes(definition.category)) {
        return true;
    }

    const cardId = definition.id || card?.cardMasterId || null;
    if (!cardId) return false;

    return resolveActiveCardIds(policy).includes(cardId);
}

/**
 * Temporary runtime gate while legacy non-LAND card definitions remain in source.
 *
 * Always active:
 * - LAND: normal board-forming gameplay
 * - INVESTIGATION: dedicated Warning / Investigation execution path
 *
 * Optional prototype activation:
 * - individual card ids supplied through engine.cardRuntimeActivationProvider
 *
 * Dormant categories remain available for data/restore compatibility but must not
 * re-enter Offering eligibility or command execution wholesale by accident.
 *
 * The provider is intentionally ID-scoped. It cannot reactivate COMMAND,
 * MILITARY, or MYSTIC as whole categories.
 */
export function attachCardRuntimePolicy(deckManager) {
    if (!deckManager) return { success: false, reason: "DECK_MANAGER_REQUIRED" };
    if (deckManager.__cardRuntimePolicyAttached) {
        return { success: true, alreadyAttached: true };
    }

    if (typeof deckManager.isCardEligible !== "function" || typeof deckManager.playCommandCard !== "function") {
        return { success: false, reason: "DECK_MANAGER_RUNTIME_API_REQUIRED" };
    }

    const originalIsCardEligible = deckManager.isCardEligible.bind(deckManager);
    const originalPlayCommandCard = deckManager.playCommandCard.bind(deckManager);

    deckManager.isCardEligible = function isCardEligibleWithRuntimePolicy(card, ...args) {
        const policy = resolveCardRuntimeActivationPolicy(this);
        if (!isCardRuntimeActive(card, policy)) return false;
        return originalIsCardEligible(card, ...args);
    };

    deckManager.playCommandCard = function playCommandCardWithRuntimePolicy(cardObj, ...args) {
        if (!cardObj) return originalPlayCommandCard(cardObj, ...args);

        const definition = cardObj?.terrain || cardObj;
        if (definition?.category === "LAND" || definition?.category === "INVESTIGATION") {
            return { success: false, reason: "NOT_A_COMMAND_CARD" };
        }

        const policy = resolveCardRuntimeActivationPolicy(this);
        if (!isCardRuntimeActive(cardObj, policy)) {
            return { success: false, reason: "CARD_RUNTIME_DISABLED" };
        }

        return originalPlayCommandCard(cardObj, ...args);
    };

    deckManager.__cardRuntimePolicyAttached = true;
    return { success: true };
}

export default attachCardRuntimePolicy;
