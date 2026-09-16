import { DEFAULT_TRIAL_RULES } from "../domain/trial_types.js";

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

export class InterceptionPowerResolver {
    constructor({
        defenseConversionRate = DEFAULT_TRIAL_RULES.defenseConversionRate,
        suppressionConversionRate = DEFAULT_TRIAL_RULES.suppressionConversionRate
    } = {}) {
        this.defenseConversionRate = nonNegative(defenseConversionRate);
        this.suppressionConversionRate = nonNegative(suppressionConversionRate);
    }

    resolveDefense(allocatedDefense) {
        return nonNegative(allocatedDefense) * this.defenseConversionRate;
    }

    resolveSuppression(strategicSuppression) {
        return nonNegative(strategicSuppression) * this.suppressionConversionRate;
    }
}

