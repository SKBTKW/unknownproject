/* =============================================================
   game/src/cards/offering_category_multiplicity_policy.js

   Offering category multiplicity is independent from category weights.
   The default contract allows at most two cards from the same category in a
   normal three-card Offering. Explicit providers may relax the cap; minimum
   requirements are enforced after this policy and therefore remain allowed
   to override it.
   ============================================================= */

export const DEFAULT_OFFERING_MAX_PER_CATEGORY = 2;

function normalizeMaxPerCategory(value, fallback = DEFAULT_OFFERING_MAX_PER_CATEGORY) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(1, Math.trunc(numeric));
}

export function resolveOfferingCategoryMultiplicityPolicy({
    engine = null,
    state = null,
    reason = null
} = {}) {
    const provider = engine?.offeringCategoryMultiplicityPolicyProvider || null;
    const context = Object.freeze({ reason, state });

    const provided = typeof provider === "function"
        ? provider(context)
        : provider?.getPolicy?.(context) ?? provider;

    const maxPerCategory = normalizeMaxPerCategory(
        provided?.maxPerCategory,
        DEFAULT_OFFERING_MAX_PER_CATEGORY
    );

    return Object.freeze({
        maxPerCategory,
        source: provided ? "PROVIDER" : "DEFAULT"
    });
}

export function resolveOfferingCardCategory(card) {
    const definition = card?.terrain || card || null;
    return String(definition?.category || "LAND");
}

export function countOfferingCategories(cards = []) {
    const counts = new Map();
    for (const card of cards || []) {
        const category = resolveOfferingCardCategory(card);
        counts.set(category, (counts.get(category) || 0) + 1);
    }
    return counts;
}

export function canAppendOfferingCategory(cards, candidate, policy) {
    if (!candidate) return false;
    const maxPerCategory = normalizeMaxPerCategory(policy?.maxPerCategory);
    const category = resolveOfferingCardCategory(candidate);
    const counts = countOfferingCategories(cards);
    return (counts.get(category) || 0) < maxPerCategory;
}

export function listOfferingCategoryOverflow(cards, policy) {
    const maxPerCategory = normalizeMaxPerCategory(policy?.maxPerCategory);
    return [...countOfferingCategories(cards).entries()]
        .filter(([, count]) => count > maxPerCategory)
        .map(([category, count]) => Object.freeze({
            category,
            count,
            maxPerCategory
        }));
}
