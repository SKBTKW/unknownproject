import { EnemyArmyTraitProvenance } from './enemy_army_trait_provenance.js';
import { copyBlueprintLifecycleSnapshot } from './enemy_army_blueprint_lifecycle_state.js';

export const ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION = 1;

export function copyEnemyArmyTraitProvenanceState(snapshot) {
    if (!snapshot || Object.getPrototypeOf(snapshot) !== Object.prototype
        || Object.keys(snapshot).length !== 2
        || !Object.hasOwn(snapshot, 'schemaVersion') || !Object.hasOwn(snapshot, 'provenances')
        || snapshot.schemaVersion !== ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION
        || !Array.isArray(snapshot.provenances)) {
        throw new TypeError('ENEMY_ARMY_TRAIT_PROVENANCE_STATE_INVALID');
    }
    const stages = new Set();
    const provenances = Array.from(snapshot.provenances, entry => {
        const provenance = EnemyArmyTraitProvenance.fromSnapshot(entry).getSnapshot();
        if (stages.has(provenance.stageId)) {
            throw new TypeError('ENEMY_ARMY_TRAIT_PROVENANCE_DUPLICATE_STAGE');
        }
        stages.add(provenance.stageId);
        return provenance;
    });
    provenances.sort((left, right) => left.stageId - right.stageId);
    return { schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION, provenances };
}

export function readEnemyArmyTraitProvenanceState(gameState) {
    return Object.hasOwn(gameState, 'enemyArmyTraitProvenanceState')
        ? copyEnemyArmyTraitProvenanceState(gameState.enemyArmyTraitProvenanceState)
        : { schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_STATE_SCHEMA_VERSION, provenances: [] };
}

export function validateEnemyArmyTraitProvenanceAssociations(blueprintState, provenanceState) {
    const blueprints = copyBlueprintLifecycleSnapshot(blueprintState);
    const provenances = copyEnemyArmyTraitProvenanceState(provenanceState);
    for (const provenance of provenances.provenances) {
        const blueprint = blueprints.blueprints.find(entry => entry.stageId === provenance.stageId);
        if (!blueprint) throw new TypeError('ENEMY_ARMY_TRAIT_PROVENANCE_BLUEPRINT_REQUIRED');
        if (blueprint.generationPolicy.id !== provenance.generationPolicy.id
            || blueprint.generationPolicy.version !== provenance.generationPolicy.version) {
            throw new TypeError('ENEMY_ARMY_TRAIT_PROVENANCE_GENERATION_POLICY_MISMATCH');
        }
    }
    return { blueprintState: blueprints, provenanceState: provenances };
}

export function freezeEnemyArmyTraitProvenanceState(snapshot) {
    const copied = copyEnemyArmyTraitProvenanceState(snapshot);
    const freeze = value => {
        Object.values(value).forEach(child => {
            if (child && typeof child === 'object') freeze(child);
        });
        return Object.freeze(value);
    };
    return freeze(copied);
}
