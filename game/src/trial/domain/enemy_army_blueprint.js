import { ACTIVE_EQUIPMENT_TYPES } from '../systems/enemy_force_terrain_interaction_resolver.js';

export const ENEMY_BLUEPRINT_SPECIES = Object.freeze(['LARGE', 'MEDIUM', 'SMALL']);
export const ENEMY_BLUEPRINT_SLOTS = Object.freeze(['A', 'B', 'C']);
export const ENEMY_BLUEPRINT_SCHEMA_VERSION = 1;

export function requireKeys(value, keys, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key))) {
        throw new TypeError(`ENEMY_BLUEPRINT_${label}_INVALID`);
    }
}

export function validateComposition(value, allowed, label) {
    if (!Array.isArray(value) || value.length === 0) throw new TypeError(`ENEMY_BLUEPRINT_${label}_INVALID`);
    const seen = new Set();
    let total = 0;
    for (const entry of value) {
        requireKeys(entry, ['type', 'share'], label);
        if (!allowed.includes(entry.type) || seen.has(entry.type)
            || !Number.isFinite(entry.share) || entry.share <= 0 || entry.share > 1) {
            throw new TypeError(`ENEMY_BLUEPRINT_${label}_INVALID`);
        }
        seen.add(entry.type);
        total += entry.share;
    }
    if (Math.abs(total - 1) > 1e-12) throw new TypeError(`ENEMY_BLUEPRINT_${label}_TOTAL_INVALID`);
}

export function validateForceComposition(value) {
    requireKeys(value, ['speciesComposition', 'equipmentComposition'], 'COMPOSITION');
    validateComposition(value.speciesComposition, ENEMY_BLUEPRINT_SPECIES, 'SPECIES');
    validateComposition(value.equipmentComposition, ACTIVE_EQUIPMENT_TYPES, 'EQUIPMENT');
}

function deepFreeze(value) {
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object') deepFreeze(child);
    }
    return Object.freeze(value);
}

export function blueprintArmyId(runSeed, stageId) {
    return `ENEMY_ARMY_V1_${runSeed}_STAGE_${stageId}`;
}

/** Opt-in truth data only. No runtime ownership, observation or participation policy. */
export class EnemyArmyBlueprint {
    #snapshot;

    constructor(snapshot) {
        requireKeys(snapshot, ['schemaVersion', 'runSeed', 'stageId', 'armyId', 'generationPolicy', 'forces'], 'SNAPSHOT');
        if (snapshot.schemaVersion !== ENEMY_BLUEPRINT_SCHEMA_VERSION
            || !Number.isInteger(snapshot.runSeed) || snapshot.runSeed < 0 || snapshot.runSeed > 0xffffffff
            || snapshot.stageId !== 1
            || snapshot.armyId !== blueprintArmyId(snapshot.runSeed, snapshot.stageId)) {
            throw new TypeError('ENEMY_BLUEPRINT_IDENTITY_INVALID');
        }
        requireKeys(snapshot.generationPolicy, ['id', 'version'], 'POLICY_IDENTITY');
        if (typeof snapshot.generationPolicy.id !== 'string' || !snapshot.generationPolicy.id.trim()
            || !Number.isInteger(snapshot.generationPolicy.version) || snapshot.generationPolicy.version < 1) {
            throw new TypeError('ENEMY_BLUEPRINT_POLICY_IDENTITY_INVALID');
        }
        if (!Array.isArray(snapshot.forces) || snapshot.forces.length !== 3) {
            throw new TypeError('ENEMY_BLUEPRINT_FORCES_INVALID');
        }
        snapshot.forces.forEach((force, index) => {
            requireKeys(force, ['id', 'slot', 'composition'], 'FORCE');
            const slot = ENEMY_BLUEPRINT_SLOTS[index];
            if (force.slot !== slot || force.id !== `${snapshot.armyId}_${slot}`) {
                throw new TypeError('ENEMY_BLUEPRINT_FORCE_IDENTITY_INVALID');
            }
            validateForceComposition(force.composition);
        });
        this.#snapshot = deepFreeze(structuredClone(snapshot));
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    getForce(slot) {
        const force = this.#snapshot.forces.find(entry => entry.slot === slot);
        if (!force) throw new RangeError('ENEMY_BLUEPRINT_SLOT_INVALID');
        return structuredClone(force);
    }

    static fromSnapshot(snapshot) { return new EnemyArmyBlueprint(snapshot); }
}
