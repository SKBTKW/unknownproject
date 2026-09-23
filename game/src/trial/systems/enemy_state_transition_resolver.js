import { EnemyArmyStructureResolver } from "./enemy_army_structure_resolver.js";
import { EnemyTruthObservableResolver } from "./enemy_truth_observable_resolver.js";

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Threatの確定値をEnemy Truthの軍構造へ変換する標準遷移。
 * Warning / KnownEnemyState / presentation は参照しない。
 */
export function createEnemyStateTransitionResolver({
    armyStructureResolver = new EnemyArmyStructureResolver(),
    observableResolver = new EnemyTruthObservableResolver()
} = {}) {
    return ({ previousEnemyState = null, currentThreat = null, verse = null, trialIndex = 1 } = {}) => {
        if (!currentThreat || typeof currentThreat !== "object") return null;
        const strategicSuppression = nonNegative(currentThreat.strategicSuppression);
        const armyStructure = armyStructureResolver.resolve({
            strategicSuppression,
            trialIndex,
            enemyTruth: previousEnemyState
        });

        const observable = observableResolver?.resolve?.({
            armyStructure,
            previousEnemyState,
            trialIndex
        }) ?? null;

        return {
            trialIndex,
            strategicSuppression,
            commander: cloneData(armyStructure.commander),
            forces: cloneData(armyStructure.forces),
            armyStructure: cloneData(armyStructure),
            observable: cloneData(observable),
            lastTransition: {
                type: "THREAT_TO_ARMY_STRUCTURE",
                verse: Number.isFinite(Number(verse)) ? Number(verse) : null
            }
        };
    };
}

export default createEnemyStateTransitionResolver;
