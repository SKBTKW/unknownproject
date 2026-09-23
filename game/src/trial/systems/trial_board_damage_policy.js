import { TRIAL_OUTCOMES } from "../domain/trial_types.js";
import { BOARD_DAMAGE_TARGETS } from "../../core/board_damage_service.js";

export class TrialBoardDamagePolicy {
    resolve({ battle, cell } = {}) {
        const outcome = battle?.outcome || null;
        if (!outcome || outcome === TRIAL_OUTCOMES.REPEL) {
            return Object.freeze({ shouldRecord: false, targets: Object.freeze([]) });
        }
        if (outcome !== TRIAL_OUTCOMES.EXACT && outcome !== TRIAL_OUTCOMES.BREAKTHROUGH) {
            return Object.freeze({ shouldRecord: false, targets: Object.freeze([]) });
        }

        const targets = [BOARD_DAMAGE_TARGETS.LAND];
        if (cell?.specialBlock) targets.push(BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK);

        return Object.freeze({
            shouldRecord: true,
            targets: Object.freeze(targets),
            reason: "ENEMY_NOT_REPELLED"
        });
    }
}

export default TrialBoardDamagePolicy;
