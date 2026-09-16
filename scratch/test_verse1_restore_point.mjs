import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';

const engine = GameEngine.createGame({ runSeed: 31245 });
const history = engine.historySnapshotService;
const point = history.getRestorePoint(1);
assert.ok(point, 'Verse 1 Restore Point exists');
assert.equal(point.verse, 1);
assert.equal(point.sourceCompletedTurn, null);
assert.equal(history.getAllRestorePoints().length, 1, 'initial point captured once');
assert.ok(point.gameState.handOffering.length > 0, 'initial Offering already generated');
assert.deepEqual(point.gameState.handOffering, serializeGameState(engine.state).handOffering);
assert.deepEqual(point.gameState.grid, serializeGameState(engine.state).grid);
assert.deepEqual(point.rngState, engine.checkSystem.getState());
assert.deepEqual(point.gameplayRngState, engine.gameplayRandom.getState());

const originalOffering = structuredClone(point.gameState.handOffering);
const originalGrid = structuredClone(point.gameState.grid);
engine.state.handOffering[0].id = 'MUTATED';
engine.state.grid[0][0].hasSocket = !engine.state.grid[0][0].hasSocket;
assert.deepEqual(point.gameState.handOffering, originalOffering, 'Offering is not aliased');
assert.deepEqual(point.gameState.grid, originalGrid, 'known socket layout is not aliased');

engine.nextTurn();
assert.equal(history.getRestorePoint(1), point, 'later Verse does not replace Verse 1');
assert.ok(history.getRestorePoint(2), 'Verse 2 capture remains intact');
assert.equal(history.getAllRestorePoints().length, 2);
console.log('Verse 1 Restore Point: PASS');
