import { freezeBattleResolutionData } from "./battle_resolution_snapshot.js";

export const FORCE_RELATIONSHIP_SCHEMA = "DEV_FORCE_RELATIONSHIP_FOUNDATION_V1";

export const FORCE_ACTORS = Object.freeze({ HUMAN: "HUMAN", ENEMY: "ENEMY" });
export const FORCE_RELATIONSHIP_TYPES = Object.freeze({
    SUPPORT: "SUPPORT",
    COORDINATION: "COORDINATION",
    SEPARATION: "SEPARATION",
    ISOLATION: "ISOLATION"
});
export const FORCE_RELATIONSHIP_STATUS = Object.freeze({
    CONFIRMED: "CONFIRMED",
    DENIED: "DENIED",
    UNRESOLVED: "UNRESOLVED"
});
export const SPATIAL_EVIDENCE_STATUS = Object.freeze({
    CONFIRMED: "CONFIRMED",
    DENIED: "DENIED",
    UNRESOLVED: "UNRESOLVED"
});

const ACTORS = new Set(Object.values(FORCE_ACTORS));
const RELATION_TYPES = new Set([
    FORCE_RELATIONSHIP_TYPES.SUPPORT,
    FORCE_RELATIONSHIP_TYPES.COORDINATION,
    FORCE_RELATIONSHIP_TYPES.SEPARATION
]);
const STATUSES = new Set(Object.values(FORCE_RELATIONSHIP_STATUS));
const SPATIAL_STATUSES = new Set(Object.values(SPATIAL_EVIDENCE_STATUS));
const validText = value => typeof value === "string" && value.trim().length > 0;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));

function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
}

function validatePoint(value) {
    return plainObject(value) && Number.isInteger(value.r) && Number.isInteger(value.c);
}

function validateEvidenceField(field, validator = () => true) {
    if (!plainObject(field) || !SPATIAL_STATUSES.has(field.status)) {
        throw new TypeError("INVALID_SPATIAL_EVIDENCE_FIELD");
    }
    const hasValue = Object.hasOwn(field, "value") && field.value !== null;
    if (field.status === SPATIAL_EVIDENCE_STATUS.UNRESOLVED && hasValue) {
        throw new TypeError("UNRESOLVED_SPATIAL_VALUE_FORBIDDEN");
    }
    if (field.status !== SPATIAL_EVIDENCE_STATUS.UNRESOLVED
        && (!hasValue || !validator(field.value) || !validText(field.sourceFactId))) {
        throw new TypeError("GROUNDED_SPATIAL_VALUE_REQUIRED");
    }
    return copy(field);
}

export function createForceSpatialEvidence(value = {}) {
    if (!plainObject(value)) throw new TypeError("SPATIAL_EVIDENCE_REQUIRED");
    const unresolved = () => ({ status: SPATIAL_EVIDENCE_STATUS.UNRESOLVED, value: null });
    return freezeBattleResolutionData({
        position: validateEvidenceField(value.position || unresolved(), validatePoint),
        relativePosition: validateEvidenceField(value.relativePosition || unresolved(), validText),
        distance: validateEvidenceField(value.distance || unresolved(), item => Number.isFinite(item) && item >= 0),
        route: validateEvidenceField(value.route || unresolved(), plainObject),
        reachability: validateEvidenceField(value.reachability || unresolved(), item => typeof item === "boolean"),
        terrainConstraints: validateEvidenceField(value.terrainConstraints || unresolved(), Array.isArray),
        travelTime: validateEvidenceField(value.travelTime || unresolved(), item => Number.isFinite(item) && item >= 0)
    });
}

function validateForces(forces) {
    if (!Array.isArray(forces) || forces.length === 0) throw new TypeError("FORCE_LIST_REQUIRED");
    const ids = new Set();
    return Array.from(forces, force => {
        if (!plainObject(force) || !validText(force.forceId) || ids.has(force.forceId)
            || !ACTORS.has(force.actor) || !plainObject(force.state)) {
            throw new TypeError("INVALID_FORCE_IDENTITY");
        }
        ids.add(force.forceId);
        return {
            forceId: force.forceId,
            actor: force.actor,
            state: copy(force.state),
            spatialEvidence: createForceSpatialEvidence(force.spatialEvidence || {})
        };
    });
}

function validateRelations(relations, forces) {
    if (!Array.isArray(relations)) throw new TypeError("RELATION_LIST_REQUIRED");
    const registry = new Map(forces.map(force => [force.forceId, force]));
    const ids = new Set();
    return Array.from(relations, relation => {
        if (!plainObject(relation) || !validText(relation.relationId) || ids.has(relation.relationId)
            || !RELATION_TYPES.has(relation.type) || !STATUSES.has(relation.status)
            || !registry.has(relation.sourceForceId) || !registry.has(relation.targetForceId)
            || relation.sourceForceId === relation.targetForceId) {
            throw new TypeError("INVALID_FORCE_RELATIONSHIP");
        }
        const source = registry.get(relation.sourceForceId);
        const target = registry.get(relation.targetForceId);
        if ([FORCE_RELATIONSHIP_TYPES.SUPPORT, FORCE_RELATIONSHIP_TYPES.COORDINATION].includes(relation.type)
            && source.actor !== target.actor) {
            throw new TypeError("CROSS_ACTOR_ALLIED_RELATION_FORBIDDEN");
        }
        ids.add(relation.relationId);
        return copy(relation);
    });
}

function validateSupportScopes(scopes, forces) {
    if (!Array.isArray(scopes)) throw new TypeError("SUPPORT_SCOPE_LIST_REQUIRED");
    const registry = new Map(forces.map(force => [force.forceId, force]));
    const targets = new Set();
    return Array.from(scopes, scope => {
        if (!plainObject(scope) || !registry.has(scope.targetForceId) || targets.has(scope.targetForceId)
            || !Array.isArray(scope.candidateForceIds) || typeof scope.complete !== "boolean") {
            throw new TypeError("INVALID_SUPPORT_SCOPE");
        }
        const unique = new Set();
        const target = registry.get(scope.targetForceId);
        for (const candidateId of scope.candidateForceIds) {
            const candidate = registry.get(candidateId);
            if (!candidate || candidateId === scope.targetForceId || unique.has(candidateId)
                || candidate.actor !== target.actor) {
                throw new TypeError("INVALID_SUPPORT_CANDIDATE");
            }
            unique.add(candidateId);
        }
        targets.add(scope.targetForceId);
        return copy(scope);
    });
}

export function createForceRelationshipSnapshot({ forces, relations = [], supportScopes = [] } = {}) {
    const safeForces = validateForces(forces);
    const safeRelations = validateRelations(relations, safeForces);
    const safeScopes = validateSupportScopes(supportScopes, safeForces);
    return freezeBattleResolutionData({
        schema: FORCE_RELATIONSHIP_SCHEMA,
        forces: safeForces,
        relations: safeRelations,
        supportScopes: safeScopes
    });
}

export function evaluateForceIsolation({ forceId, forces, relations, supportScopes } = {}) {
    const registry = new Map(forces.map(force => [force.forceId, force]));
    if (!registry.has(forceId)) throw new TypeError("UNKNOWN_ISOLATION_FORCE");
    const scope = supportScopes.find(row => row.targetForceId === forceId);
    if (!scope || scope.complete !== true) {
        return freezeBattleResolutionData({
            type: FORCE_RELATIONSHIP_TYPES.ISOLATION,
            forceId,
            status: FORCE_RELATIONSHIP_STATUS.UNRESOLVED,
            reasons: [scope ? "UNKNOWN_SUPPORT_CANDIDATES_REMAIN" : "SUPPORT_SCOPE_REQUIRED"],
            supportRelations: []
        });
    }
    const supportRelations = scope.candidateForceIds.map(candidateId => relations.find(relation =>
        relation.type === FORCE_RELATIONSHIP_TYPES.SUPPORT
        && relation.sourceForceId === candidateId
        && relation.targetForceId === forceId
    ) || null);
    if (supportRelations.some(relation => relation?.status === FORCE_RELATIONSHIP_STATUS.CONFIRMED)) {
        return freezeBattleResolutionData({
            type: FORCE_RELATIONSHIP_TYPES.ISOLATION,
            forceId,
            status: FORCE_RELATIONSHIP_STATUS.DENIED,
            reasons: ["CONFIRMED_SUPPORT_AVAILABLE"],
            supportRelations: supportRelations.filter(Boolean).map(row => row.relationId)
        });
    }
    if (supportRelations.length === scope.candidateForceIds.length
        && supportRelations.every(relation => relation?.status === FORCE_RELATIONSHIP_STATUS.DENIED)) {
        return freezeBattleResolutionData({
            type: FORCE_RELATIONSHIP_TYPES.ISOLATION,
            forceId,
            status: FORCE_RELATIONSHIP_STATUS.CONFIRMED,
            reasons: ["ALL_KNOWN_SUPPORT_DENIED"],
            supportRelations: supportRelations.map(row => row.relationId)
        });
    }
    return freezeBattleResolutionData({
        type: FORCE_RELATIONSHIP_TYPES.ISOLATION,
        forceId,
        status: FORCE_RELATIONSHIP_STATUS.UNRESOLVED,
        reasons: ["SUPPORT_RELATION_UNRESOLVED"],
        supportRelations: supportRelations.filter(Boolean).map(row => row.relationId)
    });
}

export function validateForceRelationshipStatus(status) {
    if (!STATUSES.has(status)) throw new TypeError("INVALID_FORCE_RELATIONSHIP_STATUS");
    return status;
}

export function validateForceRelationshipSnapshot(snapshot) {
    if (snapshot?.schema !== FORCE_RELATIONSHIP_SCHEMA) {
        throw new TypeError("INVALID_FORCE_RELATIONSHIP_SCHEMA");
    }
    return createForceRelationshipSnapshot(snapshot);
}
