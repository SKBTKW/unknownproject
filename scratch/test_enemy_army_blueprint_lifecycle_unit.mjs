import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnemyArmyBlueprintLifecycleService as Service } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const make = (seed = 42) => generateEnemyArmyBlueprint({ runSeed: seed, stageId: 1, policy: fixturePolicy() });

test('constructor is inert; registration, detached access and absent stages', () => {
    const gameState = {}; const service = new Service({ gameState });
    assert.deepEqual(gameState, {});
    assert.equal(service.getBlueprint(1), null);
    assert.equal(service.registerBlueprint(1, make()).registered, true);
    assert.deepEqual(service.getBlueprint(1).getSnapshot(), make().getSnapshot());
    assert.equal(service.getBlueprint(2), null);
    assert.ok(Object.isFrozen(gameState.enemyArmyBlueprintState.blueprints[0].forces[0]));
});
test('same content registration is idempotent, regardless of object key insertion order', () => {
    const service = new Service(); const snapshot = make().getSnapshot();
    service.registerBlueprint(1, snapshot);
    const reordered = Object.fromEntries(Object.entries(snapshot).reverse());
    assert.equal(service.registerBlueprint(1, reordered).registered, false);
    assert.deepEqual(service.getSnapshot().blueprints, [snapshot]);
});
test('same Stage cannot silently change army identity, policy or composition', () => {
    const service = new Service(); service.registerBlueprint(1, make()); const before = service.getSnapshot();
    assert.throws(() => service.registerBlueprint(1, make(43)), /ALREADY_REGISTERED/);
    const changed = make().getSnapshot(); changed.generationPolicy.version++;
    assert.throws(() => service.registerBlueprint(1, changed), /ALREADY_REGISTERED/);
    const composition = make().getSnapshot(); composition.forces[0].composition.speciesComposition = [{ type: 'LARGE', share: 1 }];
    assert.throws(() => service.registerBlueprint(1, composition), /ALREADY_REGISTERED/);
    assert.deepEqual(service.getSnapshot(), before);
});
test('registration stage and Blueprint model validation are both enforced atomically', () => {
    const service = new Service(); const before = service.getSnapshot();
    assert.throws(() => service.registerBlueprint(2, make()), /STAGE_MISMATCH/);
    for (const stage of [0, -1, 1.5, '1', null, undefined, NaN]) {
        assert.throws(() => service.registerBlueprint(stage, make()), /STAGE_INVALID/);
        assert.throws(() => service.getBlueprint(stage), /STAGE_INVALID/);
    }
    for (const mutate of [s => { s.schemaVersion = 2; }, s => { delete s.armyId; },
        s => { s.armyId = 'invalid'; }, s => { s.forces[1].id = s.forces[0].id; },
        s => { s.forces[0].composition.equipmentComposition[0].type = 'INVALID'; },
        s => { s.forces[0].composition.speciesComposition[0].share = -1; }]) {
        const invalid = make().getSnapshot(); mutate(invalid);
        assert.throws(() => service.registerBlueprint(1, invalid), /ENEMY_BLUEPRINT/);
    }
    assert.deepEqual(service.getSnapshot(), before);
});
test('input and returned snapshots cannot mutate stored truth', () => {
    const service = new Service(); const snapshot = make().getSnapshot(); service.registerBlueprint(1, snapshot);
    const before = service.getSnapshot(); snapshot.forces.length = 0;
    service.getSnapshot().blueprints[0].forces.length = 0;
    service.getBlueprint(1).getSnapshot().forces.length = 0;
    assert.deepEqual(service.getSnapshot(), before);
});
test('JSON restore is detached, repeatable and replaces only by explicit restore', () => {
    const first = new Service(); first.registerBlueprint(1, make());
    const saved = JSON.parse(JSON.stringify(first.getSnapshot())); const second = new Service();
    assert.deepEqual(second.restoreSnapshot(saved), first.getSnapshot());
    assert.deepEqual(second.restoreSnapshot(saved), first.getSnapshot());
    saved.blueprints.length = 0;
    assert.deepEqual(second.getSnapshot(), first.getSnapshot());
});
test('invalid envelope, duplicate stages and partial restore leave existing data intact', () => {
    const service = new Service(); service.registerBlueprint(1, make()); const before = service.getSnapshot();
    const invalids = [null, undefined, [], {}, { schemaVersion: 2, blueprints: [] },
        { schemaVersion: 1, blueprints: {} }, { schemaVersion: 1, blueprints: [], extra: true },
        { schemaVersion: 1, blueprints: [make().getSnapshot(), make().getSnapshot()] },
        { schemaVersion: 1, blueprints: [make().getSnapshot(), {}] },
        { schemaVersion: 1, blueprints: Array(1) }];
    for (const invalid of invalids) {
        assert.throws(() => service.restoreSnapshot(invalid), /BLUEPRINT/);
        assert.deepEqual(service.getSnapshot(), before);
    }
});
test('Stage2/3 data remains unsupported by the existing model, not invented for persistence', () => {
    const service = new Service();
    for (const stageId of [2, 3]) {
        const candidate = make().getSnapshot(); candidate.stageId = stageId;
        assert.throws(() => service.registerBlueprint(stageId, candidate), /ENEMY_BLUEPRINT_IDENTITY_INVALID/);
    }
    assert.deepEqual(service.getSnapshot().blueprints, []);
});

test('existing state is validated and detached on construction without generation', () => {
    const source = { schemaVersion: 1, blueprints: [make().getSnapshot()] };
    const gameState = { enemyArmyBlueprintState: source };
    const service = new Service({ gameState });
    source.blueprints.length = 0;
    assert.equal(service.getSnapshot().blueprints.length, 1);
    assert.ok(Object.isFrozen(gameState.enemyArmyBlueprintState));
    assert.throws(() => new Service({ gameState: { enemyArmyBlueprintState: null } }), /SNAPSHOT_INVALID/);
});
