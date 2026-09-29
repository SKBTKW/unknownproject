import { BATTLE_CAUSE_TYPES } from "../domain/battle_causality_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function hasCause(causes, type) {
    return causes.some(row => row?.type === type);
}

export class BattleNormalOutcomeProjector {
    project({ battlefieldContext = {}, causes = [], battleState = null } = {}) {
        const reserve = Number(battlefieldContext.enemy?.reserveSuppression) || 0;
        const favorableCauses = causes.filter(row => row?.tags?.includes("FAVORABLE")).map(row => row.type);
        const dangerCauses = causes.filter(row => row?.tags?.includes("DANGER")).map(row => row.type);

        return {
            outcome: battlefieldContext.combat?.outcome || null,
            margin: battlefieldContext.combat?.margin ?? null,
            humanFinalPower: battlefieldContext.human?.finalPower ?? null,
            enemyFinalPower: battlefieldContext.combat?.enemyFinalPower ?? null,
            damageToSuppression: battlefieldContext.combat?.damageToSuppression ?? null,
            remainingSuppression: battlefieldContext.combat?.remainingSuppression ?? null,
            remainingForceSuppression: battlefieldContext.combat?.remainingForceSuppression ?? null,

            engagedPower: {
                human: battlefieldContext.human?.finalPower ?? null,
                enemy: battlefieldContext.combat?.enemyFinalPower ?? null
            },
            enemyLoss: {
                suppressionDamage: battlefieldContext.combat?.damageToSuppression ?? null
            },
            humanLoss: null,
            battleControl: battlefieldContext.combat?.outcome || null,
            postBattleState: cloneData(battleState),
            exploitationPotential: null,

            favorableCauses,
            dangerCauses,
            localAdvantage: hasCause(causes, BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY),
            deploymentState: hasCause(causes, BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED)
                ? "CONSTRAINED"
                : "NORMAL",
            reserveState: hasCause(causes, BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK)
                ? "HELD_BACK"
                : (reserve > 0 ? "PRESENT" : "NONE"),
            suppression: {
                strategic: battlefieldContext.enemy?.strategicSuppression ?? null,
                deployed: battlefieldContext.enemy?.deployedSuppression ?? null,
                reserve: battlefieldContext.enemy?.reserveSuppression ?? null
            },
            appliedModifiers: cloneData(battlefieldContext.combat?.appliedModifiers || []),
            terrainEvents: cloneData(battlefieldContext.combat?.terrainEvents || [])
        };
    }
}

export default BattleNormalOutcomeProjector;
