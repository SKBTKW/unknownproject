import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { EnemyArmyBlueprintLifecycleService as Service } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const make = (version = 1) => {
    const policy = fixturePolicy(); policy.version = version;
    return generateEnemyArmyBlueprint({ runSeed: 42, stageId: 1, policy });
};
const setup = () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const service = new Service({ gameState: engine.state });
    const masters = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    return { engine, service, options: { resolveCardMaster: id => masters.find(card => card.id === id) } };
};

test('unregistered save shape stays unchanged and populated JSON save roundtrips repeatedly', () => {
    const { engine, service, options } = setup();
    const legacy = serializeGameState(engine.state);
    assert.equal(Object.hasOwn(legacy, 'enemyArmyBlueprintState'), false);
    service.registerBlueprint(1, make());
    const saved = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
    const savedCopy = structuredClone(saved);
    assert.deepEqual(saved.enemyArmyBlueprintState, service.getSnapshot());
    const target = setup();
    for (let repeat = 0; repeat < 3; repeat++) {
        hydrateGameState(target.engine.state, saved, target.options);
        assert.deepEqual(target.service.getSnapshot(), service.getSnapshot());
    }
    assert.deepEqual(saved, savedCopy);
    saved.enemyArmyBlueprintState.blueprints[0].forces.length = 0;
    assert.deepEqual(target.service.getSnapshot(), service.getSnapshot());
    hydrateGameState(engine.state, legacy, options);
    assert.equal(service.getBlueprint(1), null);
    assert.equal(Object.hasOwn(engine.state, 'enemyArmyBlueprintState'), false);
    assert.deepEqual(serializeGameState(engine.state), legacy);
});
test('invalid Blueprint preflight leaves world, existing army and input save untouched', () => {
    const { engine, service, options } = setup(); service.registerBlueprint(1, make());
    const before = serializeGameState(engine.state);
    const mutations = [
        s => { s.enemyArmyBlueprintState = null; },
        s => { s.enemyArmyBlueprintState = undefined; },
        s => { s.enemyArmyBlueprintState.schemaVersion = 2; },
        s => { s.enemyArmyBlueprintState.blueprints.push(make().getSnapshot()); },
        s => { delete s.enemyArmyBlueprintState.blueprints[0].armyId; },
        s => { s.enemyArmyBlueprintState.blueprints[0].stageId = 2; },
        s => { s.enemyArmyBlueprintState.blueprints[0].forces[1].id = s.enemyArmyBlueprintState.blueprints[0].forces[0].id; },
        s => { s.enemyArmyBlueprintState.blueprints[0].forces = Array(3); },
        s => { s.enemyArmyBlueprintState.blueprints[0].forces[0].composition.speciesComposition = []; },
        s => { s.enemyArmyBlueprintState.blueprints[0].forces[0].composition.equipmentComposition[0].type = 'INVALID'; }
    ];
    for (const mutate of mutations) {
        const invalid = structuredClone(before); invalid.turn = 99; invalid.food = 999; mutate(invalid);
        const originalInput = structuredClone(invalid);
        assert.throws(() => hydrateGameState(engine.state, invalid, options), /BLUEPRINT/);
        assert.deepEqual(serializeGameState(engine.state), before);
        assert.deepEqual(invalid, originalInput);
    }
});
test('base hydration failure also leaves a validated replacement army unapplied', () => {
    const { engine, service, options } = setup(); service.registerBlueprint(1, make());
    const before = serializeGameState(engine.state); const invalid = structuredClone(before);
    invalid.enemyArmyBlueprintState.blueprints = [make(2).getSnapshot()];
    invalid.handOffering = [{ cardMasterId: 'DOES_NOT_EXIST' }];
    assert.throws(() => hydrateGameState(engine.state, invalid, options), /HYDRATE_CARD_MASTER_NOT_FOUND/);
    assert.deepEqual(serializeGameState(engine.state), before);
});
test('both History capture paths include registered truth; Verse restore uses saved army', () => {
    const { engine, service } = setup(); service.registerBlueprint(1, make());
    const expected = service.getSnapshot();
    const point = engine.historySnapshotService.captureRestorePoint({ verse: 1 });
    const committed = engine.historySnapshotService.capture({ completedTurn: 1, nextTurn: 2 });
    assert.deepEqual(point.gameState.enemyArmyBlueprintState, expected);
    assert.deepEqual(committed.gameState.enemyArmyBlueprintState, expected);
    service.restoreSnapshot({ schemaVersion: 1, blueprints: [make(2).getSnapshot()] });
    assert.notDeepEqual(service.getSnapshot(), expected);
    for (let repeat = 0; repeat < 2; repeat++) {
        assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
        assert.deepEqual(service.getSnapshot(), expected);
    }
});
test('legacy History restore clears a future army rather than retaining or generating one', () => {
    const { engine, service } = setup();
    const legacy = engine.historySnapshotService.getRestorePoint(1);
    assert.equal(Object.hasOwn(legacy.gameState, 'enemyArmyBlueprintState'), false);
    service.registerBlueprint(1, make());
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.equal(service.getBlueprint(1), null);
});
test('History restore rollback recovers future army after a later subsystem failure', () => {
    const { engine, service } = setup(); service.registerBlueprint(1, make());
    engine.historySnapshotService.captureRestorePoint({ verse: 1 });
    service.restoreSnapshot({ schemaVersion: 1, blueprints: [make(2).getSnapshot()] });
    engine.state.food = 123;
    const before = serializeGameState(engine.state);
    const original = engine.checkSystem.setState;
    engine.checkSystem.setState = () => { throw new Error('INJECTED_RESTORE_FAILURE'); };
    try {
        assert.throws(() => engine.historyRestoreService.restoreVerse(1), /INJECTED_RESTORE_FAILURE/);
    } finally { engine.checkSystem.setState = original; }
    assert.deepEqual(serializeGameState(engine.state), before);
    assert.equal(engine.historyRestoreService.isRestoring, false);
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(service.getBlueprint(1).getSnapshot(), make().getSnapshot());
});
test('corrupt History snapshot fails without changing current world, army or saved input', () => {
    const { engine, service } = setup(); service.registerBlueprint(1, make());
    const point = structuredClone(engine.historySnapshotService.captureRestorePoint({ verse: 1 }));
    point.gameState.enemyArmyBlueprintState.blueprints[0].armyId = 'CORRUPT';
    engine.historySnapshotService.restorePoints[0] = point;
    const before = serializeGameState(engine.state); const saved = structuredClone(point);
    assert.throws(() => engine.historyRestoreService.restoreVerse(1), /ENEMY_BLUEPRINT/);
    assert.deepEqual(serializeGameState(engine.state), before);
    assert.deepEqual(point, saved);
});
