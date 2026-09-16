import { createInvestigationReport } from "../domain/investigation_report.js";

const PROFILE_FACETS = Object.freeze({
    directionHints: "DIRECTION",
    physiqueTraits: "PHYSIQUE",
    equipmentTraits: "EQUIPMENT",
    movementTraits: "MOVEMENT",
    terrainTraits: "TERRAIN"
});

function normalizeLimit(value, fallback = 1) {
    if (!Number.isInteger(value) || value < 1) return fallback;
    return value;
}

function randomIndex(length, rng) {
    if (length <= 1) return 0;
    const roll = Number(rng());
    const normalized = Number.isFinite(roll)
        ? Math.min(Math.max(roll, 0), 0.999999999999)
        : 0;
    return Math.floor(normalized * length);
}

function collectCandidates(profile, allowedFacets) {
    const candidates = [];

    if (allowedFacets.includes("scaleBand") && typeof profile?.scaleBand === "string" && profile.scaleBand.length > 0) {
        candidates.push({ facet: "SCALE", tag: `SCALE_${profile.scaleBand}` });
    }

    for (const [profileKey, facet] of Object.entries(PROFILE_FACETS)) {
        if (!allowedFacets.includes(profileKey)) continue;
        const values = Array.isArray(profile?.[profileKey]) ? profile[profileKey] : [];
        for (const value of values) {
            if (typeof value !== "string" || value.length === 0) continue;
            candidates.push({ facet, tag: value });
        }
    }

    return candidates;
}

function selectWithoutReplacement(candidates, limit, rng) {
    const pool = candidates.map(candidate => ({ ...candidate }));
    const selected = [];

    while (pool.length > 0 && selected.length < limit) {
        const index = randomIndex(pool.length, rng);
        selected.push(pool.splice(index, 1)[0]);
    }

    return selected;
}

/**
 * Produces a historical investigation report from an already-redacted
 * ObservableEnemyProfile.
 *
 * The resolver never reads Trial truth directly and never invents traits.
 * Source-specific behavior is injected through sourcePolicy, so observation
 * content can later live in external data without changing this domain logic.
 *
 * sourcePolicy shape:
 * {
 *   sourceType: string,
 *   allowedFacets: [
 *     "scaleBand", "directionHints", "physiqueTraits", "equipmentTraits",
 *     "movementTraits", "terrainTraits"
 *   ],
 *   maxObservations: integer,
 *   textKey: string | null
 * }
 */
export class InvestigationResolver {
    constructor({ rng = Math.random } = {}) {
        this.rng = typeof rng === "function" ? rng : Math.random;
    }

    resolve({
        profile,
        observedAtVerse,
        sourcePolicy,
        reportId = null
    } = {}) {
        const policy = sourcePolicy && typeof sourcePolicy === "object" ? sourcePolicy : {};
        const allowedFacets = Array.isArray(policy.allowedFacets)
            ? policy.allowedFacets.filter(value => typeof value === "string")
            : [];
        const maxObservations = normalizeLimit(policy.maxObservations, 1);
        const candidates = collectCandidates(profile || {}, allowedFacets);
        const observations = selectWithoutReplacement(candidates, maxObservations, this.rng);

        return createInvestigationReport({
            id: reportId || undefined,
            observedAtVerse,
            trialIndex: Number.isInteger(profile?.trialIndex) ? profile.trialIndex : null,
            sourceType: typeof policy.sourceType === "string" && policy.sourceType.length > 0
                ? policy.sourceType
                : "UNKNOWN",
            threatRevision: Number.isInteger(profile?.threatRevision)
                ? profile.threatRevision
                : null,
            observations,
            textKey: typeof policy.textKey === "string" && policy.textKey.length > 0
                ? policy.textKey
                : null
        });
    }
}

export default InvestigationResolver;
