import {
    BATTLE_CAUSE_TYPES,
    BATTLE_CAUSAL_EVENT_TYPES
} from "../domain/battle_causality_types.js";

const EVENT_BY_CAUSE = Object.freeze({
    [BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_DEPLOYMENT_LIMITED,
    [BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_MOVEMENT_LIMITED,
    [BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_RESERVE_NOT_COMMITTED,
    [BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE]: BATTLE_CAUSAL_EVENT_TYPES.TERRAIN_POSITION_ADVANTAGE,
    [BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY]: BATTLE_CAUSAL_EVENT_TYPES.HUMAN_LOCAL_SUPERIORITY_ESTABLISHED,
    [BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE]: BATTLE_CAUSAL_EVENT_TYPES.HUMAN_PRESSURE_MAINTAINED,
    [BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED]: BATTLE_CAUSAL_EVENT_TYPES.ENEMY_VANGUARD_ISOLATED
});

export class BattleCausalEventResolver {
    resolve(causes = []) {
        return causes
            .map(row => {
                const type = EVENT_BY_CAUSE[row?.type];
                if (!type) return null;
                return {
                    eventId: `battle-event:${row.causeId || row.type}`,
                    type,
                    category: row.category || null,
                    phase: row.phase || "NORMAL_BATTLE",
                    target: row.target || null,
                    sourceFacts: [...(row.sourceFacts || [])],
                    sourceAction: row.sourceAction || null,
                    sourceCauses: [row.causeId || row.type, ...(row.sourceCauses || [])],
                    derivedFrom: [...(row.derivedFrom || [])],
                    severity: row.severity ?? 1,
                    state: row.state || "ACTIVE",
                    tags: [...(row.tags || [])],
                    presentationPriority: row.presentationPriority ?? 0,
                    payload: row.payload ? JSON.parse(JSON.stringify(row.payload)) : {}
                };
            })
            .filter(Boolean);
    }
}

export default BattleCausalEventResolver;
