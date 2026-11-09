import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';

const originalCreate = GameEngine.createGame;
let engine = null; let expected = null; let calls = 0;
GameEngine.createGame = function(options) {
    assert.equal(engine, null);
    engine = originalCreate.call(this, { ...options, enemyArmyBlueprintPolicy: fixturePolicy(),
        enemyArmyBlueprintGenerator: args => { calls++; return generateEnemyArmyBlueprint(args); } });
    expected = engine.enemyArmyBlueprintLifecycleService.getSnapshot();
    assert.deepEqual(engine.historySnapshotService.getRestorePoint(1).gameState.enemyArmyBlueprintState, expected);
    const saved = JSON.parse(JSON.stringify(serializeGameState(engine.state)));
    const masters = [...engine.deckManager.getLandCardMaster(), ...(engine.getAdditionalCardMastersForRestore?.() || [])];
    hydrateGameState(engine.state, saved, { resolveCardMaster: id => masters.find(card => card.id === id) });
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.equal(calls, 1);
    return engine;
};
try { await import('./test_first_run_stage1_completion.mjs'); }
finally { GameEngine.createGame = originalCreate; }
assert.ok(engine);
assert.equal(engine.state.stage.id, 2);
assert.equal(calls, 1, 'Investigation, Verse, Save/Restore, Trial and Stage2 never regenerate');
assert.deepEqual(engine.enemyArmyBlueprintLifecycleService.getSnapshot(), expected);
assert.equal(engine.enemyArmyBlueprintLifecycleService.getBlueprint(2), null);
console.log('PASS: automatically initialized Blueprint survives JSON + History restore and canonical FirstRun Stage1 completion');
