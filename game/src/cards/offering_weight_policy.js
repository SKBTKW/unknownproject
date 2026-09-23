/* =============================================================
   game/src/cards/offering_weight_policy.js
   Pure Offering weight calculation shared by normal and fallback draws.
   ============================================================= */

import { normalizeCardDefinitionV1 } from './card_definition_v1.js';

function resolveOfferingWeight(card, state) {
    const definition = normalizeCardDefinitionV1(card);
    if (!definition) return 0;

    const baseWeight = Math.max(0, Number(definition.offering.weight ?? 0.1));
    const category = definition.category || "LAND";
    const directiveMultiplier = state?.directiveSystem
        ? Number(state.directiveSystem.getCategoryWeightMultiplier(category) ?? 1)
        : 1;
    const biasCategory = state?.activeDrawBias?.targetCategory || null;
    const biasMultiplier = biasCategory && category === biasCategory ? 2 : 1;

    return Math.max(0, baseWeight * directiveMultiplier * biasMultiplier);
}

function pickWeightedCard(cards, state, nextFloat) {
    if (!Array.isArray(cards) || cards.length === 0) return null;

    const weighted = cards.map(card => ({
        card,
        weight: resolveOfferingWeight(card, state)
    }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

    if (totalWeight <= 0) return weighted[0].card;

    let roll = Math.max(0, Math.min(0.9999999999999999, Number(nextFloat?.() ?? Math.random()))) * totalWeight;
    for (const item of weighted) {
        if (roll < item.weight) return item.card;
        roll -= item.weight;
    }
    return weighted[weighted.length - 1].card;
}

export {
    pickWeightedCard,
    resolveOfferingWeight
};
