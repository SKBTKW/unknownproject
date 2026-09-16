import { GAME_FACT_TYPES } from "../../core/game_fact.js";

export const DEFAULT_TENSE_DISTANCE = 5;
export const DEFAULT_IMMINENT_DISTANCE = 1;

function normalizeDistanceThreshold(value, field) {
    const normalized = Math.floor(Number(value));
    if (!Number.isInteger(normalized) || normalized < 0) {
        throw new TypeError(`WARNING_TIMING_${field}_INVALID`);
    }
    return normalized;
}

/**
 * Converts the exact internal Trial clock into semantic Warning progression.
 *
 * Exact remaining Verse counts stay inside this bridge. The Warning state
 * service receives only TENSE / IMMINENT transitions, so Advisor/UI code cannot
 * recover a countdown from the Warning read model.
 */
export class WarningTimingBridge {
    constructor({
        gameFactHub,
        timingAuthority,
        warningStateService,
        tenseDistance = DEFAULT_TENSE_DISTANCE,
        imminentDistance = DEFAULT_IMMINENT_DISTANCE
    } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("WARNING_TIMING_FACT_HUB_REQUIRED");
        }
        if (!timingAuthority || typeof timingAuthority.getDistanceToNextTrial !== "function") {
            throw new TypeError("WARNING_TIMING_AUTHORITY_REQUIRED");
        }
        if (!warningStateService
            || typeof warningStateService.markTense !== "function"
            || typeof warningStateService.markImminent !== "function") {
            throw new TypeError("WARNING_TIMING_STATE_SERVICE_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.timingAuthority = timingAuthority;
        this.warningStateService = warningStateService;
        this.tenseDistance = normalizeDistanceThreshold(tenseDistance, "TENSE_DISTANCE");
        this.imminentDistance = normalizeDistanceThreshold(imminentDistance, "IMMINENT_DISTANCE");
        if (this.imminentDistance > this.tenseDistance) {
            throw new TypeError("WARNING_TIMING_THRESHOLD_ORDER_INVALID");
        }

        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.VERSE_COMMITTED) return;
        const nextVerse = Number.isInteger(fact.payload?.nextTurn)
            ? fact.payload.nextTurn
            : null;
        if (nextVerse === null) return;
        this.advanceForVerse(nextVerse);
    }

    advanceForVerse(verse) {
        if (!Number.isInteger(verse) || verse < 1) {
            throw new TypeError("WARNING_TIMING_VERSE_INVALID");
        }

        const distance = this.timingAuthority.getDistanceToNextTrial(verse);
        if (distance === null) {
            return { changed: false, state: this.warningStateService.getState?.() ?? null };
        }

        if (distance <= this.imminentDistance) {
            const result = this.warningStateService.markImminent({
                source: "TRIAL_TIMING_IMMINENT",
                verse
            });
            return { changed: Boolean(result?.changed), state: this.warningStateService.getState?.() ?? null };
        }

        if (distance <= this.tenseDistance) {
            const result = this.warningStateService.markTense({
                source: "TRIAL_TIMING_TENSE",
                verse
            });
            return { changed: Boolean(result?.changed), state: this.warningStateService.getState?.() ?? null };
        }

        return { changed: false, state: this.warningStateService.getState?.() ?? null };
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default WarningTimingBridge;
