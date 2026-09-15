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

        default:
            return null;
        }
    }
}

export default AdvisorCueResolver;
