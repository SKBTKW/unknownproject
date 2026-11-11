import { RandomSource } from '../../core/check_system/random_source.js';
import { ENEMY_BLUEPRINT_SLOTS } from '../domain/enemy_army_blueprint.js';
import {
    EnemyActivityDirectionSnapshot,
    ENEMY_ACTIVITY_DIRECTIONS
} from '../domain/enemy_activity_direction_snapshot.js';
import { EnemyInvasionPlan, ENEMY_INVASION_PLAN_SCHEMA_VERSION } from '../domain/enemy_invasion_plan.js';
import { deriveEnemyArmyStreamSeed } from './enemy_army_seed_derivation.js';

export const ENEMY_INVASION_RESOLUTION_POLICY = Object.freeze({
    id: 'enemy-invasion-entry',
    version: 1,
    weights: Object.freeze({ same: 70, clockwise: 15, counterclockwise: 15, opposite: 0 })
});

const CLOCKWISE = Object.freeze({ NORTH: 'EAST', EAST: 'SOUTH', SOUTH: 'WEST', WEST: 'NORTH' });
const COUNTERCLOCKWISE = Object.freeze({ NORTH: 'WEST', WEST: 'SOUTH', SOUTH: 'EAST', EAST: 'NORTH' });
const OPPOSITE = Object.freeze({ NORTH: 'SOUTH', SOUTH: 'NORTH', EAST: 'WEST', WEST: 'EAST' });

function normalizeRoll(value) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new TypeError('ENEMY_INVASION_ROLL_INVALID');
    }
    return value;
}

export function resolveIngressDirection(activityDirection, roll) {
    if (!ENEMY_ACTIVITY_DIRECTIONS.includes(activityDirection)) {
        throw new TypeError('ENEMY_INVASION_ACTIVITY_DIRECTION_INVALID');
    }
    const normalized = normalizeRoll(roll);
    if (normalized < 0.70) return activityDirection;
    if (normalized < 0.85) return CLOCKWISE[activityDirection];
    return COUNTERCLOCKWISE[activityDirection];
}

export function oppositeDirection(direction) {
    if (!ENEMY_ACTIVITY_DIRECTIONS.includes(direction)) {
        throw new TypeError('ENEMY_INVASION_DIRECTION_INVALID');
    }
    return OPPOSITE[direction];
}

export function listEdgeCells(boardSize, direction) {
    if (!Number.isSafeInteger(boardSize) || boardSize < 1
        || !ENEMY_ACTIVITY_DIRECTIONS.includes(direction)) {
        throw new TypeError('ENEMY_INVASION_EDGE_INPUT_INVALID');
    }
    return Array.from({ length: boardSize }, (_, index) => {
        if (direction === 'NORTH') return { r: 0, c: index };
        if (direction === 'EAST') return { r: index, c: boardSize - 1 };
        if (direction === 'SOUTH') return { r: boardSize - 1, c: index };
        return { r: index, c: 0 };
    });
}

function requireParticipants(participants, directions) {
    if (!Array.isArray(participants)) throw new TypeError('ENEMY_INVASION_PARTICIPANTS_INVALID');
    const bySource = new Map();
    const participantIds = new Set();
    for (const participant of participants) {
        if (!participant || Object.getPrototypeOf(participant) !== Object.prototype
            || Object.keys(participant).length !== 2
            || typeof participant.sourceForceId !== 'string' || !directions.getForce(participant.sourceForceId)
            || typeof participant.participantUnitId !== 'string' || !participant.participantUnitId
            || bySource.has(participant.sourceForceId) || participantIds.has(participant.participantUnitId)) {
            throw new TypeError('ENEMY_INVASION_PARTICIPANT_INVALID');
        }
        bySource.set(participant.sourceForceId, participant);
        participantIds.add(participant.participantUnitId);
    }
    return bySource;
}

/**
 * Pure foundation resolver. It does not inspect board contents, defenses,
 * Warning/Known state, UI state, or the live gameplay RNG stream.
 */
export class EnemyInvasionEntryResolver {
    resolve({ stageId, armyId, runSeed, boardSize, directionSnapshot, participants } = {}) {
        if (!Number.isSafeInteger(stageId) || stageId < 1
            || typeof armyId !== 'string' || !armyId
            || !Number.isInteger(runSeed) || runSeed < 0 || runSeed > 0xffffffff
            || !Number.isSafeInteger(boardSize) || boardSize < 1) {
            throw new TypeError('ENEMY_INVASION_RESOLUTION_INPUT_INVALID');
        }
        const directions = EnemyActivityDirectionSnapshot.fromSnapshot(
            directionSnapshot instanceof EnemyActivityDirectionSnapshot
                ? directionSnapshot.getSnapshot()
                : directionSnapshot
        );
        const directionData = directions.getSnapshot();
        if (directionData.stageId !== stageId || directionData.armyId !== armyId) {
            throw new TypeError('ENEMY_INVASION_DIRECTION_SNAPSHOT_MISMATCH');
        }
        const participantBySource = requireParticipants(participants, directions);
        const usedCells = new Set();
        const entries = [];

        for (const slot of ENEMY_BLUEPRINT_SLOTS) {
            const sourceForceId = `${armyId}_${slot}`;
            const participant = participantBySource.get(sourceForceId);
            if (!participant) continue;
            const activityDirection = directions.getForce(sourceForceId).activityDirection;
            const directionSeed = deriveEnemyArmyStreamSeed([
                'enemy-invasion-entry-v1', runSeed, stageId, armyId, sourceForceId, 'direction'
            ]);
            const cellSeed = deriveEnemyArmyStreamSeed([
                'enemy-invasion-entry-v1', runSeed, stageId, armyId, sourceForceId, 'cell'
            ]);
            const ingressDirection = resolveIngressDirection(
                activityDirection,
                new RandomSource(directionSeed).nextFloat()
            );
            const candidates = listEdgeCells(boardSize, ingressDirection)
                .filter(cell => !usedCells.has(`${cell.r}:${cell.c}`));
            if (candidates.length === 0) {
                const error = new RangeError('ENEMY_INVASION_CANDIDATES_EXHAUSTED');
                error.sourceForceId = sourceForceId;
                error.ingressDirection = ingressDirection;
                throw error;
            }
            const cellSource = new RandomSource(cellSeed);
            const ingressCell = candidates[cellSource.nextInt(0, candidates.length - 1)];
            usedCells.add(`${ingressCell.r}:${ingressCell.c}`);
            entries.push({
                sourceForceId,
                participantUnitId: participant.participantUnitId,
                activityDirection,
                ingressDirection,
                ingressCell,
                randomness: { directionSeed, cellSeed }
            });
        }

        return new EnemyInvasionPlan({
            schemaVersion: ENEMY_INVASION_PLAN_SCHEMA_VERSION,
            stageId,
            armyId,
            boardSize,
            resolutionPolicy: {
                id: ENEMY_INVASION_RESOLUTION_POLICY.id,
                version: ENEMY_INVASION_RESOLUTION_POLICY.version,
                runSeed
            },
            entries
        });
    }
}

export default EnemyInvasionEntryResolver;
