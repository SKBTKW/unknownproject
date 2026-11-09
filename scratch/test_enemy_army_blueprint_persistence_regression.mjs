import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { RandomSource } from '../game/src/core/check_system/random_source.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { EnemyArmyBlueprintLifecycleService as Service } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';

test('registration/save/hydration/History restore consume no randomness and preserve live Truth', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    const blueprint = generateEnemyArmyBlueprint({ runSeed: 42, stageId: 1, policy: fixturePolicy() });
    const service = new Service({ gameState: engine.state });
    const truth = engine.trueEnemyStateService.getRestoreState();
    const gameplay = engine.gameplayRandom.getState(); const checks = engine.checkSystem.getState();
    const masters = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    const originalRandom = Math.random; const originalFloat = RandomSource.prototype.nextFloat;
    Math.random = () => { throw new Error('NONDETERMINISTIC_GENERATION_FORBIDDEN'); };
    RandomSource.prototype.nextFloat = () => { throw new Error('RNG_CONSUMPTION_FORBIDDEN'); };
    try {
        service.registerBlueprint(1, blueprint);
        service.registerBlueprint(1, blueprint);
        const saved = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
        hydrateGameState(engine.state, saved, { resolveCardMaster: id => masters.find(card => card.id === id) });
        service.restoreSnapshot(service.getSnapshot());
        engine.historySnapshotService.captureRestorePoint({ verse: 1 });
        assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
        assert.deepEqual(service.getBlueprint(1).getSnapshot(), blueprint.getSnapshot());
    } finally { Math.random = originalRandom; RandomSource.prototype.nextFloat = originalFloat; }
    assert.deepEqual(engine.gameplayRandom.getState(), gameplay);
    assert.deepEqual(engine.checkSystem.getState(), checks);
    assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), truth);
    assert.equal(engine.enemyTruthReadModel.getSnapshot().strategicSuppression, 20);
    assert.equal(engine.enemyTruthReadModel.getSnapshot().forces.length, 1);
});
test('fresh Engine and ordinary Verse progression do not create or attach Blueprint lifecycle', () => {
    const engine = GameEngine.createGame({ runSeed: 42, firstRun: true });
    assert.equal(Object.hasOwn(engine.state, 'enemyArmyBlueprintState'), false);
    engine.nextTurn();
    assert.equal(Object.hasOwn(engine.state, 'enemyArmyBlueprintState'), false);
    const service = new Service({ gameState: engine.state });
    const blueprint = generateEnemyArmyBlueprint({ runSeed: 42, stageId: 1, policy: fixturePolicy() });
    service.registerBlueprint(1, blueprint);
    engine.nextTurn();
    assert.deepEqual(service.getBlueprint(1).getSnapshot(), blueprint.getSnapshot());
    assert.equal(engine.enemyTruthReadModel.getSnapshot().strategicSuppression, 20);
    assert.equal(engine.enemyTruthReadModel.getSnapshot().forces.length, 1);
});
