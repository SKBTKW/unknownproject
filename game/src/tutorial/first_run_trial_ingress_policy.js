const READABLE_TERRAIN_PRIORITY = Object.freeze({
    GL2_FOREST: 30,
    GL1_PLAINS: 25,
    E1_RECLAIMED_LAND: 25,
    E2_HILL: 20,
    E2_FOREST_HILL: 18,
    GL3_DEEP_FOREST: 12,
    E0_WETLAND: 8,
    GL0_DESERT: 6,
    E2_DESERT_HILL: 5,
    E2_DEEP_HILL: 4,
    E3_MOUNTAIN: 2
});

function cloneCandidate(candidate) {
    return candidate && typeof candidate === "object" ? { ...candidate } : candidate;
}

function shuffle(items, randomService) {
    const copy = items.map(cloneCandidate);
    if (randomService?.shuffle) return randomService.shuffle(copy);
    if (randomService?.nextInt) {
        for (let i = copy.length - 1; i > 0; i--) {
            const j = randomService.nextInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
    }
    return copy;
}

function teachingScore(candidate) {
    if (!candidate || typeof candidate !== "object") return -Infinity;
    const placedScore = candidate.placed === true ? 100 : 0;
    const terrainScore = READABLE_TERRAIN_PRIORITY[candidate.terrainId] || 0;
    return placedScore + terrainScore;
}

/**
 * FirstRun Trial1 scenario shaping at the ingress-selection seam only.
 *
 * It preserves:
 * - the normal policy's requested route count;
 * - TrialIngressResolver legality;
 * - canonical TrialRouteGenerator pathfinding/costs;
 * - Enemy Truth and combat rules.
 *
 * It changes only which already-legal perimeter candidates are preferred for
 * the first instructional Trial.
 */
export class FirstRunTrialIngressPolicy {
    constructor({ basePolicy, randomService = null } = {}) {
        if (!basePolicy || typeof basePolicy.select !== "function") {
            throw new TypeError("FIRST_RUN_TRIAL_INGRESS_BASE_POLICY_REQUIRED");
        }
        this.basePolicy = basePolicy;
        this.randomService = randomService;
    }

    select(context = {}) {
        const baseline = this.basePolicy.select(context);
        if (!Array.isArray(baseline) || baseline.length === 0) return baseline || [];

        const firstRunActive = context?.gameState?.engine?.firstRunState?.active === true;
        if (!firstRunActive || Number(context?.trialIndex) !== 1) {
            return baseline.map(cloneCandidate);
        }

        const candidates = Array.isArray(context.candidates) ? context.candidates : [];
        if (candidates.length === 0) return baseline.map(cloneCandidate);

        const count = Math.min(baseline.length, candidates.length);
        return shuffle(candidates, this.randomService || context?.gameState?.engine?.gameplayRandom || null)
            .map((candidate, index) => ({
                candidate,
                index,
                score: teachingScore(candidate)
            }))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, count)
            .map(entry => cloneCandidate(entry.candidate));
    }
}

export default FirstRunTrialIngressPolicy;
