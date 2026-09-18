function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

/**
 * 高レベル指揮官が侵入口候補を比較する最小production heuristic。
 *
 * 現段階では「未開発外周」と「局所防衛値の低さ」だけを評価する。
 * 将来の盤面全体分析・部隊属性最適化は additionalScoreResolver へ委譲する。
 * Warning / KnownEnemyState / presentation は参照しない。
 */
export class TrialIngressJudgementResolver {
    constructor({
        unplacedBonus = 10,
        localDefensePenalty = 1,
        additionalScoreResolver = null
    } = {}) {
        this.unplacedBonus = Number(unplacedBonus) || 0;
        this.localDefensePenalty = nonNegative(localDefensePenalty);
        this.additionalScoreResolver = additionalScoreResolver;
    }

    resolve({ candidate = null, gameState = null, ...context } = {}) {
        if (!candidate) return 0;
        const cell = gameState?.grid?.[candidate.r]?.[candidate.c] || null;
        const localDefense = nonNegative(
            cell?.terrain?.yields?.defense
            ?? cell?.terrain?.defense
            ?? cell?.defense
            ?? 0
        );
        let score = candidate.placed === true ? 0 : this.unplacedBonus;
        score -= localDefense * this.localDefensePenalty;

        if (typeof this.additionalScoreResolver === "function") {
            const additional = Number(this.additionalScoreResolver({
                candidate,
                gameState,
                ...context
            }));
            if (Number.isFinite(additional)) score += additional;
        }
        return score;
    }
}

export default TrialIngressJudgementResolver;
