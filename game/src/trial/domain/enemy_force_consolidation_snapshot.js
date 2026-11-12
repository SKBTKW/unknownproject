import { ENEMY_BLUEPRINT_SLOTS } from './enemy_army_blueprint.js';
import { ENEMY_ACTIVITY_DIRECTIONS } from './enemy_activity_direction_snapshot.js';
import { ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS } from './enemy_activity_direction_relationship.js';

export const ENEMY_FORCE_CONSOLIDATION_SCHEMA_VERSION = 1;

function exactKeys(value, keys, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key))) {
        throw new TypeError(`ENEMY_FORCE_CONSOLIDATION_${label}_INVALID`);
    }
}

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === 'object') freezeDeep(child);
    });
    return Object.freeze(value);
}

function validateDiagnostics(value, sourceIds) {
    exactKeys(value, [
        'sourceDirections', 'pairRelationships', 'supportedIngressDirections',
        'commonIngressDirections', 'hasOppositePair', 'hasDirectionConflict'
    ], 'DIRECTION_DIAGNOSTICS');
    if (!Array.isArray(value.sourceDirections) || value.sourceDirections.length !== sourceIds.length
        || !Array.isArray(value.pairRelationships)
        || !Array.isArray(value.supportedIngressDirections)
        || !Array.isArray(value.commonIngressDirections)
        || typeof value.hasOppositePair !== 'boolean'
        || typeof value.hasDirectionConflict !== 'boolean') {
        throw new TypeError('ENEMY_FORCE_CONSOLIDATION_DIRECTION_DIAGNOSTICS_INVALID');
    }
    const observedIds = value.sourceDirections.map(item => {
        exactKeys(item, ['sourceForceId', 'activityDirection'], 'SOURCE_DIRECTION');
        if (!sourceIds.includes(item.sourceForceId)
            || !ENEMY_ACTIVITY_DIRECTIONS.includes(item.activityDirection)) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_SOURCE_DIRECTION_INVALID');
        }
        return item.sourceForceId;
    });
    if (new Set(observedIds).size !== sourceIds.length) {
        throw new TypeError('ENEMY_FORCE_CONSOLIDATION_SOURCE_DIRECTION_INVALID');
    }
    value.pairRelationships.forEach(pair => {
        exactKeys(pair, ['sourceForceIds', 'relationship'], 'PAIR_RELATIONSHIP');
        if (!Array.isArray(pair.sourceForceIds) || pair.sourceForceIds.length !== 2
            || pair.sourceForceIds.some(id => !sourceIds.includes(id))
            || !Object.values(ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS).includes(pair.relationship)) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_PAIR_RELATIONSHIP_INVALID');
        }
    });
    value.supportedIngressDirections.forEach(item => {
        exactKeys(item, ['sourceForceId', 'directions'], 'INGRESS_SUPPORT');
        if (!sourceIds.includes(item.sourceForceId) || !Array.isArray(item.directions)
            || item.directions.some(direction => !ENEMY_ACTIVITY_DIRECTIONS.includes(direction))) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_INGRESS_SUPPORT_INVALID');
        }
    });
    if (value.commonIngressDirections.some(direction => !ENEMY_ACTIVITY_DIRECTIONS.includes(direction))) {
        throw new TypeError('ENEMY_FORCE_CONSOLIDATION_COMMON_INGRESS_INVALID');
    }
}

/** Immutable participation mapping. Source truth remains owned by Blueprint and direction snapshots. */
export class EnemyForceConsolidationSnapshot {
    #snapshot;

    constructor(snapshot) {
        exactKeys(snapshot, [
            'schemaVersion', 'stageId', 'armyId', 'participantCount', 'resolutionPolicy',
            'sourceForceIds', 'candidateEvaluations', 'participatingForces'
        ], 'SNAPSHOT');
        if (snapshot.schemaVersion !== ENEMY_FORCE_CONSOLIDATION_SCHEMA_VERSION
            || !Number.isSafeInteger(snapshot.stageId) || snapshot.stageId < 1
            || typeof snapshot.armyId !== 'string' || !snapshot.armyId
            || ![1, 2, 3].includes(snapshot.participantCount)) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_IDENTITY_INVALID');
        }
        exactKeys(snapshot.resolutionPolicy, ['id', 'version', 'selectionReason'], 'POLICY');
        if (typeof snapshot.resolutionPolicy.id !== 'string' || !snapshot.resolutionPolicy.id
            || !Number.isSafeInteger(snapshot.resolutionPolicy.version) || snapshot.resolutionPolicy.version < 1
            || typeof snapshot.resolutionPolicy.selectionReason !== 'string'
            || !snapshot.resolutionPolicy.selectionReason) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_POLICY_INVALID');
        }
        const expectedIds = ENEMY_BLUEPRINT_SLOTS.map(slot => `${snapshot.armyId}_${slot}`);
        if (!Array.isArray(snapshot.sourceForceIds)
            || JSON.stringify(snapshot.sourceForceIds) !== JSON.stringify(expectedIds)
            || !Array.isArray(snapshot.candidateEvaluations)
            || !Array.isArray(snapshot.participatingForces)
            || snapshot.participatingForces.length !== snapshot.participantCount) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_SOURCES_INVALID');
        }
        snapshot.candidateEvaluations.forEach(candidate => {
            exactKeys(candidate, ['sourceForceIds', 'relationship', 'rank'], 'CANDIDATE');
            if (!Array.isArray(candidate.sourceForceIds) || candidate.sourceForceIds.length !== 2
                || candidate.sourceForceIds.some(id => !expectedIds.includes(id))
                || !Object.values(ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS).includes(candidate.relationship)
                || !Number.isSafeInteger(candidate.rank) || candidate.rank < 0) {
                throw new TypeError('ENEMY_FORCE_CONSOLIDATION_CANDIDATE_INVALID');
            }
        });
        const assigned = [];
        const participantIds = new Set();
        snapshot.participatingForces.forEach(participant => {
            exactKeys(participant, [
                'participantUnitId', 'primarySourceForceId', 'sourceForceIds', 'directionDiagnostics'
            ], 'PARTICIPANT');
            if (typeof participant.participantUnitId !== 'string' || !participant.participantUnitId
                || participantIds.has(participant.participantUnitId)
                || !Array.isArray(participant.sourceForceIds) || participant.sourceForceIds.length === 0
                || !participant.sourceForceIds.includes(participant.primarySourceForceId)
                || participant.sourceForceIds.some(id => !expectedIds.includes(id))) {
                throw new TypeError('ENEMY_FORCE_CONSOLIDATION_PARTICIPANT_INVALID');
            }
            participantIds.add(participant.participantUnitId);
            assigned.push(...participant.sourceForceIds);
            validateDiagnostics(participant.directionDiagnostics, participant.sourceForceIds);
        });
        if (assigned.length !== expectedIds.length || new Set(assigned).size !== expectedIds.length
            || expectedIds.some(id => !assigned.includes(id))) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_ASSIGNMENT_INVALID');
        }
        this.#snapshot = freezeDeep(structuredClone(snapshot));
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    getParticipatingForce(participantUnitId) {
        const value = this.#snapshot.participatingForces.find(
            participant => participant.participantUnitId === participantUnitId
        );
        return value ? structuredClone(value) : null;
    }

    static fromSnapshot(snapshot) { return new EnemyForceConsolidationSnapshot(snapshot); }
}

