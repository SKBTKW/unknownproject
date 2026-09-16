import { GAME_FACT_TYPES } from "../../core/game_fact.js";

/**
 * Advances the exact internal Trial clock only from confirmed Trial settlement.
 *
 * Reaching a scheduled Verse, changing Stage, opening Trial UI, or completing a
 * battle must not advance the timing authority. Settlement is the progression
 * boundary.
 */
export class TrialTimingFactBridge {
    constructor({ gameFactHub, timingAuthority } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("TRIAL_TIMING_FACT_HUB_REQUIRED");
        }
        if (!timingAuthority || typeof timingAuthority.markTrialSettled !== "function") {
            throw new TypeError("TRIAL_TIMING_AUTHORITY_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.timingAuthority = timingAuthority;
        this.lastSettlement = null;
        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;

        const trialIndex = Number(fact.payload?.trialIndex);
        if (!Number.isInteger(trialIndex) || trialIndex < 1) {
            throw new Error("TRIAL_TIMING_SETTLEMENT_FACT_INDEX_REQUIRED");
        }

        const readModel = this.timingAuthority.markTrialSettled(trialIndex);
        this.lastSettlement = Object.freeze({
            trialIndex,
            scenarioId: fact.payload?.scenarioId || null,
            outcome: fact.payload?.outcome || null,
            currentTrialIndex: readModel.currentTrialIndex,
            nextScheduledVerse: readModel.nextScheduledVerse
        });
    }

    getLastSettlement() {
        return this.lastSettlement ? { ...this.lastSettlement } : null;
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrialTimingFactBridge;
