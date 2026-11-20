import { ENEMY_BLUEPRINT_SLOTS } from './enemy_army_blueprint.js';

export const ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION = 1;
export const ENEMY_ACTIVITY_DIRECTIONS = Object.freeze(['NORTH', 'EAST', 'SOUTH', 'WEST']);

function requireExactKeys(value, keys, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key))) {
        throw new TypeError(`ENEMY_ACTIVITY_DIRECTION_${label}_INVALID`);
    }
}

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === 'object') freezeDeep(child);
    });
    return Object.freeze(value);
}

/** Explicit enemy truth. This contract never generates or changes directions. */
export class EnemyActivityDirectionSnapshot {
    #snapshot;

    constructor(snapshot) {
        requireExactKeys(snapshot, ['schemaVersion', 'stageId', 'armyId', 'forces'], 'SNAPSHOT');
        if (snapshot.schemaVersion !== ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION
            || !Number.isSafeInteger(snapshot.stageId) || snapshot.stageId < 1
            || typeof snapshot.armyId !== 'string' || !snapshot.armyId) {
            throw new TypeError('ENEMY_ACTIVITY_DIRECTION_IDENTITY_INVALID');
        }
        if (!Array.isArray(snapshot.forces) || snapshot.forces.length !== ENEMY_BLUEPRINT_SLOTS.length) {
            throw new TypeError('ENEMY_ACTIVITY_DIRECTION_FORCES_INVALID');
        }
        const forces = snapshot.forces.map((force, index) => {
            requireExactKeys(force, ['sourceForceId', 'slot', 'activityDirection'], 'FORCE');
            const slot = ENEMY_BLUEPRINT_SLOTS[index];
            if (force.slot !== slot
                || force.sourceForceId !== `${snapshot.armyId}_${slot}`
                || !ENEMY_ACTIVITY_DIRECTIONS.includes(force.activityDirection)) {
                throw new TypeError('ENEMY_ACTIVITY_DIRECTION_FORCE_INVALID');
            }
            return { ...force };
        });
        this.#snapshot = freezeDeep({
            schemaVersion: ENEMY_ACTIVITY_DIRECTION_SCHEMA_VERSION,
            stageId: snapshot.stageId,
            armyId: snapshot.armyId,
            forces
        });
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    getForce(sourceForceId) {
        const force = this.#snapshot.forces.find(entry => entry.sourceForceId === sourceForceId);
        return force ? structuredClone(force) : null;
    }

    static fromSnapshot(snapshot) { return new EnemyActivityDirectionSnapshot(snapshot); }
}
