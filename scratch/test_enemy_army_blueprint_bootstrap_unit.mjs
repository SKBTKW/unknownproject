import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapEnemyArmyBlueprintNewRun as bootstrap } from '../game/src/trial/integration/enemy_army_blueprint_new_run_bootstrap.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const state = () => ({ stage: { id: 1 }, turn: 1 });
const generate = () => generateEnemyArmyBlueprint({ runSeed: 42, stageId: 1, policy: fixturePolicy() });

test('new Stage1 generates once, reuses the service and stable A/B/C identities', () => {
    const gameState = state(); let calls = 0;
    const options = { gameState, runSeed: 42, isNewRun: true, policy: fixturePolicy(),
        generator: args => { calls++; return generateEnemyArmyBlueprint(args); } };
    const first = bootstrap(options); const before = first.lifecycleService.getSnapshot();
    const second = bootstrap(options);
    assert.equal(calls, 1); assert.equal(first.status, 'GENERATED');
    assert.equal(second.status, 'ALREADY_INITIALIZED');
    assert.equal(first.lifecycleService, second.lifecycleService);
    assert.deepEqual(second.lifecycleService.getSnapshot(), before);
    assert.deepEqual(before.blueprints[0].forces.map(f => f.slot), ['A','B','C']);
});
test('same input replays and varying seeds can change composition', () => {
    const make = runSeed => bootstrap({ gameState: state(), runSeed, isNewRun: true, policy: fixturePolicy() }).lifecycleService.getSnapshot();
    assert.deepEqual(make(42), make(42));
    const signatures = new Set(Array.from({ length: 32 }, (_, seed) => JSON.stringify(make(seed).blueprints[0].forces.map(f => f.composition))));
    assert.ok(signatures.size > 1);
});
test('existing Blueprint wins before policy lookup or generator, conflict remains a lifecycle error', () => {
    const gameState = state(); const service = new EnemyArmyBlueprintLifecycleService({ gameState });
    service.registerBlueprint(1, generate()); const before = service.getSnapshot();
    const result = bootstrap({ gameState, runSeed: 42, isNewRun: true, policy: {}, generator: () => { throw Error('MUST_NOT_GENERATE'); } });
    assert.equal(result.status, 'EXISTING_BLUEPRINT'); assert.deepEqual(service.getSnapshot(), before);
    const changed = generate().getSnapshot(); changed.generationPolicy.version++;
    assert.throws(() => result.lifecycleService.registerBlueprint(1, changed), /ALREADY_REGISTERED/);
});
test('missing production policy stays disabled and cannot be enabled by a later common init call', () => {
    const gameState = state();
    assert.equal(bootstrap({ gameState, runSeed: 42, isNewRun: true }).status, 'POLICY_NOT_CONFIGURED');
    bootstrap({ gameState, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('LATE_GENERATION'); } });
    assert.equal(Object.hasOwn(gameState, 'enemyArmyBlueprintState'), false);
});
test('Restore at Verse1, legacy or occupied, never generates or rearms initialization', () => {
    for (const occupied of [false, true]) {
        const gameState = state();
        if (occupied) new EnemyArmyBlueprintLifecycleService({ gameState }).registerBlueprint(1, generate());
        const before = structuredClone(gameState);
        const options = { gameState, runSeed: 42, isNewRun: false, policy: fixturePolicy(), generator: () => { throw Error('RESTORE_GENERATION'); } };
        assert.equal(bootstrap(options).status, 'RESTORE_ONLY');
        bootstrap({ ...options, isNewRun: true });
        assert.deepEqual(gameState, before);
    }
});
test('unsupported Stage never invokes generation', () => {
    const gameState = { stage: { id: 2 } };
    assert.equal(bootstrap({ gameState, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('STAGE2_GENERATION'); } }).status, 'STAGE_NOT_SUPPORTED');
    assert.equal(Object.hasOwn(gameState, 'enemyArmyBlueprintState'), false);
});
test('generation/validation failure is atomic and cannot silently retry', () => {
    for (const generator of [() => { throw Error('INJECTED_GENERATOR_FAILURE'); }, () => ({})]) {
        const gameState = state(); const before = structuredClone(gameState); let calls = 0;
        const options = { gameState, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: args => { calls++; return generator(args); } };
        assert.throws(() => bootstrap(options)); assert.deepEqual(gameState, before);
        assert.throws(() => bootstrap(options)); assert.equal(calls, 1);
    }
});
test('corrupt stored Blueprint is rejected and never repaired using a generator', () => {
    const gameState = { ...state(), enemyArmyBlueprintState: {} };
    assert.throws(() => bootstrap({ gameState, runSeed: 42, isNewRun: true, policy: fixturePolicy(), generator: () => { throw Error('CORRUPTION_REPAIR'); } }), /SNAPSHOT_INVALID/);
});
