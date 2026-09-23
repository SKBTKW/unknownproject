function toAmount(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export const TRIAL_PAYMENT_REASONS = Object.freeze({
    RESOURCE_STATE_UNAVAILABLE: "RESOURCE_STATE_UNAVAILABLE",
    INVALID_COST: "INVALID_COST",
    INSUFFICIENT_FOOD: "INSUFFICIENT_FOOD",
    INSUFFICIENT_MATERIAL: "INSUFFICIENT_MATERIAL"
});

/**
 * Trial-only atomic payment boundary.
 *
 * The live GameState still owns the balances. This class centralizes Trial
 * writes so deployment code never scatters direct state.food/state.wood
 * mutations across controller/services.
 */
export class TrialResourcePayment {
    constructor({ state = null, stateProvider = null } = {}) {
        this.state = state || null;
        this.stateProvider = typeof stateProvider === "function" ? stateProvider : null;
    }

    _getState() {
        return this.stateProvider?.() || this.state || null;
    }

    readBalances() {
        const state = this._getState();
        if (!state) return null;
        return Object.freeze({
            food: toAmount(state.food),
            material: toAmount(state.wood ?? state.material)
        });
    }

    readAuditSnapshot() {
        const state = this._getState();
        if (!state) return null;
        return Object.freeze({
            food: toAmount(state.food),
            material: toAmount(state.wood ?? state.material),
            mystic: toAmount(state.mystic)
        });
    }

    canPay(cost = {}) {
        const balances = this.readBalances();
        if (!balances) {
            return {
                affordable: false,
                reasons: [TRIAL_PAYMENT_REASONS.RESOURCE_STATE_UNAVAILABLE],
                balances: null
            };
        }

        const food = Number(cost.food);
        const material = Number(cost.material);
        if (!Number.isFinite(food) || !Number.isFinite(material) || food < 0 || material < 0) {
            return {
                affordable: false,
                reasons: [TRIAL_PAYMENT_REASONS.INVALID_COST],
                balances
            };
        }

        const reasons = [];
        if (balances.food < food) reasons.push(TRIAL_PAYMENT_REASONS.INSUFFICIENT_FOOD);
        if (balances.material < material) reasons.push(TRIAL_PAYMENT_REASONS.INSUFFICIENT_MATERIAL);
        return {
            affordable: reasons.length === 0,
            reasons,
            balances
        };
    }

    pay(cost = {}) {
        const check = this.canPay(cost);
        if (!check.affordable) {
            return { success: false, reasons: check.reasons, balances: check.balances };
        }

        const state = this._getState();
        const food = toAmount(cost.food);
        const material = toAmount(cost.material);
        const before = this.readBalances();

        // Synchronous re-read immediately before mutation keeps this boundary
        // fail-closed if another subsystem changed a balance since canPay().
        const latest = this.canPay({ food, material });
        if (!latest.affordable) {
            return { success: false, reasons: latest.reasons, balances: latest.balances };
        }

        state.food = latest.balances.food - food;
        state.wood = latest.balances.material - material;
        // GameState currently keeps material as a compatibility alias.
        if ("material" in state) state.material = state.wood;

        return {
            success: true,
            paid: { food, material },
            before,
            after: this.readBalances()
        };
    }
}

export default TrialResourcePayment;
