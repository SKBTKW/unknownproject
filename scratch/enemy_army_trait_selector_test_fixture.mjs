import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';

function generationPolicy(id, version, rotation) {
    const policy = fixturePolicy();
    policy.id = id;
    policy.version = version;
    for (const candidates of Object.values(policy.slots)) {
        candidates.push(...candidates.splice(0, rotation));
    }
    return policy;
}
/** Development/test fixture only. These traits and weights are not production balance. */
export function enemyArmyTraitSelectorFixture() {
    const definitions = [
        { traitId: 'medium-core', weight: 6, id: 'test-medium-core', rotation: 0 },
        { traitId: 'large-leaning', weight: 2, id: 'test-large-leaning', rotation: 1 },
        { traitId: 'small-leaning', weight: 2, id: 'test-small-leaning', rotation: 2 }
    ];
    const version = 1;
    const bindings = definitions.map(definition => ({
        traitId: definition.traitId,
        generationPolicy: generationPolicy(definition.id, version, definition.rotation)
    }));
    return {
        selectionPolicy: {
            id: 'test-army-trait-selection',
            version,
            seedNamespace: 'test-enemy-army-trait-selector-v1',
            traits: definitions.map(definition => ({
                traitId: definition.traitId,
                weight: definition.weight,
                generationPolicy: { id: definition.id, version }
            }))
        },
        bindings
    };
}
