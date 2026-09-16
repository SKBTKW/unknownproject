import { GAME_FACT_TYPES } from "../../core/game_fact.js";

function normalizeTrialIndex(value) {
    const normalized = Math.floor(Number(value));
    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new TypeError("TRIAL_DUE_INDEX_INVALID");
    }
    return normalized;
}

/**
 * Converts the exact internal Trial clock into an exactly-once pending start
 * request at Verse boundaries.
 *
 * This service never opens UI and never exposes the scheduled Verse/countdown.
 * Presentation receives only the Trial index that is ready to start.
 */
export class TrialDueStateService {
    constructor({ gameFactHub, timingAuthority } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("TRIAL_DUE_FACT_HUB_REQUIRED");
        }
        if (!timingAuthority
            || typeof timingAuthority.isCurrentTrialDue !== "function"
            || typeof timingAuthority.getCurrentTrialIndex !== "function") {
            throw new TypeError("TRIAL_DUE_TIMING_AUTHORITY_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.timingAuthority = timingAuthority;
        this.pendingRequest = null;
        this.acknowledgedTrialIndexes = new Set();
        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.VERSE_COMMITTED) return;
        const nextVerse = Number.isInteger(fact.payload?.nextTurn)
            ? fact.payload.nextTurn
            : null;
        if (nextVerse === null) return;
        this.evaluateForVerse(nextVerse);
    }

    evaluateForVerse(verse) {
        if (!Number.isInteger(verse) || verse < 1) {
            throw new TypeError("TRIAL_DUE_VERSE_INVALID");
        }
        if (!this.timingAuthority.isCurrentTrialDue(verse)) {
            return this.getPendingRequest();
        }

        const trialIndex = normalizeTrialIndex(this.timingAuthority.getCurrentTrialIndex());
        if (this.acknowledgedTrialIndexes.has(trialIndex)) {
            return this.getPendingRequest();
        }
        if (this.pendingRequest?.trialIndex === trialIndex) {
            return this.getPendingRequest();
        }

        this.pendingRequest = Object.freeze({ trialIndex });
        return this.getPendingRequest();
    }

    getPendingRequest() {
        return this.pendingRequest ? { ...this.pendingRequest } : null;
    }

    acknowledgePending(trialIndex) {
        const normalized = normalizeTrialIndex(trialIndex);
        if (!this.pendingRequest || this.pendingRequest.trialIndex !== normalized) {
            return { success: false, reason: "TRIAL_DUE_PENDING_MISMATCH" };
        }

        this.acknowledgedTrialIndexes.add(normalized);
        this.pendingRequest = null;
        return { success: true, trialIndex: normalized };
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrialDueStateService;
