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

/**
 * 合法な侵入口候補から、今回Trialの確定侵入口を選ぶポリシー。
 *
 * 侵入口数はゲームデザイン未確定のため countResolver に委譲する。
 * Warning / Intel は入力契約に含めない。
 */
export class TrialIngressSelectionPolicy {
    constructor({
        countResolver = null,
        randomService = null
    } = {}) {
        this.countResolver = countResolver;
        this.randomService = randomService;
    }

    select({ candidates = [], trialIndex = 1, gameState = null, threat = null } = {}) {
        if (!Array.isArray(candidates) || candidates.length === 0) return [];
        if (typeof this.countResolver !== "function") return [];

        const requestedCount = this.countResolver({
            trialIndex,
            gameState,
            threat,
            candidateCount: candidates.length
        });
        const count = clampCount(requestedCount, candidates.length);
        if (count === 0) return [];

        const rng = this.randomService || gameState?.engine?.gameplayRandom || null;
        const ordered = fallbackShuffle(candidates, rng);
        return ordered.slice(0, count).map(candidate => ({ ...candidate }));
    }
}

export default TrialIngressSelectionPolicy;
