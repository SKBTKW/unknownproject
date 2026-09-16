/**
 * Legacy Trial schedule compatibility boundary.
 *
 * The modern Trial runtime must not use GameState.trialSchedule as its
 * authoritative trigger. This module temporarily owns the remaining legacy
 * dependency where board stage expansion is keyed directly to the old Trial
 * schedule.
 *
 * Keep behavior identical until stage progression is moved to an explicit
 * post-Trial progression contract.
 */
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
