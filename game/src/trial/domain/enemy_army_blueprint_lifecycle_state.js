import { EnemyArmyBlueprint } from './enemy_army_blueprint.js';

export const ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION = 1;

/** Validate the envelope here; all army validation belongs to EnemyArmyBlueprint. */
export function copyBlueprintLifecycleSnapshot(snapshot) {
    if (!snapshot || Object.getPrototypeOf(snapshot) !== Object.prototype
        || Object.keys(snapshot).length !== 2
        || !Object.hasOwn(snapshot, 'schemaVersion') || !Object.hasOwn(snapshot, 'blueprints')
        || snapshot.schemaVersion !== ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION
        || !Array.isArray(snapshot.blueprints)) {
        throw new TypeError('BLUEPRINT_LIFECYCLE_SNAPSHOT_INVALID');
    }
    const stages = new Set();
    let runSeed = null;
    // Array.from visits holes too, so a sparse save cannot silently drop an entry.
    const blueprints = Array.from(snapshot.blueprints, entry => {
        const blueprint = EnemyArmyBlueprint.fromSnapshot(entry).getSnapshot();
        if (stages.has(blueprint.stageId)) throw new TypeError('BLUEPRINT_LIFECYCLE_DUPLICATE_STAGE');
        if (runSeed !== null && runSeed !== blueprint.runSeed) throw new TypeError('BLUEPRINT_LIFECYCLE_RUN_SEED_MISMATCH');
        stages.add(blueprint.stageId);
        runSeed = blueprint.runSeed;
        return blueprint;
    });
    blueprints.sort((a, b) => a.stageId - b.stageId);
    return { schemaVersion: ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION, blueprints };
}

export function readBlueprintLifecycleSnapshot(gameState) {
    return Object.hasOwn(gameState, 'enemyArmyBlueprintState')
        ? copyBlueprintLifecycleSnapshot(gameState.enemyArmyBlueprintState)
        : { schemaVersion: ENEMY_BLUEPRINT_LIFECYCLE_SCHEMA_VERSION, blueprints: [] };
}

export function freezeBlueprintLifecycleSnapshot(snapshot) {
    const copied = copyBlueprintLifecycleSnapshot(snapshot);
    const freeze = value => {
        Object.values(value).forEach(child => {
            if (child && typeof child === 'object') freeze(child);
        });
        return Object.freeze(value);
    };
    return freeze(copied);
}
