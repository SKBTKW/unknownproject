function clampCount(value, max) {
    if (!Number.isFinite(Number(value))) return 0;
    return Math.max(0, Math.min(max, Math.floor(Number(value))));
}

function fallbackShuffle(items, randomService) {
    const copy = items.map(item => ({ ...item }));
    if (randomService?.shuffle) return randomService.shuffle(copy);
    if (randomService?.nextInt) {
        for (let i = copy.length - 1; i > 0; i--) {
            const j = randomService.nextInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
    return copy;
}

function resolveArmyStructure({ armyStructure, armyStructureResolver, threat, enemyTruth, trialIndex, gameState }) {
    if (armyStructure && typeof armyStructure === "object") return armyStructure;
    if (enemyTruth?.armyStructure && typeof enemyTruth.armyStructure === "object") {
        return enemyTruth.armyStructure;
    }
    if (!armyStructureResolver || typeof armyStructureResolver.resolve !== "function") return null;
    return armyStructureResolver.resolve({
        strategicSuppression: threat?.strategicSuppression ?? enemyTruth?.strategicSuppression ?? 0,
        trialIndex,
        enemyTruth,
        gameState
    });
}

/**
 * 合法な侵入口候補から今回Trialの確定侵入口を選ぶ。
 *
 * 原則:
 * - armyStructure がある場合、route数 = 部隊数。
 * - 高Lv指揮官の侵入口判断は ingressScoreResolver 経由のみで行う。
 * - 判断能力が無い、または評価resolver未接続ならランダム選択へfallback。
 * - Warning / KnownEnemyState は参照しない。
 *
 * countResolver は旧/診断互換のfallbackとしてのみ残す。
 */
export class TrialIngressSelectionPolicy {
    constructor({
        countResolver = null,
        armyStructureResolver = null,
        ingressScoreResolver = null,
        randomService = null
    } = {}) {
        this.countResolver = countResolver;
        this.armyStructureResolver = armyStructureResolver;
        this.ingressScoreResolver = ingressScoreResolver;
        this.randomService = randomService;
    }

    select({
        candidates = [],
        trialIndex = 1,
        gameState = null,
        threat = null,
        enemyTruth = null,
        armyStructure = null
    } = {}) {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];

        const resolvedArmy = resolveArmyStructure({
            armyStructure,
            armyStructureResolver: this.armyStructureResolver,
            threat,
            enemyTruth,
            trialIndex,
            gameState
        });

        const requestedCount = resolvedArmy?.routeCount ?? resolvedArmy?.forceCount ?? (
            typeof this.countResolver === "function"
                ? this.countResolver({ trialIndex, gameState, threat, candidateCount: candidates.length })
                : 0
        );
        const count = clampCount(requestedCount, candidates.length);
        if (count === 0) return [];

        const rng = this.randomService || gameState?.engine?.gameplayRandom || null;
        const commanderCanJudge = Boolean(resolvedArmy?.commander?.capabilities?.ingressJudgement);
        const canScore = commanderCanJudge && typeof this.ingressScoreResolver === "function";

        if (canScore) {
            // Shuffle first so equal-score candidates remain gameplay-RNG driven
            // instead of inheriting board scan order as a hidden preference.
            const ranked = fallbackShuffle(candidates, rng)
                .map((candidate, index) => ({
                    candidate: { ...candidate },
                    index,
                    score: Number(this.ingressScoreResolver({
                        candidate: { ...candidate },
                        candidates: candidates.map(item => ({ ...item })),
                        armyStructure: resolvedArmy,
                        commander: resolvedArmy.commander,
                        trialIndex,
                        gameState,
                        threat,
                        enemyTruth
                    }))
                }))
                .filter(entry => Number.isFinite(entry.score))
                .sort((a, b) => b.score - a.score || a.index - b.index);

            if (ranked.length >= count) {
                return ranked.slice(0, count).map(entry => ({ ...entry.candidate }));
            }
        }

        const ordered = fallbackShuffle(candidates, rng);
        return ordered.slice(0, count).map(candidate => ({ ...candidate }));
    }
}

export default TrialIngressSelectionPolicy;
