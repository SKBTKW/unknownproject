function toDefense(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export const TRIAL_DEFENSE_RESERVATION_REASONS = Object.freeze({
    DEFENSE_BOUNDARY_UNAVAILABLE: "DEFENSE_BOUNDARY_UNAVAILABLE",
    INVALID_DEFENSE_AMOUNT: "INVALID_DEFENSE_AMOUNT",
    INSUFFICIENT_DEFENSE: "INSUFFICIENT_DEFENSE",
    DEFENSE_RESERVATION_FAILED: "DEFENSE_RESERVATION_FAILED",
    DEFENSE_ROLLBACK_FAILED: "DEFENSE_ROLLBACK_FAILED"
});

/**
 * Adapter around the normal GameState / DefenseSystem defense pool.
 *
 * Trial Core never mutates state.currentDefense directly. It only asks this
 * boundary to reserve or restore defense through the GameEngine facade.
 */
export class TrialDefenseReservation {
    constructor({
        getAvailableDefense = null,
        applyDefenseLoss = null,
        recoverDefense = null
    } = {}) {
        this.getAvailableDefense = typeof getAvailableDefense === "function"
            ? getAvailableDefense
            : null;
        this.applyDefenseLoss = typeof applyDefenseLoss === "function"
            ? applyDefenseLoss
            : null;
        this.recoverDefense = typeof recoverDefense === "function"
            ? recoverDefense
            : null;
    }

    isAvailable() {
        return Boolean(
            this.getAvailableDefense
            && this.applyDefenseLoss
            && this.recoverDefense
        );
    }

    readBalance() {
        if (!this.isAvailable()) return null;
        return toDefense(this.getAvailableDefense());
    }

    canReserve(amount) {
        if (!this.isAvailable()) {
            return {
                reservable: false,
                reasons: [TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_BOUNDARY_UNAVAILABLE],
                balance: null
            };
        }
        if (!Number.isInteger(amount) || amount < 0) {
            return {
                reservable: false,
                reasons: [TRIAL_DEFENSE_RESERVATION_REASONS.INVALID_DEFENSE_AMOUNT],
                balance: this.readBalance()
            };
        }
        const balance = this.readBalance();
        const reasons = balance < amount
            ? [TRIAL_DEFENSE_RESERVATION_REASONS.INSUFFICIENT_DEFENSE]
            : [];
        return {
            reservable: reasons.length === 0,
            reasons,
            balance
        };
    }

    reserve(amount) {
        const check = this.canReserve(amount);
        if (!check.reservable) {
            return {
                success: false,
                reasons: check.reasons,
                before: check.balance,
                after: check.balance,
                reserved: 0
            };
        }

        const before = check.balance;
        const result = this.applyDefenseLoss(amount);
        const after = this.readBalance();
        const reduced = toDefense(result?.reduced ?? (before - after));
        if (reduced !== amount || after !== before - amount) {
            return {
                success: false,
                reasons: [TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_RESERVATION_FAILED],
                before,
                after,
                reserved: reduced
            };
        }

        return {
            success: true,
            before,
            after,
            reserved: amount
        };
    }

    rollback(reservation) {
        const amount = toDefense(reservation?.reserved);
        if (amount === 0) {
            return { success: true, restored: 0, before: this.readBalance(), after: this.readBalance() };
        }
        if (!this.isAvailable()) {
            return {
                success: false,
                reason: TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_BOUNDARY_UNAVAILABLE
            };
        }

        const before = this.readBalance();
        const result = this.recoverDefense(amount);
        const after = this.readBalance();
        const restored = toDefense(result?.recovered ?? (after - before));
        if (restored !== amount || after !== before + amount) {
            return {
                success: false,
                reason: TRIAL_DEFENSE_RESERVATION_REASONS.DEFENSE_ROLLBACK_FAILED,
                restored,
                before,
                after
            };
        }
        return { success: true, restored: amount, before, after };
    }
}

export default TrialDefenseReservation;
