import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';

console.log('=== History Restore Threat / Enemy Truth ===');

const clone = value => JSON.parse(JSON.stringify(value));

const engine = GameEngine.createGame({ runSeed: 260914 });
const point = engine.historySnapshotService.getRestorePoint(1);

assert.ok(point?.runtime?.trialThreatState, 'Verse 1 Restore Point captures TrialThreatState');
assert.ok(point?.runtime?.trueEnemyState, 'Verse 1 Restore Point captures TrueEnemyState');

const expectedThreatState = clone(point.runtime.trialThreatState);
const expectedEnemyState = clone(point.runtime.trueEnemyState);

const futureThreatState = clone(expectedThreatState);
futureThreatState.dirty = true;
futureThreatState.revision = 99;
futureThreatState.lastCommittedVerse = 99;
futureThreatState.lastDevelopmentChange = { futureOnly: true };
futureThreatState.current = {
    ...futureThreatState.current,
    revision: 99,
    committedVerse: 99,
    threat: {
        ...(futureThreatState.current?.threat || {}),
        futureOnly: true
    }
};
engine.trialThreatStateService.restoreState(futureThreatState);

const futureEnemyState = clone(expectedEnemyState);
futureEnemyState.current = {
    ...futureEnemyState.current,
    strategicSuppression: 999,
    revision: 99,
    updatedAtVerse: 99,
    lastTransition: { futureOnly: true }
};
futureEnemyState.lastThreat = { futureOnly: true };
engine.trueEnemyStateService.restoreState(futureEnemyState);

assert.notDeepEqual(engine.trialThreatStateService.getRestoreState(), expectedThreatState,
    'precondition: live Threat state differs from Restore Point');
assert.notDeepEqual(engine.trueEnemyStateService.getRestoreState(), expectedEnemyState,
    'precondition: live Enemy Truth differs from Restore Point');

const originalEmit = engine.gameFactHub.emit.bind(engine.gameFactHub);
engine.gameFactHub.emit = () => {
    throw new Error('RESTORE_MUST_NOT_EMIT_GAME_FACTS');
};

try {
    const restored = engine.historyRestoreService.restoreVerse(1);
    assert.equal(restored.success, true);
} finally {
    engine.gameFactHub.emit = originalEmit;
}

assert.deepEqual(engine.trialThreatStateService.getRestoreState(), expectedThreatState,
    'TrialThreatState restores the observed Verse-start service state');
assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), expectedEnemyState,
    'TrueEnemyState restores current state and lastThreat');
assert.deepEqual(engine.enemyTruthReadModel.getSnapshot(), expectedEnemyState.current,
    'EnemyTruthReadModel immediately reflects the restored SSOT');

const detachedThreat = engine.trialThreatStateService.getRestoreState();
const detachedEnemy = engine.trueEnemyStateService.getRestoreState();
detachedThreat.current.revision = 777;
detachedEnemy.current.strategicSuppression = 777;
assert.deepEqual(engine.trialThreatStateService.getRestoreState(), expectedThreatState,
    'Threat restore snapshots do not alias service-owned state');
assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), expectedEnemyState,
    'Enemy Truth restore snapshots do not alias service-owned state');

console.log('History Restore Threat / Enemy Truth: PASS');
