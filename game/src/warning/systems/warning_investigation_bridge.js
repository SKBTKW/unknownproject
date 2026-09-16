import { GAME_FACT_TYPES } from "../../core/game_fact.js";

/**
 * Advances Warning to WATCH when the player successfully commits an
 * investigation action. Runs that skip investigation may advance from OMEN
 * directly to a later semantic state through another policy/bridge.
 */
export class WarningInvestigationBridge {
    constructor({ gameFactHub, warningStateService } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("WARNING_INVESTIGATION_FACT_HUB_REQUIRED");
        }
        if (!warningStateService || typeof warningStateService.markWatch !== "function") {
            throw new TypeError("WARNING_INVESTIGATION_STATE_SERVICE_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.warningStateService = warningStateService;
        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.INVESTIGATION_RECORDED) return;
        this.warningStateService.markWatch({
            source: "INVESTIGATION_RECORDED",
            verse: Number.isInteger(fact.payload?.verse) ? fact.payload.verse : null
        });
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default WarningInvestigationBridge;
