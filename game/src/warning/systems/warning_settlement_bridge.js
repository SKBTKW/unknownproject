import { GAME_FACT_TYPES } from "../../core/game_fact.js";

/**
 * Resets semantic Warning state only after a Trial result is settled.
 *
 * Trial completion alone is not enough: settlement is the lifecycle boundary
 * that also advances the exact timing authority.
 */
export class WarningSettlementBridge {
    constructor({ gameFactHub, warningStateService } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("WARNING_SETTLEMENT_FACT_HUB_REQUIRED");
        }
        if (!warningStateService || typeof warningStateService.resetForNextTrial !== "function") {
            throw new TypeError("WARNING_SETTLEMENT_STATE_SERVICE_REQUIRED");
        }

        this.gameFactHub = gameFactHub;
        this.warningStateService = warningStateService;
        this.unsubscribe = this.gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;
        this.warningStateService.resetForNextTrial({
            source: "TRIAL_RESULT_SETTLED",
            verse: Number.isInteger(fact.payload?.settlement?.settledTurn)
                ? fact.payload.settlement.settledTurn
                : null
        });
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default WarningSettlementBridge;
