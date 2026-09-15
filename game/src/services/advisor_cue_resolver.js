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

        // The current Trial result contract only guarantees SURVIVED / FAILED here.
        // Do not manufacture richer meanings (pyrrhic, civilian loss, clean victory)
        // until those facts are explicitly present in the game-owned payload.
        if (outcome === "FAILED" || settlement.runTerminated === true) {
            return {
                type: ADVISOR_SCENES.GAME_OVER,
                payload
            };
        }

        if (outcome === "SURVIVED") {
            return {
                type: ADVISOR_SCENES.TRIAL_COMPLETED,
                payload
            };
        }

        return null;
    }
}

export default AdvisorCueResolver;
