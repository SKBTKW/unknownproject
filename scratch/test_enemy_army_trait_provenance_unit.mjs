import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    EnemyArmyTraitProvenance,
    ENEMY_ARMY_TRAIT_PROVENANCE_SCHEMA_VERSION
} from '../game/src/trial/domain/enemy_army_trait_provenance.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import {
    createEnemyArmyTraitProvenance,
    resolveEnemyArmyTraitGenerationPolicy,
    selectEnemyArmyTrait
} from '../game/src/trial/systems/enemy_army_trait_selector.js';
import { enemyArmyTraitSelectorFixture } from './enemy_army_trait_selector_test_fixture.mjs';

function make(seed = 42) {
    const fixture = enemyArmyTraitSelectorFixture();
    const selection = selectEnemyArmyTrait({ runSeed: seed, stageId: 1, policy: fixture.selectionPolicy });
    const policy = resolveEnemyArmyTraitGenerationPolicy({ selection, bindings: fixture.bindings });
    return {
        selection,
        provenance: createEnemyArmyTraitProvenance(selection),
        blueprint: generateEnemyArmyBlueprint({ runSeed: seed, stageId: 1, policy })
    };
}

test('1: selection produces the minimal immutable provenance contract', () => {
    const { selection, provenance, blueprint } = make();
    assert.equal(Object.isFrozen(provenance), true);
    assert.deepEqual(provenance.getSnapshot(), {
        schemaVersion: ENEMY_ARMY_TRAIT_PROVENANCE_SCHEMA_VERSION,
        stageId: 1,
        traitId: selection.traitId,
        selectionPolicy: selection.selectionPolicy,
        generationPolicy: selection.generationPolicy
    });
    assert.equal(Object.hasOwn(provenance.getSnapshot(), 'runSeed'), false);
    assert.equal(Object.hasOwn(provenance.getSnapshot(), 'reproducibility'), false);
    const repeated = make();
    assert.deepEqual(repeated.provenance.getSnapshot(), provenance.getSnapshot());
    assert.deepEqual(repeated.blueprint.getSnapshot(), blueprint.getSnapshot());
});

test('2: JSON roundtrip preserves provenance exactly', () => {
    const original = make().provenance.getSnapshot();
    const restored = EnemyArmyTraitProvenance.fromSnapshot(JSON.parse(JSON.stringify(original)));
    assert.deepEqual(restored.getSnapshot(), original);
});

test('3: malformed provenance fields and schema versions are rejected explicitly', () => {
    const valid = make().provenance.getSnapshot();
    const mutations = [
        value => { value.schemaVersion = 2; },
        value => { value.stageId = 0; },
        value => { value.traitId = ''; },
        value => { value.traitId = 'UPPER_CASE'; },
        value => { value.selectionPolicy.id = ''; },
        value => { value.selectionPolicy.version = 0; },
        value => { value.generationPolicy.id = 'INVALID'; },
        value => { value.generationPolicy.extra = true; },
        value => { value.extra = true; },
        value => { delete value.traitId; }
    ];
    for (const mutate of mutations) {
        const invalid = structuredClone(valid); mutate(invalid);
        assert.throws(() => EnemyArmyTraitProvenance.fromSnapshot(invalid), /PROVENANCE/);
    }
    for (const invalid of [null, undefined, [], {}, 'invalid']) {
        assert.throws(() => EnemyArmyTraitProvenance.fromSnapshot(invalid), /PROVENANCE/);
    }
});

test('4: Blueprint and provenance register as one Stage association', () => {
    const service = new EnemyArmyBlueprintLifecycleService();
    const { blueprint, provenance } = make();
    const result = service.registerBlueprint(1, blueprint, provenance);
    assert.equal(result.registered, true);
    assert.equal(result.provenanceRegistered, true);
    assert.deepEqual(service.getBlueprint(1).getSnapshot(), blueprint.getSnapshot());
    assert.deepEqual(service.getProvenance(1).getSnapshot(), provenance.getSnapshot());
    assert.deepEqual(blueprint.getSnapshot().generationPolicy, provenance.getSnapshot().generationPolicy);
});

test('5: same Blueprint and same provenance registration is idempotent', () => {
    const service = new EnemyArmyBlueprintLifecycleService();
    const { blueprint, provenance } = make();
    service.registerBlueprint(1, blueprint, provenance);
    const before = structuredClone({ blueprint: service.getSnapshot(), provenance: service.getProvenanceSnapshot() });
    const result = service.registerBlueprint(1, blueprint.getSnapshot(), provenance.getSnapshot());
    assert.equal(result.registered, false);
    assert.equal(result.provenanceRegistered, false);
    assert.deepEqual({ blueprint: service.getSnapshot(), provenance: service.getProvenanceSnapshot() }, before);
});

test('6: an existing Blueprint cannot be associated with different provenance', () => {
    const service = new EnemyArmyBlueprintLifecycleService();
    const { blueprint, provenance } = make();
    service.registerBlueprint(1, blueprint, provenance);
    const before = service.getProvenanceSnapshot();
    const conflict = provenance.getSnapshot(); conflict.traitId = 'different-valid-trait';
    assert.throws(() => service.registerBlueprint(1, blueprint, conflict), /PROVENANCE_ALREADY_REGISTERED/);
    assert.deepEqual(service.getProvenanceSnapshot(), before);
});

test('7: Stage mismatch and concrete generation-policy mismatch fail before writes', () => {
    const { blueprint, provenance } = make();
    for (const mutate of [
        value => { value.stageId = 2; },
        value => { value.generationPolicy.id = 'different-concrete-policy'; },
        value => { value.generationPolicy.version += 1; }
    ]) {
        const service = new EnemyArmyBlueprintLifecycleService();
        const invalid = provenance.getSnapshot(); mutate(invalid);
        assert.throws(() => service.registerBlueprint(1, blueprint, invalid), /MISMATCH/);
        assert.deepEqual(service.getSnapshot().blueprints, []);
        assert.deepEqual(service.getProvenanceSnapshot().provenances, []);
    }
});

test('8: detached input and output mutation cannot alter registered provenance', () => {
    const service = new EnemyArmyBlueprintLifecycleService();
    const { blueprint, provenance } = make();
    const input = provenance.getSnapshot(); service.registerBlueprint(1, blueprint, input);
    const before = service.getProvenanceSnapshot();
    input.traitId = 'changed-input';
    service.getProvenanceSnapshot().provenances[0].traitId = 'changed-snapshot';
    service.getProvenance(1).getSnapshot().selectionPolicy.id = 'changed-model';
    assert.deepEqual(service.getProvenanceSnapshot(), before);
});

test('9: an explicit provenance may attach to a matching legacy Blueprint without inference', () => {
    const service = new EnemyArmyBlueprintLifecycleService();
    const { blueprint, provenance } = make();
    service.registerBlueprint(1, blueprint);
    assert.equal(service.getProvenance(1), null);
    const attached = service.registerBlueprint(1, blueprint, provenance);
    assert.equal(attached.registered, false);
    assert.equal(attached.provenanceRegistered, true);
    assert.deepEqual(service.getProvenance(1).getSnapshot(), provenance.getSnapshot());
});

test('10: provenance-only state and restore are rejected atomically', () => {
    const { provenance } = make();
    const provenanceState = { schemaVersion: 1, provenances: [provenance.getSnapshot()] };
    assert.throws(() => new EnemyArmyBlueprintLifecycleService({
        gameState: { enemyArmyTraitProvenanceState: provenanceState }
    }), /BLUEPRINT_REQUIRED/);
    const service = new EnemyArmyBlueprintLifecycleService();
    const before = { blueprint: service.getSnapshot(), provenance: service.getProvenanceSnapshot() };
    assert.throws(() => service.restoreSnapshot(
        { schemaVersion: 1, blueprints: [] }, provenanceState
    ), /BLUEPRINT_REQUIRED/);
    assert.deepEqual({ blueprint: service.getSnapshot(), provenance: service.getProvenanceSnapshot() }, before);
});
