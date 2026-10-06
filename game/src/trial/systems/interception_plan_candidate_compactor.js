function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function groupKey(candidate) {
    return candidate?.tacticIntent || "UNSPECIFIED_INTERCEPT";
}

/**
 * Compresses route-level candidate proposals into a small semantic set.
 *
 * It deliberately owns no pathfinding and no tactic-success score.
 * Callers may inject a representativeSelector when a later design decides
 * whether "shortest", "lowest burden", or another semantic preference wins.
 */
export class InterceptionPlanCandidateCompactor {
    constructor({ maxCandidates = 4, representativeSelector = null } = {}) {
        this.maxCandidates = Math.max(1, Math.floor(Number(maxCandidates) || 4));
        this.representativeSelector = typeof representativeSelector === "function"
            ? representativeSelector
            : null;
    }

    compact(candidates = []) {
        const source = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
        const grouped = new Map();

        for (const candidate of source) {
            const key = groupKey(candidate);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(candidate);
        }

        const groups = [];
        for (const [key, alternatives] of grouped.entries()) {
            let representative = alternatives[0] || null;
            if (this.representativeSelector && alternatives.length > 1) {
                representative = this.representativeSelector({
                    semanticKey: key,
                    alternatives: clone(alternatives)
                }) || representative;
            }
            groups.push({
                semanticKey: key,
                representative: clone(representative),
                alternativeCount: alternatives.length
            });
        }

        const visibleGroups = groups.slice(0, this.maxCandidates);
        return {
            candidates: visibleGroups.map(group => group.representative),
            groups: visibleGroups,
            omittedSemanticGroups: Math.max(0, groups.length - visibleGroups.length),
            sourceCandidateCount: source.length,
            semanticGroupCount: groups.length
        };
    }
}

export default InterceptionPlanCandidateCompactor;
