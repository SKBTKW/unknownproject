import { MODIFIER_TARGETS } from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Read-only projection from an already-resolved normal Trial battle.
 *
 * It never predicts, re-resolves, or changes combat. It exposes only causal
 * facts that are present in the canonical battle result.
 */
export class TrialCausalityPresenter {
    project(battleResult) {
        if (!battleResult || typeof battleResult !== "object") {
            return Object.freeze({ available: false, modifiers: [], outcome: null });
        }

        const modifiers = Array.isArray(battleResult.appliedModifiers)
            ? battleResult.appliedModifiers
                .filter(row => row && Number.isFinite(Number(row.before)) && Number.isFinite(Number(row.after)))
                .map(row => Object.freeze({
                    source: row.source || null,
                    target: row.target || null,
                    before: Number(row.before),
                    after: Number(row.after),
                    favorable: row.target === MODIFIER_TARGETS.ENEMY_SUPPRESSION
                        ? Number(row.after) < Number(row.before)
                        : (row.target === MODIFIER_TARGETS.HUMAN_INTERCEPTION
                            ? Number(row.after) > Number(row.before)
                            : null)
                }))
            : [];

        return Object.freeze({
            available: true,
            modifiers: Object.freeze(modifiers),
            outcome: cloneData(battleResult.prediction?.outcome ?? null)
        });
    }
}

export default TrialCausalityPresenter;
