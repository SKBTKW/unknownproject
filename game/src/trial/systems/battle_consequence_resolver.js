import {
    BATTLE_CAUSE_TYPES,
    BATTLE_CONSEQUENCE_TYPES
} from "../domain/battle_causality_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function consequenceId(type, index) {
    return `battle-consequence:${type}:${index}`;
}

export class BattleConsequenceResolver {
    resolve(causes = []) {
        const consequences = [];

        for (const cause of causes) {
            if (cause?.type !== BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED) continue;
            consequences.push({
                consequenceId: consequenceId(BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED, consequences.length),
                type: BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED,
                sourceCauses: [cause.causeId || cause.type],
                sourceFacts: [...(cause.sourceFacts || [])],
                sourceAction: cause.sourceAction || null,
                target: cause.target || "ENEMY_FORCE",
                payload: {
                    mobility: cause.payload?.mobility ?? null,
                    equipmentMobility: cause.payload?.equipmentMobility ?? null
                },
                resultingState: {
                    supportDelay: "DELAYED"
                },
                persistence: "BATTLE",
                resolved: true,
                derivedFrom: [cause.causeId || cause.type],
                severity: cause.severity ?? 1,
                presentationPriority: cause.presentationPriority ?? 0,
                tags: [...(cause.tags || [])]
            });
        }

        return cloneData(consequences);
    }
}

export default BattleConsequenceResolver;
