function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * TrueEnemyStateのread-only projection。
 * Investigation / TrialScenarioFactoryはこの境界だけを読む。
 * 呼び出し側が返却値を書き換えてもSSOTには影響しない。
 */
export class EnemyTruthReadModel {
    constructor(source) {
        if (!source || typeof source.getSnapshot !== "function") {
            throw new TypeError("ENEMY_TRUTH_SOURCE_REQUIRED");
        }
        this.source = source;
    }

    getSnapshot() {
        return cloneData(this.source.getSnapshot());
    }
}

export default EnemyTruthReadModel;
