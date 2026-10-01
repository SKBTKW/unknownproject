/* =============================================================
   game/src/cards/card_cost_policy.js

   Generic card resource-cost resolver.
   Supports authored per-stage multipliers without card-id branches.
   ============================================================= */

function resolveStageId(state) {
    const stage = state?.stage;
    const raw = typeof stage === "object" ? stage?.id : stage;
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 1;
}

function resolveStageCostMultiplier(card, state) {
    const multipliers = card?.stageCostMultipliers;
    if (!multipliers || typeof multipliers !== "object") return 1;
    const stageId = resolveStageId(state);
    const value = Number(multipliers[stageId] ?? multipliers[String(stageId)] ?? 1);
    return Number.isFinite(value) && value >= 0 ? value : 1;
}

function resolveCardResourceCost(card, state) {
    const source = card?.terrain || card || {};
    const base = source.cost && typeof source.cost === "object" ? source.cost : {};
    const multiplier = resolveStageCostMultiplier(source, state);
    const resources = {};
    for (const [key, value] of Object.entries(base)) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) continue;
        resources[key] = Math.max(0, Math.trunc(numeric * multiplier));
    }
    return Object.freeze(resources);
}

function canAffordCardResourceCost(card, state) {
    if (!state) return false;
    const cost = resolveCardResourceCost(card, state);
    const materialCost = Number(cost.material ?? cost.wood ?? 0);
    const currentMaterial = Math.max(
        Number(state.material ?? 0),
        Number(state.wood ?? 0)
    );
    if (Number(cost.food ?? 0) > Number(state.food ?? 0)) return false;
    if (materialCost > currentMaterial) return false;
    if (Number(cost.mystic ?? 0) > Number(state.mystic ?? 0)) return false;
    if (Number(cost.ember ?? 0) > Number(state.ember ?? 0)) return false;
    return true;
}

export {
    canAffordCardResourceCost,
    resolveCardResourceCost,
    resolveStageCostMultiplier,
    resolveStageId
};
