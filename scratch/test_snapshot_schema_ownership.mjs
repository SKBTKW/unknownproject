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
assert.ok(Object.hasOwn(point.runtime, 'trialThreatState'));
assert.ok(Object.hasOwn(point.runtime, 'trueEnemyState'));

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
assert.ok(Object.hasOwn(snapshot.runtime, 'trialThreatState'));
assert.ok(Object.hasOwn(snapshot.runtime, 'trueEnemyState'));

const expectedThreat = point.runtime.trialThreatState;
const expectedEnemy = point.runtime.trueEnemyState;
engine.trialThreatStateService.restoreState({
    ...expectedThreat,
    dirty: true,
    revision: 999,
    lastCommittedVerse: 999,
    current: {
        ...expectedThreat.current,
        revision: 999,
        committedVerse: 999
    }
});
engine.trueEnemyStateService.restoreState({
    ...expectedEnemy,
    current: {
        ...expectedEnemy.current,
        strategicSuppression: 999,
        revision: 999,
        updatedAtVerse: 999
    },
    lastThreat: { futureOnly: true }
});

assert.notDeepEqual(engine.trialThreatStateService.getRestoreState(), expectedThreat);
assert.notDeepEqual(engine.trueEnemyStateService.getRestoreState(), expectedEnemy);
assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
assert.deepEqual(engine.trialThreatStateService.getRestoreState(), expectedThreat);
assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), expectedEnemy);
assert.deepEqual(engine.enemyTruthReadModel.getSnapshot(), expectedEnemy.current);

console.log('Snapshot schema ownership: PASS');
