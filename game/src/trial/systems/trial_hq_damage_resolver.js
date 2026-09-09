import { TRIAL_PLAN_REASONS, DEFAULT_TRIAL_RULES } from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

/**
 * ====================================================================
 * TrialHqDamageResolver (Mobile & Unity Ready)
 * Pure domain calculation of HQ / Ember damage upon route end traversal.
 * ====================================================================
 */
export class TrialHqDamageResolver {
    constructor({
        suppressionConversionRate = DEFAULT_TRIAL_RULES.suppressionConversionRate
    } = {}) {
        this.suppressionConversionRate = nonNegative(suppressionConversionRate) || 5;
    }

    calculateDamage(sourcePower, conversionRate = this.suppressionConversionRate) {
        const power = nonNegative(sourcePower);
        const rate = nonNegative(conversionRate) || this.suppressionConversionRate || 5;
        if (power <= 0) return 0;
        return Math.ceil(power / rate);
    }

    resolve({
        battleIndex,
        routeId = null,
        traversalResult = null,
        battleResult = null,
        emberBefore = 20,
        conversionRate = this.suppressionConversionRate
    } = {}) {
        if (!traversalResult || typeof traversalResult !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }

        if (!traversalResult.reachedRouteEnd) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE] };
        }

        if (traversalResult.damageApplied) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED] };
        }

        if (!battleResult || typeof battleResult !== "object") {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_DAMAGE_SOURCE] };
        }

        const effectiveBattleIndex = (typeof battleIndex === "number")
            ? battleIndex
            : (traversalResult.battleIndex ?? null);

        const effectiveRouteId = routeId || traversalResult.routeId || null;

        // Source residual power (remaining suppression in trial combat scale)
        let sourcePower = 0;
        if (typeof battleResult.remainingSuppression === "number") {
            sourcePower = nonNegative(battleResult.remainingSuppression);
        } else {
            const enemyPower = nonNegative(battleResult.enemyActualPower ?? battleResult.enemy?.finalPower);
            const playerPower = nonNegative(battleResult.playerActualPower ?? battleResult.human?.finalPower);
            sourcePower = Math.max(0, enemyPower - playerPower);
        }

        const before = nonNegative(emberBefore);
        const rate = nonNegative(conversionRate) || this.suppressionConversionRate || 5;
        const emberDamage = this.calculateDamage(sourcePower, rate);
        const emberAfter = Math.max(0, before - emberDamage);

        const damageResult = {
            battleIndex: effectiveBattleIndex,
            routeId: effectiveRouteId,
            reachedRouteEnd: true,
            sourcePower,
            conversionRate: rate,
            emberBefore: before,
            emberDamage,
            emberAfter,
            damageApplied: true
        };

        return {
            success: true,
            damageResult: cloneData(damageResult)
        };
    }
}
