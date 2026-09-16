import {
    MODIFIER_OPERATIONS,
    MODIFIER_PHASES
} from "../domain/trial_types.js";

const VALID_PHASES = new Set(Object.values(MODIFIER_PHASES));

function normalizeValue(value) {
    return Math.round(Math.max(0, value) * 100) / 100;
}

export class TrialModifierCalculator {
    apply(baseValue, modifiers = []) {
        const ordered = modifiers
            .map((modifier, index) => ({ ...modifier, _index: index }))
            .sort((a, b) => (a.phase - b.phase) || ((a.priority || 0) - (b.priority || 0)) || (a._index - b._index));

        let value = normalizeValue(Number(baseValue) || 0);
        const breakdown = [];

        for (const modifier of ordered) {
            if (!VALID_PHASES.has(modifier.phase)) {
                throw new Error(`UNKNOWN_TRIAL_MODIFIER_PHASE:${modifier.phase}`);
            }
            const before = value;
            if (modifier.operation === MODIFIER_OPERATIONS.LIMIT_OVERFLOW) {
                const threshold = Math.max(0, Number(modifier.threshold) || 0);
                const efficiency = Math.max(0, Number(modifier.overflowEfficiency) || 0);
                value = value <= threshold
                    ? value
                    : threshold + ((value - threshold) * efficiency);
            } else if (modifier.operation === MODIFIER_OPERATIONS.MULTIPLY) {
                value *= Math.max(0, Number(modifier.value) || 0);
            } else {
                throw new Error(`UNKNOWN_TRIAL_MODIFIER_OPERATION:${modifier.operation}`);
            }
            value = normalizeValue(value);
            if (value !== before) {
                breakdown.push({ ...modifier, before, after: value });
            }
        }

        return { baseValue: normalizeValue(Number(baseValue) || 0), value, breakdown };
    }
}
