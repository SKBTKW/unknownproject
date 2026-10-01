/* =============================================================
   game/src/cards/card_stage_usage.js

   Per-stage card-use ledger for cards that may be used a limited number
   of times in each Stage without becoming globally UNIQUE.
   ============================================================= */

function resolveStageId(state) {
    const stage = state?.stage;
    const raw = typeof stage === "object" ? stage?.id : stage;
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 1;
}

function getCardStageUsage(state, cardId, stageId = resolveStageId(state)) {
    if (!state || !cardId) return 0;
    return Math.max(
        0,
        Number(state.cardStageUsage?.[String(stageId)]?.[cardId] ?? 0)
    );
}

function incrementCardStageUsage(state, cardId, stageId = resolveStageId(state)) {
    if (!state || !cardId) return 0;
    if (!state.cardStageUsage || typeof state.cardStageUsage !== "object") {
        state.cardStageUsage = {};
    }
    const key = String(stageId);
    if (!state.cardStageUsage[key] || typeof state.cardStageUsage[key] !== "object") {
        state.cardStageUsage[key] = {};
    }
    const next = getCardStageUsage(state, cardId, stageId) + 1;
    state.cardStageUsage[key][cardId] = next;
    return next;
}

export {
    getCardStageUsage,
    incrementCardStageUsage,
    resolveStageId
};
