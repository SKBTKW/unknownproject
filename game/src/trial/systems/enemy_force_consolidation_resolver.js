import { EnemyArmyBlueprint, ENEMY_BLUEPRINT_SLOTS } from '../domain/enemy_army_blueprint.js';
import { EnemyActivityDirectionSnapshot, ENEMY_ACTIVITY_DIRECTIONS } from '../domain/enemy_activity_direction_snapshot.js';
import {
    classifyEnemyActivityDirectionRelationship,
    ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS,
    listSupportedIngressDirections
} from '../domain/enemy_activity_direction_relationship.js';
import {
    EnemyForceConsolidationSnapshot,
    ENEMY_FORCE_CONSOLIDATION_SCHEMA_VERSION
} from '../domain/enemy_force_consolidation_snapshot.js';

export const ENEMY_FORCE_CONSOLIDATION_POLICY = Object.freeze({
    id: 'direction-compatibility-foundation-v1',
    version: 1
});

const RELATIONSHIP_RANK = Object.freeze({ SAME: 0, ADJACENT: 1, OPPOSITE: 2 });

/** Resolves immutable source truth without inventing a merged composition. */
export function resolveParticipatingForceSourceSnapshots({ participatingForce, blueprint } = {}) {
    if (!participatingForce || !Array.isArray(participatingForce.sourceForceIds)) {
        throw new TypeError('ENEMY_FORCE_CONSOLIDATION_PARTICIPANT_INVALID');
    }
    const army = EnemyArmyBlueprint.fromSnapshot(
        blueprint instanceof EnemyArmyBlueprint ? blueprint.getSnapshot() : blueprint
    ).getSnapshot();
    return participatingForce.sourceForceIds.map(sourceForceId => {
        const source = army.forces.find(force => force.id === sourceForceId);
        if (!source) throw new TypeError('ENEMY_FORCE_CONSOLIDATION_SOURCE_MISMATCH');
        return structuredClone(source);
    });
}

function directionDiagnostics(sourceIds, directionBySource) {
    const sourceDirections = sourceIds.map(sourceForceId => ({
        sourceForceId,
        activityDirection: directionBySource.get(sourceForceId)
    }));
    const pairRelationships = [];
    for (let left = 0; left < sourceDirections.length; left += 1) {
        for (let right = left + 1; right < sourceDirections.length; right += 1) {
            pairRelationships.push({
                sourceForceIds: [sourceDirections[left].sourceForceId, sourceDirections[right].sourceForceId],
                relationship: classifyEnemyActivityDirectionRelationship(
                    sourceDirections[left].activityDirection,
                    sourceDirections[right].activityDirection
                )
            });
        }
    }
    const supportedIngressDirections = sourceDirections.map(source => ({
        sourceForceId: source.sourceForceId,
        directions: listSupportedIngressDirections(source.activityDirection)
    }));
    const commonIngressDirections = ENEMY_ACTIVITY_DIRECTIONS.filter(direction =>
        supportedIngressDirections.every(source => source.directions.includes(direction))
    );
    const hasOppositePair = pairRelationships.some(
        pair => pair.relationship === ENEMY_ACTIVITY_DIRECTION_RELATIONSHIPS.OPPOSITE
    );
    return {
        sourceDirections,
        pairRelationships,
        supportedIngressDirections,
        commonIngressDirections,
        hasOppositePair,
        hasDirectionConflict: hasOppositePair || commonIngressDirections.length === 0
    };
}

function candidatePairs(sourceIds, directionBySource) {
    const pairs = [[0, 1], [0, 2], [1, 2]].map(([left, right]) => {
        const sourceForceIds = [sourceIds[left], sourceIds[right]];
        const relationship = classifyEnemyActivityDirectionRelationship(
            directionBySource.get(sourceForceIds[0]), directionBySource.get(sourceForceIds[1])
        );
        return { sourceForceIds, relationship, rank: RELATIONSHIP_RANK[relationship] };
    });
    return pairs.sort((first, second) => first.rank - second.rank
        || sourceIds.indexOf(first.sourceForceIds[0]) - sourceIds.indexOf(second.sourceForceIds[0])
        || sourceIds.indexOf(first.sourceForceIds[1]) - sourceIds.indexOf(second.sourceForceIds[1]));
}

/** Opt-in foundation resolver. It does not calculate participant count or enter production Trial. */
export class EnemyForceConsolidationResolver {
    resolve({ blueprint, directionSnapshot, participantCount } = {}) {
        if (![1, 2, 3].includes(participantCount)) {
            throw new RangeError('ENEMY_FORCE_CONSOLIDATION_PARTICIPANT_COUNT_INVALID');
        }
        const army = EnemyArmyBlueprint.fromSnapshot(
            blueprint instanceof EnemyArmyBlueprint ? blueprint.getSnapshot() : blueprint
        ).getSnapshot();
        const directions = EnemyActivityDirectionSnapshot.fromSnapshot(
            directionSnapshot instanceof EnemyActivityDirectionSnapshot
                ? directionSnapshot.getSnapshot() : directionSnapshot
        ).getSnapshot();
        if (army.stageId !== directions.stageId || army.armyId !== directions.armyId) {
            throw new TypeError('ENEMY_FORCE_CONSOLIDATION_SOURCE_MISMATCH');
        }
        const sourceForceIds = ENEMY_BLUEPRINT_SLOTS.map(slot => `${army.armyId}_${slot}`);
        const directionBySource = new Map(
            directions.forces.map(force => [force.sourceForceId, force.activityDirection])
        );
        const candidates = candidatePairs(sourceForceIds, directionBySource);
        let groups;
        let selectionReason;
        if (participantCount === 3) {
            groups = sourceForceIds.map(sourceForceId => [sourceForceId]);
            selectionReason = 'NO_CONSOLIDATION_REQUESTED';
        } else if (participantCount === 2) {
            const selected = candidates[0].sourceForceIds;
            groups = [selected, sourceForceIds.filter(id => !selected.includes(id))];
            groups.sort((first, second) => sourceForceIds.indexOf(first[0]) - sourceForceIds.indexOf(second[0]));
            selectionReason = `LOWEST_DIRECTION_RELATIONSHIP_RANK_THEN_SLOT_ORDER:${candidates[0].relationship}`;
        } else {
            groups = [sourceForceIds];
            selectionReason = 'ALL_SOURCE_FORCES_REQUIRED';
        }
        const participatingForces = groups.map((ids, index) => ({
            participantUnitId: `${army.armyId}_PARTICIPANT_${index + 1}`,
            primarySourceForceId: ids[0],
            sourceForceIds: ids,
            directionDiagnostics: directionDiagnostics(ids, directionBySource)
        }));
        return new EnemyForceConsolidationSnapshot({
            schemaVersion: ENEMY_FORCE_CONSOLIDATION_SCHEMA_VERSION,
            stageId: army.stageId,
            armyId: army.armyId,
            participantCount,
            resolutionPolicy: {
                ...ENEMY_FORCE_CONSOLIDATION_POLICY,
                selectionReason
            },
            sourceForceIds,
            candidateEvaluations: candidates,
            participatingForces
        });
    }
}

export default EnemyForceConsolidationResolver;

