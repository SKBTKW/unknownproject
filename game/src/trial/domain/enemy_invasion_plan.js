import { ENEMY_ACTIVITY_DIRECTIONS } from './enemy_activity_direction_snapshot.js';

export const ENEMY_INVASION_PLAN_SCHEMA_VERSION = 1;

function requireExactKeys(value, keys, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key))) {
        throw new TypeError(`ENEMY_INVASION_PLAN_${label}_INVALID`);
    }
}

function uint32(value) {
    return Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === 'object') freezeDeep(child);
    });
    return Object.freeze(value);
}

/** Immutable result snapshot. Restores consume this result instead of rerolling. */
export class EnemyInvasionPlan {
    #snapshot;

    constructor(snapshot) {
        requireExactKeys(snapshot, [
            'schemaVersion', 'stageId', 'armyId', 'boardSize', 'resolutionPolicy', 'entries'
        ], 'SNAPSHOT');
        if (snapshot.schemaVersion !== ENEMY_INVASION_PLAN_SCHEMA_VERSION
            || !Number.isSafeInteger(snapshot.stageId) || snapshot.stageId < 1
            || typeof snapshot.armyId !== 'string' || !snapshot.armyId
            || !Number.isSafeInteger(snapshot.boardSize) || snapshot.boardSize < 1) {
            throw new TypeError('ENEMY_INVASION_PLAN_IDENTITY_INVALID');
        }
        requireExactKeys(snapshot.resolutionPolicy, ['id', 'version', 'runSeed'], 'POLICY');
        if (typeof snapshot.resolutionPolicy.id !== 'string' || !snapshot.resolutionPolicy.id
            || !Number.isSafeInteger(snapshot.resolutionPolicy.version) || snapshot.resolutionPolicy.version < 1
            || !uint32(snapshot.resolutionPolicy.runSeed)) {
            throw new TypeError('ENEMY_INVASION_PLAN_POLICY_INVALID');
        }
        if (!Array.isArray(snapshot.entries)) throw new TypeError('ENEMY_INVASION_PLAN_ENTRIES_INVALID');

        const sourceIds = new Set();
        const participantIds = new Set();
        const cells = new Set();
        const entries = snapshot.entries.map(entry => {
            requireExactKeys(entry, [
                'sourceForceId', 'participantUnitId', 'activityDirection', 'ingressDirection',
                'ingressCell', 'randomness'
            ], 'ENTRY');
            requireExactKeys(entry.ingressCell, ['r', 'c'], 'CELL');
            requireExactKeys(entry.randomness, ['directionSeed', 'cellSeed'], 'RANDOMNESS');
            const { r, c } = entry.ingressCell;
            if (typeof entry.sourceForceId !== 'string' || !entry.sourceForceId
                || typeof entry.participantUnitId !== 'string' || !entry.participantUnitId
                || sourceIds.has(entry.sourceForceId) || participantIds.has(entry.participantUnitId)
                || !ENEMY_ACTIVITY_DIRECTIONS.includes(entry.activityDirection)
                || !ENEMY_ACTIVITY_DIRECTIONS.includes(entry.ingressDirection)
                || !Number.isSafeInteger(r) || !Number.isSafeInteger(c)
                || r < 0 || c < 0 || r >= snapshot.boardSize || c >= snapshot.boardSize
                || !uint32(entry.randomness.directionSeed) || !uint32(entry.randomness.cellSeed)) {
                throw new TypeError('ENEMY_INVASION_PLAN_ENTRY_INVALID');
            }
            const cellKey = `${r}:${c}`;
            if (cells.has(cellKey)) throw new TypeError('ENEMY_INVASION_PLAN_CELL_DUPLICATE');
            sourceIds.add(entry.sourceForceId);
            participantIds.add(entry.participantUnitId);
            cells.add(cellKey);
            return structuredClone(entry);
        });

        this.#snapshot = freezeDeep({
            ...structuredClone(snapshot),
            entries
        });
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    static fromSnapshot(snapshot) { return new EnemyInvasionPlan(snapshot); }
}
