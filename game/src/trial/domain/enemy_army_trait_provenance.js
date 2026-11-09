export const ENEMY_ARMY_TRAIT_PROVENANCE_SCHEMA_VERSION = 1;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function requireKeys(value, expected, label) {
    if (!value || Object.getPrototypeOf(value) !== Object.prototype
        || Object.keys(value).length !== expected.length
        || expected.some(key => !Object.hasOwn(value, key))) {
        throw new TypeError(`ENEMY_ARMY_TRAIT_PROVENANCE_${label}_INVALID`);
    }
}

function copyPolicyIdentity(identity, label) {
    requireKeys(identity, ['id', 'version'], label);
    if (typeof identity.id !== 'string' || !ID_PATTERN.test(identity.id)
        || !Number.isInteger(identity.version) || identity.version < 1) {
        throw new TypeError(`ENEMY_ARMY_TRAIT_PROVENANCE_${label}_INVALID`);
    }
    return { id: identity.id, version: identity.version };
}

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === 'object') freezeDeep(child);
    });
    return Object.freeze(value);
}

/** Immutable generation provenance only; never an instruction to regenerate a Blueprint. */
export class EnemyArmyTraitProvenance {
    #snapshot;

    constructor(snapshot) {
        requireKeys(snapshot, [
            'schemaVersion', 'stageId', 'traitId', 'selectionPolicy', 'generationPolicy'
        ], 'SNAPSHOT');
        if (snapshot.schemaVersion !== ENEMY_ARMY_TRAIT_PROVENANCE_SCHEMA_VERSION
            || !Number.isSafeInteger(snapshot.stageId) || snapshot.stageId < 1
            || typeof snapshot.traitId !== 'string' || !ID_PATTERN.test(snapshot.traitId)) {
            throw new TypeError('ENEMY_ARMY_TRAIT_PROVENANCE_IDENTITY_INVALID');
        }
        this.#snapshot = freezeDeep({
            schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_SCHEMA_VERSION,
            stageId: snapshot.stageId,
            traitId: snapshot.traitId,
            selectionPolicy: copyPolicyIdentity(snapshot.selectionPolicy, 'SELECTION_POLICY'),
            generationPolicy: copyPolicyIdentity(snapshot.generationPolicy, 'GENERATION_POLICY')
        });
        Object.freeze(this);
    }

    getSnapshot() { return structuredClone(this.#snapshot); }

    static fromSnapshot(snapshot) { return new EnemyArmyTraitProvenance(snapshot); }
}
