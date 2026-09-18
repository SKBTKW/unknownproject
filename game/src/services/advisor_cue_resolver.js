import { GAME_FACT_TYPES } from "../core/game_fact.js";
import { ADVISOR_SCENES } from "../data/advisor_scene_catalog.js";
import { WARNING_STATES, getWarningStateRank } from "../warning/domain/warning_state.js";

// Converts already-committed game facts into advisor-facing semantic scenes.
// It must not inspect DOM state, mutate game state, or infer facts the game does not own.
export class AdvisorCueResolver {
    resolve(fact) {
        if (!fact || typeof fact.type !== "string") return null;

        switch (fact.type) {
        case GAME_FACT_TYPES.WARNING_STATE_CHANGED:
            return this.resolveWarningStateChanged(fact.payload || {});

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

    resolveWarningStateChanged(payload) {
        const previousRank = getWarningStateRank(payload?.previous);
        const currentRank = getWarningStateRank(payload?.current);
        const tenseRank = getWarningStateRank(WARNING_STATES.TENSE);
        if (previousRank < 0 || currentRank < 0) return null;

        // React once when the semantic Warning state first crosses into the
        // high-alert window. A direct WATCH -> IMMINENT jump still qualifies,
        // while TENSE -> IMMINENT must not produce a duplicate warning line.
        if (previousRank < tenseRank && currentRank >= tenseRank) {
            return {
                type: ADVISOR_SCENES.TRIAL_WARNING,
                payload
            };
        }
        return null;
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

        // Trial owns the one-based trialIndex in TRIAL_RESULT_SETTLED. The final
        // Trial victory is therefore an objective semantic event and should take
        // precedence over the generic damaged/undamaged survival reactions.
        if (Number(payload?.trialIndex) === 3) {
            return {
                type: ADVISOR_SCENES.THIRD_TRIAL_VICTORY,
                payload
            };
        }

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
