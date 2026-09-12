import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';

const engine = GameEngine.createGame({ runSeed: 229 });
const history = engine.historySnapshotService;
const point = history.getRestorePoint(1);
assert.ok(point.gameState.trialSchedule);
assert.equal(point.gameState.nextTrialTurn, engine.state.nextTrialTurn);
assert.equal(Object.hasOwn(point.runtime, 'trialSchedule'), false);
assert.equal(Object.hasOwn(point.runtime, 'nextTrialTurn'), false);
assert.ok(Object.hasOwn(point.runtime, 'lastTurnMaintenanceResult'));

const snapshot = history.capture({ completedTurn: 1, nextTurn: 2 });
assert.deepEqual(snapshot.gameState.trialSchedule, engine.state.trialSchedule);
assert.equal(snapshot.gameState.nextTrialTurn, engine.state.nextTrialTurn);
assert.equal(Object.hasOwn(snapshot.runtime, 'trialSchedule'), false);
assert.equal(Object.hasOwn(snapshot.runtime, 'nextTrialTurn'), false);
assert.ok(Object.hasOwn(snapshot.runtime, 'activeGlobalEvents'));
assert.ok(Object.hasOwn(snapshot.runtime, 'eventCooldowns'));
assert.ok(Object.hasOwn(snapshot.runtime, 'temporaryWeightModifiers'));
assert.ok(Object.hasOwn(snapshot.runtime, 'lastGlobalEventTurn'));
assert.ok(Object.hasOwn(snapshot.runtime, 'buffs'));
assert.ok(Object.hasOwn(snapshot.runtime, 'lastTurnMaintenanceResult'));
console.log('Snapshot schema ownership: PASS');
