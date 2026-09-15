export const CARD_RUNTIME_ACTIVE_CATEGORIES = Object.freeze([
    "LAND",
    "INVESTIGATION"
]);

export function isCardRuntimeActive(card) {
    return Boolean(card && CARD_RUNTIME_ACTIVE_CATEGORIES.includes(card.category));
}

/**
 * Temporary runtime gate while legacy non-LAND card definitions remain in source.
 *
 * Active:
 * - LAND: normal board-forming gameplay
 * - INVESTIGATION: dedicated Warning / Investigation execution path
 *
 * Dormant categories remain available for data/restore compatibility but must not
 * re-enter Offering eligibility or legacy command execution by accident.
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
        if (!isCardRuntimeActive(card)) return false;
        return originalIsCardEligible(card, ...args);
    };

    deckManager.playCommandCard = function playCommandCardWithRuntimePolicy(cardObj, ...args) {
        if (!cardObj) return originalPlayCommandCard(cardObj, ...args);
        if (cardObj.category === "LAND" || cardObj.category === "INVESTIGATION") {
            return { success: false, reason: "NOT_A_COMMAND_CARD" };
        }
        if (!isCardRuntimeActive(cardObj)) {
            return { success: false, reason: "CARD_RUNTIME_DISABLED" };
        }
        return originalPlayCommandCard(cardObj, ...args);
    };

    deckManager.__cardRuntimePolicyAttached = true;
    return { success: true };
}

export default attachCardRuntimePolicy;
