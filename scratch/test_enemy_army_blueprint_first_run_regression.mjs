import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { EnemyArmyBlueprintLifecycleService } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';

// Reuse the unchanged canonical completion certification with a test-only registration.
const originalCreate = GameEngine.createGame;
let captured = null;
let lifecycle = null;
let expected = null;
GameEngine.createGame = function(options) {
    const engine = originalCreate.call(this, options);
    assert.equal(captured, null, 'canonical certification creates one Run');
    captured = engine;
    const gameplay = engine.gameplayRandom.getState(); const checks = engine.checkSystem.getState();
    lifecycle = new EnemyArmyBlueprintLifecycleService({ gameState: engine.state });
    const blueprint = generateEnemyArmyBlueprint({ runSeed: engine.runSeed, stageId: 1, policy: fixturePolicy() });
    lifecycle.registerBlueprint(1, blueprint);
    expected = lifecycle.getSnapshot();
    assert.deepEqual(engine.gameplayRandom.getState(), gameplay);
    assert.deepEqual(engine.checkSystem.getState(), checks);
    return engine;
};
try {
    await import('./test_first_run_stage1_completion.mjs');
} finally { GameEngine.createGame = originalCreate; }
assert.ok(captured, 'canonical certification ran');
assert.equal(captured.state.stage.id, 2, 'registered army permits full Stage1 progression');
assert.deepEqual(lifecycle.getSnapshot(), expected, 'Investigation, Trial and Stage advance preserve Stage1 identity');
assert.equal(lifecycle.getBlueprint(2), null, 'no Stage2 generation');
console.log('PASS: registered Blueprint remains unchanged across canonical FirstRun Stage1 completion');
