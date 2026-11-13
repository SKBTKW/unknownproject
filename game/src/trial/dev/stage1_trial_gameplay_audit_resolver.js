import { TrialThreatResolver } from "../systems/trial_threat_resolver.js";
import { EnemyArmyStructureResolver } from "../systems/enemy_army_structure_resolver.js";
import { EnemyForceConsolidationResolver } from "../systems/enemy_force_consolidation_resolver.js";

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function requireNonNegativeNumber(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new TypeError(`${label}_INVALID`);
    return number;
}

function normalizeBands(bands) {
    if (!Array.isArray(bands) || bands.length !== 3) {
        throw new TypeError("STAGE1_AUDIT_PARTICIPANT_BANDS_INVALID");
    }
    const normalized = bands.map((band, index) => {
        const minInclusive = requireNonNegativeNumber(band?.minInclusive, "STAGE1_AUDIT_BAND_MIN");
        const maxInclusive = band?.maxInclusive === null
            ? Number.POSITIVE_INFINITY
            : requireNonNegativeNumber(band?.maxInclusive, "STAGE1_AUDIT_BAND_MAX");
        if (band?.participantCount !== index + 1 || maxInclusive < minInclusive) {
            throw new TypeError("STAGE1_AUDIT_PARTICIPANT_BANDS_INVALID");
        }
        return { participantCount: index + 1, minInclusive, maxInclusive };
    });
    for (let index = 1; index < normalized.length; index += 1) {
        if (normalized[index].minInclusive !== normalized[index - 1].maxInclusive + 1) {
            throw new TypeError("STAGE1_AUDIT_PARTICIPANT_BANDS_NOT_CONTIGUOUS");
        }
    }
    if (normalized[0].minInclusive !== 0 || normalized[2].maxInclusive !== Number.POSITIVE_INFINITY) {
        throw new TypeError("STAGE1_AUDIT_PARTICIPANT_BANDS_NOT_EXHAUSTIVE");
    }
    return normalized;
}

function resolveParticipantBand(suppression, bands) {
    const match = bands.find(band => suppression >= band.minInclusive && suppression <= band.maxInclusive);
    if (!match) throw new RangeError("STAGE1_AUDIT_PARTICIPANT_BAND_NOT_FOUND");
    const finiteBoundaries = bands.slice(0, -1).map(band => band.maxInclusive);
    const nearestBoundaryDistance = finiteBoundaries.length === 0
        ? null
        : Math.min(...finiteBoundaries.map(boundary => Math.min(
            Math.abs(suppression - boundary),
            Math.abs(suppression - (boundary + 1))
        )));
    return {
        participantCount: match.participantCount,
        matchedBand: clone(match),
        nearestBoundaryDistance
    };
}

function policyResolver(policy) {
    return new TrialThreatResolver({
        baseThreatByTrial: { 1: requireNonNegativeNumber(policy.baseSuppression, "STAGE1_AUDIT_BASE") },
        placedBlockWeight: requireNonNegativeNumber(policy.placedBlockWeight ?? 0, "STAGE1_AUDIT_BLOCK_WEIGHT"),
        territoryWeight: requireNonNegativeNumber(policy.territoryTileWeight ?? 0, "STAGE1_AUDIT_TILE_WEIGHT"),
        completedZoneWeight: requireNonNegativeNumber(policy.completedZoneWeight ?? 0, "STAGE1_AUDIT_ZONE_WEIGHT"),
        linkWeight: requireNonNegativeNumber(policy.linkWeight ?? 0, "STAGE1_AUDIT_LINK_WEIGHT"),
        stageWeight: requireNonNegativeNumber(policy.stageWeight ?? 0, "STAGE1_AUDIT_STAGE_WEIGHT")
    });
}

function validatePolicy(policy) {
    if (!policy || typeof policy.id !== "string" || !policy.id.trim()) {
        throw new TypeError("STAGE1_AUDIT_POLICY_ID_INVALID");
    }
    if (policy.status !== "PROTOTYPE" || policy.appliesToProduction !== false) {
        throw new TypeError("STAGE1_AUDIT_POLICY_BOUNDARY_INVALID");
    }
}

/**
 * Development-only comparison resolver. It accepts every balance coefficient and
 * 1-3 participant boundary from the caller and never mutates production policy.
 */
export class Stage1TrialGameplayAuditResolver {
    constructor({ consolidationResolver = new EnemyForceConsolidationResolver() } = {}) {
        this.consolidationResolver = consolidationResolver;
    }

    compare({
        development,
        productionStrategicSuppression,
        candidatePolicies = [],
        legacySuppressionPerForce = 35,
        sourceIdentity = null
    } = {}) {
        const production = requireNonNegativeNumber(
            productionStrategicSuppression,
            "STAGE1_AUDIT_PRODUCTION_SUPPRESSION"
        );
        const legacyPerForce = requireNonNegativeNumber(
            legacySuppressionPerForce,
            "STAGE1_AUDIT_LEGACY_SUPPRESSION_PER_FORCE"
        );
        if (legacyPerForce <= 0) throw new RangeError("STAGE1_AUDIT_LEGACY_SUPPRESSION_PER_FORCE_INVALID");

        const legacy = new EnemyArmyStructureResolver({
            policy: { suppressionPerForce: legacyPerForce, maxForces: 5 }
        }).resolve({ strategicSuppression: production, trialIndex: 1 });

        const candidates = candidatePolicies.map(policy => {
            validatePolicy(policy);
            const bands = normalizeBands(policy.participantBands);
            const threat = policyResolver(policy).resolve({ trialIndex: 1, development });
            const band = resolveParticipantBand(threat.strategicSuppression, bands);
            const consolidation = sourceIdentity
                ? this.consolidationResolver.resolve({
                    blueprint: sourceIdentity.blueprint,
                    directionSnapshot: sourceIdentity.directionSnapshot,
                    participantCount: band.participantCount
                }).getSnapshot()
                : null;
            return {
                policyId: policy.id,
                status: policy.status,
                appliesToProduction: policy.appliesToProduction,
                strategicSuppression: threat.strategicSuppression,
                threatBreakdown: clone(threat.breakdown),
                participantPolicy: { bands: clone(policy.participantBands), ...band },
                sourceIdentityConsolidation: consolidation,
                conservation: {
                    sourceForceCount: sourceIdentity?.blueprint?.forces?.length ?? null,
                    participantCount: band.participantCount,
                    sourceIdentityPreserved: consolidation
                        ? consolidation.sourceForceIds.length === 3
                            && consolidation.participatingForces.flatMap(force => force.sourceForceIds).length === 3
                        : null
                }
            };
        });

        return {
            schemaVersion: 1,
            scope: "STAGE1_TRIAL_GAMEPLAY_DIAGNOSTIC_ONLY",
            development: clone(development),
            production: {
                strategicSuppression: production,
                participantCount: legacy.forceCount,
                routeCount: legacy.routeCount,
                policy: clone(legacy.policySnapshot)
            },
            legacy35PerForce: {
                strategicSuppression: production,
                participantCount: legacy.forceCount,
                allocations: legacy.forces.map(force => force.strategicSuppression)
            },
            candidates,
            causalChain: [
                { from: "STANDARD_BOARD", to: "CIVILIZATION_DEVELOPMENT_SNAPSHOT", state: "PRODUCTION_CONNECTED" },
                { from: "CIVILIZATION_DEVELOPMENT_SNAPSHOT", to: "STRATEGIC_SUPPRESSION", state: "PRODUCTION_CONNECTED_ZERO_WEIGHTS" },
                { from: "STRATEGIC_SUPPRESSION", to: "ARMY_STRUCTURE_AND_ROUTE_COUNT", state: "PRODUCTION_CONNECTED_LEGACY_35" },
                { from: "A_B_C_SOURCE_IDENTITIES", to: "PARTICIPATING_FORCES", state: "FOUNDATION_ONLY" },
                { from: "PARTICIPATING_FORCES", to: "INGRESS_ROUTES", state: "PRODUCTION_NOT_CONNECTED" },
                { from: "INGRESS_ROUTES", to: "INTERCEPTION_COMBAT", state: "PRODUCTION_CONNECTED" },
                { from: "INTERCEPTION_COMBAT", to: "REMAINING_SUPPRESSION", state: "PRODUCTION_CONNECTED" },
                { from: "ROUTE_END_REMAINING_SUPPRESSION", to: "EMBER_DAMAGE", state: "PRODUCTION_CONNECTED" }
            ]
        };
    }
}

export default Stage1TrialGameplayAuditResolver;
