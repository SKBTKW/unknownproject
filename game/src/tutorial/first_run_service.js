import { OFFERING_GENERATION_REASONS } from "../systems/deck_manager.js";

export const FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID = "EVENT_DEMIHUMAN_TRACES";
export const FIRST_RUN_DEMIHUMAN_TRACES_VERSE = 7;
export const FIRST_RUN_INVESTIGATION_GUARANTEE_VERSE = 8;
export const FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES = Object.freeze({
    FIRST_TRIAL_AFTERMATH_MEANING: "FIRST_TRIAL_AFTERMATH_MEANING"
});

/**
 * FirstRun orchestration owns only tutorial/run-specific timing intent.
 *
 * It does not:
 * - mutate Warning State;
 * - unlock Investigation directly;
 * - inspect Trial truth/schedule;
 * - choose concrete Offering cards.
 *
 * Canonical downstream ownership remains:
 * GlobalEventManager -> WarningOmenBridge / InvestigationUnlockBridge
 * DeckManager -> Offering eligibility / weighted selection / replacement
 */
export class FirstRunService {
    constructor({
        enabled = false,
        tracesEventId = FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID,
        tracesVerse = FIRST_RUN_DEMIHUMAN_TRACES_VERSE,
        investigationGuaranteeVerse = FIRST_RUN_INVESTIGATION_GUARANTEE_VERSE
    } = {}) {
        this.enabled = enabled === true;
        this.tracesEventId = tracesEventId;
        this.tracesVerse = tracesVerse;
        this.investigationGuaranteeVerse = investigationGuaranteeVerse;
        this.lastScheduleResult = null;
    }

    attach({ engine } = {}) {
        if (!this.enabled) {
            return { success: true, enabled: false, scheduled: false };
        }
        if (!engine?.globalEventManager || typeof engine.globalEventManager.scheduleEvent !== "function") {
            return { success: false, reason: "GLOBAL_EVENT_SCHEDULER_REQUIRED" };
        }

        const state = engine.state || null;
        const currentVerse = Number.isInteger(state?.turn) ? state.turn : 1;
        const alreadyTriggered = Number.isFinite(state?.eventCooldowns?.[this.tracesEventId])
            || state?.investigationUnlocked === true;
        if (currentVerse > this.tracesVerse) {
            if (alreadyTriggered) {
                const result = {
                    success: true,
                    alreadyTriggered: true,
                    scheduledEvent: null
                };
                this.lastScheduleResult = result;
                return {
                    success: true,
                    enabled: true,
                    scheduled: false,
                    alreadyTriggered: true,
                    scheduleResult: result
                };
            }
            return {
                success: false,
                reason: "FIRST_RUN_TRACE_WINDOW_MISSED"
            };
        }

        const result = engine.globalEventManager.scheduleEvent(this.tracesEventId, this.tracesVerse);
        this.lastScheduleResult = result;
        if (!result?.success) {
            return {
                success: false,
                reason: result?.reason || "FIRST_RUN_TRACE_SCHEDULE_FAILED",
                scheduleResult: result || null
            };
        }
        return {
            success: true,
            enabled: true,
            scheduled: result.alreadyScheduled !== true,
            alreadyScheduled: result.alreadyScheduled === true,
            scheduleResult: result
        };
    }

    getPostTrialInterludePolicy({ readModel } = {}) {
        if (!this.enabled || !readModel?.available) return null;
        if (Number(readModel.trialIndex) !== 1) return null;

        return Object.freeze({
            requiredMeaningScene: true,
            semanticSceneId: FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES.FIRST_TRIAL_AFTERMATH_MEANING,
            occurrenceOwner: "FIRST_RUN",
            dedupeKey: FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES.FIRST_TRIAL_AFTERMATH_MEANING
        });
    }

    getMinimumRequirements({ reason, state } = {}) {
        if (!this.enabled || !state) return [];

        const verse = Number.isInteger(state.turn) ? state.turn : 1;

        if (reason === OFFERING_GENERATION_REASONS.INITIAL && verse === 1) {
            return [Object.freeze({
                id: "FIRST_RUN_PLAYABLE_LAND",
                category: "LAND",
                minCount: 1,
                requirePlaceable: true
            })];
        }

        if (
            reason === OFFERING_GENERATION_REASONS.VERSE_START
            && verse >= this.investigationGuaranteeVerse
            && state.investigationUnlocked === true
        ) {
            return [Object.freeze({
                id: "FIRST_RUN_INVESTIGATION",
                category: "INVESTIGATION",
                minCount: 1
            })];
        }

        return [];
    }
}

export default FirstRunService;
