/**
 * Legacy Trial schedule compatibility boundary.
 *
 * The modern Trial runtime must not use GameState.trialSchedule / nextTrialTurn
 * as authoritative player-facing knowledge. This module temporarily owns the
 * remaining production reads so they can be migrated from one place later.
 *
 * Keep behavior identical until timing, card eligibility, stage progression,
 * and save/restore have explicit modern contracts.
 */

export function getLegacyTrialDistance(state, { fallbackNextTrialTurn = 20 } = {}) {
    const nextTrialTurn = state?.nextTrialTurn || fallbackNextTrialTurn;
    const currentTurn = state?.turn || 1;
    return nextTrialTurn - currentTurn;
}

export function isLegacyTrialNoticeActive(state, { fallbackThreshold = null } = {}) {
    if (!state) return false;
    const notice = typeof state.getTrialNotice === "function"
        ? state.getTrialNotice()
        : { active: false };
    if (notice?.active) return true;
    if (!Number.isFinite(fallbackThreshold)) return false;
    return getLegacyTrialDistance(state) <= fallbackThreshold;
}

export function isLegacyTrialWithin(state, within = 5) {
    if (!state) return false;
    return getLegacyTrialDistance(state) <= within;
}

export function applyLegacyTrialScheduleStageProgression(engine, { translate = null } = {}) {
    const state = engine?.state || null;
    if (!state?.trialSchedule) return { changed: false, stageId: state?.stage?.id ?? null };

    const currentTurn = state.turn;
    const currentStageId = state.stage?.id ?? null;

    if (currentStageId === 1 && currentTurn >= state.trialSchedule.trial1) {
        state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
        state.nextTrialTurn = state.trialSchedule.trial2;
        engine.gridEngine?.expandGrid?.(7);
        state.addLog?.(
            typeof translate === "function"
                ? translate("LOG_STAGE_EXPAND", { stage: 2, size: 7 }, "⚔️ Stage 2 (7x7)")
                : "⚔️ Stage 2 (7x7)"
        );
        return { changed: true, stageId: 2 };
    }

    if (currentStageId === 2 && currentTurn >= state.trialSchedule.trial2) {
        state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
        state.nextTrialTurn = state.trialSchedule.trial3;
        engine.gridEngine?.expandGrid?.(9);
        state.addLog?.(
            typeof translate === "function"
                ? translate("LOG_STAGE_EXPAND", { stage: 3, size: 9 }, "⚔️ Stage 3 (9x9)")
                : "⚔️ Stage 3 (9x9)"
        );
        return { changed: true, stageId: 3 };
    }

    return { changed: false, stageId: currentStageId };
}

export default applyLegacyTrialScheduleStageProgression;
