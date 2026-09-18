import { GAME_FACT_TYPES } from "../../core/game_fact.js";

/**
 * Publishes semantic Warning state transitions onto the shared GameFactHub.
 *
 * Payload intentionally contains only semantic state information. Exact Trial
 * distance/timing remains private to WarningTimingBridge / timing authority.
 */
export class WarningStateFactBridge {
    constructor({ gameFactHub, warningStateService } = {}) {
        if (!gameFactHub || typeof gameFactHub.emit !== "function") {
            throw new TypeError("WARNING_STATE_FACT_HUB_REQUIRED");
        }
        if (!warningStateService || typeof warningStateService.subscribe !== "function") {
            throw new TypeError("WARNING_STATE_FACT_SERVICE_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.warningStateService = warningStateService;
        this.unsubscribe = this.warningStateService.subscribe(transition => {
            if (!transition?.current) return;
            this.gameFactHub.emit(GAME_FACT_TYPES.WARNING_STATE_CHANGED, {
                previous: transition.previous || null,
                current: transition.current,
                revision: Number.isInteger(transition.revision) ? transition.revision : null,
                source: transition.source || null,
                verse: Number.isInteger(transition.verse) ? transition.verse : null
            });
        });
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default WarningStateFactBridge;
