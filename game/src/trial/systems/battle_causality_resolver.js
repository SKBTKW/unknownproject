import {
    BATTLE_FACT_TYPES,
    BATTLE_CAUSE_TYPES
} from "../domain/battle_causality_types.js";

const ROUGH_TERRAIN_FACTS = new Set([
    BATTLE_FACT_TYPES.TERRAIN_FOREST,
    BATTLE_FACT_TYPES.TERRAIN_DEEP_FOREST,
    BATTLE_FACT_TYPES.TERRAIN_WETLAND,
    BATTLE_FACT_TYPES.TERRAIN_HILL
]);

function byType(rows, type) {
    return rows.filter(row => row?.type === type);
}

function sourceTypes(rows) {
    return [...new Set(rows.map(row => row.type))];
}

function cause(type, { facts = [], causes = [], tags = [], payload = {} } = {}) {
    return {
        type,
        sourceFacts: sourceTypes(facts),
        sourceCauses: sourceTypes(causes),
        tags: [...tags],
        payload
    };
}

export class BattleCausalityResolver {
    resolve({ battlefieldContext = {}, facts = [] } = {}) {
        const causes = [];
        const constrainedFacts = byType(facts, BATTLE_FACT_TYPES.ENEMY_DEPLOYMENT_CONSTRAINED);
        if (constrainedFacts.length > 0) {
            const supporting = facts.filter(row =>
                ROUGH_TERRAIN_FACTS.has(row.type)
                || row.type === BATTLE_FACT_TYPES.ENEMY_LARGE_BODY
                || row.type === BATTLE_FACT_TYPES.ENEMY_HEAVY_EQUIPMENT
            );
            causes.push(cause(BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED, {
                facts: [...supporting, ...constrainedFacts],
                tags: ["FAVORABLE", "DEPLOYMENT"],
                payload: {
                    deployedSuppression: battlefieldContext.enemy?.deployedSuppression ?? null,
                    strategicSuppression: battlefieldContext.enemy?.strategicSuppression ?? null,
                    deploymentRatio: battlefieldContext.enemy?.deploymentRatio ?? null
                }
            }));
        }

        const reserveFacts = byType(facts, BATTLE_FACT_TYPES.ENEMY_RESERVE_PRESENT);
        if (reserveFacts.length > 0) {
            const deploymentCause = byType(causes, BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED);
            causes.push(cause(BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK, {
                facts: reserveFacts,
                causes: deploymentCause,
                tags: ["FAVORABLE", "RESERVE"],
                payload: {
                    reserveSuppression: battlefieldContext.enemy?.reserveSuppression ?? null
                }
            }));
        }

        const terrainAdvantageFacts = byType(facts, BATTLE_FACT_TYPES.HIGH_GROUND);
        const favorableTerrainModifier = (battlefieldContext.combat?.appliedModifiers || []).some(row => {
            const before = Number(row?.before);
            const after = Number(row?.after);
            if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
            return row.target === "HUMAN_INTERCEPTION"
                ? after > before
                : row.target === "ENEMY_SUPPRESSION" && after < before;
        });
        if (terrainAdvantageFacts.length > 0 || favorableTerrainModifier) {
            causes.push(cause(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE, {
                facts: terrainAdvantageFacts,
                tags: ["FAVORABLE", "TERRAIN"],
                payload: {
                    modifierSources: (battlefieldContext.combat?.appliedModifiers || [])
                        .map(row => row?.source)
                        .filter(Boolean)
                }
            }));
        }

        const humanPower = Number(battlefieldContext.human?.finalPower);
        const enemyPower = Number(battlefieldContext.combat?.enemyFinalPower);
        if (Number.isFinite(humanPower) && Number.isFinite(enemyPower) && humanPower > enemyPower) {
            causes.push(cause(BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY, {
                facts: facts.filter(row =>
                    row.type === BATTLE_FACT_TYPES.HUMAN_LOCAL_POWER_PRESENT
                    || row.type === BATTLE_FACT_TYPES.ENEMY_LOCAL_POWER_PRESENT
                ),
                tags: ["FAVORABLE", "LOCAL_POWER"],
                payload: { humanPower, enemyPower, localMargin: humanPower - enemyPower }
            }));
        }

        const localSuperiority = byType(causes, BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY);
        if (localSuperiority.length > 0 && Number(battlefieldContext.combat?.margin) > 0) {
            causes.push(cause(BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE, {
                causes: localSuperiority,
                tags: ["FAVORABLE", "PRESSURE"],
                payload: { margin: battlefieldContext.combat.margin }
            }));
        }

        return causes;
    }
}

export default BattleCausalityResolver;
