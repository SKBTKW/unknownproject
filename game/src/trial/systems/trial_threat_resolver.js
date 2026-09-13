function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function resolveTrialBase(baseThreatByTrial, trialIndex) {
    if (!baseThreatByTrial || typeof baseThreatByTrial !== "object") return 0;
    return nonNegative(baseThreatByTrial[trialIndex]);
}

/**
 * 文明発展SnapshotをTrialのstrategicSuppressionへ変換する純粋resolver。
 *
 * 係数はまだバランス正本ではないため、constructor注入を前提とする。
 * デフォルトは全て0で、既存Trial挙動を暗黙に変更しない。
 */
export class TrialThreatResolver {
    constructor({
        baseThreatByTrial = {},
        territoryWeight = 0,
        completedZoneWeight = 0,
        linkWeight = 0,
        stageWeight = 0
    } = {}) {
        this.baseThreatByTrial = { ...baseThreatByTrial };
        this.territoryWeight = nonNegative(territoryWeight);
        this.completedZoneWeight = nonNegative(completedZoneWeight);
        this.linkWeight = nonNegative(linkWeight);
        this.stageWeight = nonNegative(stageWeight);
    }

    resolve({ trialIndex = 1, development = {} } = {}) {
        const normalizedTrialIndex = Math.max(1, Math.floor(Number(trialIndex) || 1));
        const stage = Math.max(1, Math.floor(Number(development.stage) || 1));
        const territoryTiles = nonNegative(development.territoryTiles);
        const completedZones = nonNegative(development.completedZones);
        const links = nonNegative(development.links);

        const breakdown = {
            baseThreat: resolveTrialBase(this.baseThreatByTrial, normalizedTrialIndex),
            territoryThreat: territoryTiles * this.territoryWeight,
            completedZoneThreat: completedZones * this.completedZoneWeight,
            linkThreat: links * this.linkWeight,
            stageThreat: Math.max(0, stage - 1) * this.stageWeight
        };

        const strategicSuppression = Object.values(breakdown)
            .reduce((sum, value) => sum + nonNegative(value), 0);

        return {
            strategicSuppression,
            breakdown: Object.freeze({ ...breakdown })
        };
    }
}
