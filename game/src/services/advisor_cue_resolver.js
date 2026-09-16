import { GAME_FACT_TYPES } from "../core/game_fact.js";
import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";

// Converts already-committed game facts into advisor-facing semantic scenes.
// It must not inspect DOM state, mutate game state, or infer facts the game does not own.
export class AdvisorCueResolver {
    resolve(fact) {
        if (!fact || typeof fact.type !== "string") return null;

        switch (fact.type) {
        case GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED:
            return {
                type: ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED,
                payload: fact.payload || {}
            };

        case GAME_FACT_TYPES.TRIAL_RESULT_SETTLED:
            return this.resolveTrialResultSettled(fact.payload || {});

        default:
            return null;
        }
    }

    resolveTrialResultSettled(payload) {
        const outcome = payload?.outcome;
        const settlement = payload?.settlement || {};
        const result = payload?.result || {};

        if (outcome === "FAILED" || settlement.runTerminated === true) {
            return {
                type: ADVISOR_SCENES.GAME_OVER,
                payload
            };
        }

        if (outcome !== "SURVIVED") return null;

        // These two scenes are purely objective: the Trial-owned result says whether
        // the Last Ember actually took damage. Richer labels such as pyrrhic victory,
        // civilian loss, or desperate stand remain undefined until game-owned facts exist.
        const totalEmberDamage = Number(result.totalEmberDamage);
        if (Number.isFinite(totalEmberDamage)) {
            return {
                type: totalEmberDamage === 0
                    ? ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED
                    : ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED,
                payload
            };
        }

        // Backward-compatible fallback for older / synthetic facts without result data.
        return {
            type: ADVISOR_SCENES.TRIAL_COMPLETED,
            payload
        };
    }
}

export default AdvisorCueResolver;
