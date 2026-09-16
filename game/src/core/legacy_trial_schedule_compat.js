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

/**
 * Internal compatibility read model for the pre-Warning Trial schedule.
 *
 * This object is intentionally exact because legacy gameplay predicates still
 * depend on exact distance. It is NOT a presentation API and must not be used
 * to expose remaining Verse counts to the player.
 */
export class LegacyTrialTimingReadModel {
    constructor(state) {
        this.state = state || null;
    }

    getCurrentVerse() {
        return this.state?.turn || 1;
    }

    getNextScheduledVerse({ fallbackNextTrialTurn = 20 } = {}) {
        return this.state?.nextTrialTurn || fallbackNextTrialTurn;
    }

    getDistance(options = {}) {
        return getLegacyTrialDistance(this.state, options);
    }

    isNoticeActive({ fallbackThreshold = null } = {}) {
        return isLegacyTrialNoticeActive(this.state, { fallbackThreshold });
    }

    isWithin(within = 5) {
        return isLegacyTrialWithin(this.state, within);
    }

    getScheduledVerse(trialIndex) {
        if (!Number.isInteger(trialIndex) || trialIndex < 1 || trialIndex > 3) return null;
        const value = this.state?.trialSchedule?.[`trial${trialIndex}`];
        return Number.isFinite(value) ? value : null;
    }
}

export function createLegacyTrialTimingReadModel(state) {
    return new LegacyTrialTimingReadModel(state);
}

export function applyLegacyTrialScheduleStageProgression(engine, { translate = null } = {}) {
    const state = engine?.state || null;
    if (!state?.trialSchedule) return { changed: false, stageId: state?.stage?.id ?? null };

    const timing = createLegacyTrialTimingReadModel(state);
    const currentTurn = timing.getCurrentVerse();
    const currentStageId = state.stage?.id ?? null;
    const trial1Verse = timing.getScheduledVerse(1);
    const trial2Verse = timing.getScheduledVerse(2);
    const trial3Verse = timing.getScheduledVerse(3);

    if (currentStageId === 1 && Number.isFinite(trial1Verse) && currentTurn >= trial1Verse) {
        state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
        state.nextTrialTurn = trial2Verse;
        engine.gridEngine?.expandGrid?.(7);
        state.addLog?.(
            typeof translate === "function"
                ? translate("LOG_STAGE_EXPAND", { stage: 2, size: 7 }, "⚔️ Stage 2 (7x7)")
                : "⚔️ Stage 2 (7x7)"
        );
        return { changed: true, stageId: 2 };
    }

    if (currentStageId === 2 && Number.isFinite(trial2Verse) && currentTurn >= trial2Verse) {
        state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
        state.nextTrialTurn = trial3Verse;
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
