import {
    BATTLE_CAUSE_TYPES,
    BATTLE_CAUSAL_EVENT_TYPES
} from "../domain/battle_causality_types.js";

const EVENT_BY_CAUSE = Object.freeze({
    [BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_DEPLOYMENT_LIMITED,
    [BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_RESERVE_NOT_COMMITTED,
    [BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE]: BATTLE_CAUSAL_EVENT_TYPES.TERRAIN_POSITION_ADVANTAGE,
    [BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY]: BATTLE_CAUSAL_EVENT_TYPES.HUMAN_LOCAL_SUPERIORITY_ESTABLISHED,
    [BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE]: BATTLE_CAUSAL_EVENT_TYPES.HUMAN_PRESSURE_MAINTAINED
});

export class BattleCausalEventResolver {
    resolve(causes = []) {
        return causes
            .map(row => {
                const type = EVENT_BY_CAUSE[row?.type];
                if (!type) return null;
                return {
                    type,
                    sourceFacts: [...(row.sourceFacts || [])],
                    sourceCauses: [row.type, ...(row.sourceCauses || [])],
                    severity: "NORMAL",
                    tags: [...(row.tags || [])],
                    payload: row.payload ? JSON.parse(JSON.stringify(row.payload)) : {}
                };
            })
            .filter(Boolean);
    }
}

export default BattleCausalEventResolver;
