import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { TrialRestoreBoundaryService } from '../game/src/core/trial_restore_boundary_service.js';
import { GLOBAL_EVENTS_MASTER } from '../game/src/data/global_events.js';

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
}

test('Verse start restores GameState identity, exact Offering/Socket and subsystem references', () => {
    const engine = GameEngine.createGame({ runSeed: 81271 });
    const state = engine.state;
    const point = engine.historySnapshotService.getRestorePoint(1);
    const refs = [state.engine, state.defenseSystem, state.deckManager, state.gridEngine];
    engine.nextTurn();
    state.ember = 1;
    state.grid[0][0].hasSocket = !state.grid[0][0].hasSocket;
    state.handOffering[0] = null;
    state.reserveSlots[0] = null;
    const restored = engine.historyRestoreService.restoreVerse(1);
    assert.equal(restored.success, true);
    assert.equal(restored.restoredVerse, 1);
    assert.equal(restored.restorePoint, point);
    assert.equal(engine.state, state);
    assert.deepEqual([state.engine, state.defenseSystem, state.deckManager, state.gridEngine], refs);
    assert.deepEqual(serializeGameState(state), point.gameState);
    assert.deepEqual(engine.checkSystem.getState(), point.rngState);
    assert.deepEqual(engine.gameplayRandom.getState(), point.gameplayRngState);
    assert.equal(engine.turnLifecycleService.getPhase(), 'ACTIVE');
});

test('restore does not replay simulation, consume RNG, or emit events; renders only once', () => {
    const engine = GameEngine.createGame({ runSeed: 45 });
    const forbid = () => { throw new Error('FORBIDDEN_REPLAY'); };
    for (const [owner, methods] of [
        [engine, ['nextTurn']],
        [engine.turnLifecycleService, ['advance']],
        [engine.deckManager, ['generateOfferingCards']],
        [engine.globalEventManager, ['onTurnStart', 'tickTurn']],
        [engine.gridEngine, ['expandGrid']],
        [engine.state, ['processTurnEndMaintenance']],
        [engine.checkSystem, ['resolve']],
        [engine.gameplayRandom, ['nextFloat', 'nextInt', 'nextId']],
        [engine.chronicleSystem, ['record']],
        [engine.gameFactHub, ['emit']]
    ]) for (const method of methods) owner[method] = forbid;
    let renders = 0;
    assert.equal(engine.historyRestoreService.restoreVerse(1, { render: () => {
        assert.equal(engine.historyRestoreService.isRestoring, false);
        assert.equal(engine.historySnapshotService.getAllRestorePoints().length, 1);
        renders++;
    } }).success, true);
    assert.equal(renders, 1);
    assert.deepEqual(engine.checkSystem.getState(), engine.historySnapshotService.getRestorePoint(1).rngState);
    assert.deepEqual(engine.gameplayRandom.getState(), engine.historySnapshotService.getRestorePoint(1).gameplayRngState);
});

test('invalid Verse, missing point, inactive lifecycle and invalid resolver never render', () => {
    const engine = GameEngine.createGame({ runSeed: 71 });
    let renders = 0;
    const render = () => renders++;
    assert.equal(engine.historyRestoreService.restoreVerse(0, { render }).success, false);
    assert.equal(engine.historyRestoreService.restoreVerse(77, { render }).success, false);
    assert.equal(engine.historyRestoreService.restoreVerse(1, { render: 3 }).success, false);
    for (const phase of ['COMMITTING', 'INITIALIZING', 'COMMITTED']) {
        engine.turnLifecycleService.phase = phase;
        assert.equal(engine.historyRestoreService.restoreVerse(1, { render }).reason,
            'HISTORY_RESTORE_LIFECYCLE_NOT_ACTIVE');
    }
    engine.turnLifecycleService.phase = 'ACTIVE';
    assert.equal(renders, 0);
});

test('nested restore fails fast and guard clears after exceptions', () => {
    const engine = GameEngine.createGame({ runSeed: 101 });
    const original = engine.checkSystem.setState.bind(engine.checkSystem);
    engine.checkSystem.setState = rng => {
        assert.throws(() => engine.historyRestoreService.restoreVerse(1), /HISTORY_RESTORE_ALREADY_IN_PROGRESS/);
        original(rng);
    };
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    engine.checkSystem.setState = () => { throw new Error('INJECTED_RESTORE_FAILURE'); };
    let renders = 0;
    assert.throws(() => engine.historyRestoreService.restoreVerse(1, { render: () => renders++ }),
        /INJECTED_RESTORE_FAILURE/);
    assert.equal(renders, 0);
    assert.equal(engine.historyRestoreService.isRestoring, false);
    engine.checkSystem.setState = original;
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
});

test('Trial maps requested Verse to start, discards battle boundary and future history', () => {
    const engine = GameEngine.createGame({ runSeed: 321 });
    engine.nextTurn();
    engine.nextTurn();
    const point1 = engine.historySnapshotService.getRestorePoint(1);
    engine.trialRestoreBoundaryService = new TrialRestoreBoundaryService(engine);
    engine.trialRestoreBoundaryService.begin(1);
    engine.chronicleSystem.record({ id: 'FUTURE', turn: 3 });
    engine.transactionManager.history.push({ id: 'FUTURE_ACTION' });
    engine.undoSystem.snapshot = { future: true };
    const result = engine.historyRestoreService.restoreVerse(3);
    assert.equal(result.requestedVerse, 3);
    assert.equal(result.restoredVerse, 1);
    assert.equal(engine.state.turn, 1);
    assert.equal(engine.trialRestoreBoundaryService.isActive(), false);
    assert.deepEqual(engine.chronicleSystem.getAllEvents(), point1.chronicle);
    assert.deepEqual(engine.historySnapshotService.getAll(), []);
    assert.deepEqual(engine.historySnapshotService.getAllRestorePoints(), [point1]);
    assert.deepEqual(engine.transactionManager.history, []);
    assert.equal(engine.undoSystem.snapshot, null);
    assert.equal(engine.turnLifecycleService.lastCommittedBoundary, null);
});

test('Verse N keeps earlier history and its own Restore Point', () => {
    const engine = GameEngine.createGame({ runSeed: 11 });
    engine.nextTurn();
    engine.nextTurn();
    const point2 = engine.historySnapshotService.getRestorePoint(2);
    assert.equal(engine.historyRestoreService.restoreVerse(2).success, true);
    assert.deepEqual(engine.historySnapshotService.getAll().map(s => s.completedTurn), [1]);
    assert.deepEqual(engine.historySnapshotService.getAllRestorePoints().map(p => p.verse), [1, 2]);
    assert.deepEqual(engine.chronicleSystem.getAllEvents(), point2.chronicle);
});

test('operation log snapshots do not alias live records and restore Advisor-visible history', () => {
    const engine = GameEngine.createGame({ runSeed: 555 });
    engine.state.addLog('PAST_LOG');
    engine.nextTurn();
    const point = engine.historySnapshotService.getRestorePoint(2);
    assert.ok(point.runtime.gameLogs.includes('PAST_LOG'));
    engine.state.addLog('FUTURE_LOG');
    assert.equal(engine.historyRestoreService.restoreVerse(2).success, true);
    assert.deepEqual(engine.state.gameLogs, point.runtime.gameLogs);
    assert.ok(!engine.state.gameLogs.includes('FUTURE_LOG'));
    engine.state.gameLogs.push('BRANCH_LOG');
    assert.ok(!point.runtime.gameLogs.includes('BRANCH_LOG'));
});

test('old restore points without operation logs clear future-only records', () => {
    const engine = GameEngine.createGame({ runSeed: 556 });
    const point = engine.historySnapshotService.getRestorePoint(1);
    const legacy = { ...point, runtime: { ...point.runtime } };
    delete legacy.runtime.gameLogs;
    engine.historySnapshotService.restorePoints = [legacy];
    engine.state.addLog('FUTURE_LOG');
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(engine.state.gameLogs, []);
});

test('GlobalEvent state and only non-derived buffs are restored before derived proxies', () => {
    const engine = GameEngine.createGame({ runSeed: 112 });
    const id = GLOBAL_EVENTS_MASTER[0].id;
    engine.state.activeGlobalEvents = [{ definitionId: id, remainingTurns: 3 }];
    engine.state.eventCooldowns = { [id]: 1 };
    engine.state.temporaryWeightModifiers = [{ id: 'TEST', weight: 2 }];
    engine.state.lastGlobalEventTurn = 1;
    engine.state.ember = 24;
    engine.buffSystem.buffs = [
        { id: 'CARD_EFFECT_TEST', category: 'CARD_EFFECT', remainingTurns: 2 },
        { id: 'ENV_EMBER_PROSPERITY', category: 'ENVIRONMENT' },
        { id, category: 'GLOBAL_EVENT', isProxy: true }
    ];
    engine.lastTurnMaintenanceResult = { foodCost: 20 };
    const point = engine.historySnapshotService.captureRestorePoint({ verse: 1 });
    engine.state.activeGlobalEvents = [];
    engine.state.eventCooldowns = {};
    engine.state.temporaryWeightModifiers = [];
    engine.state.lastGlobalEventTurn = 99;
    engine.state.ember = 0;
    engine.buffSystem.buffs = [];
    engine.lastTurnMaintenanceResult = { foodCost: 999 };
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(engine.state.activeGlobalEvents, point.runtime.activeGlobalEvents);
    assert.deepEqual(engine.state.eventCooldowns, point.runtime.eventCooldowns);
    assert.deepEqual(engine.state.temporaryWeightModifiers, point.runtime.temporaryWeightModifiers);
    assert.equal(engine.state.lastGlobalEventTurn, 1);
    assert.deepEqual(engine.lastTurnMaintenanceResult, { foodCost: 20 });
    assert.equal(engine.buffSystem.buffs.filter(b => b.id === 'CARD_EFFECT_TEST').length, 1);
    assert.equal(engine.buffSystem.buffs.filter(b => b.category === 'ENVIRONMENT').length, 1);
    assert.equal(engine.buffSystem.buffs.filter(b => b.category === 'GLOBAL_EVENT').length, 1);
    engine.globalEventManager.syncBuffProxy();
    assert.equal(engine.buffSystem.buffs.filter(b => b.category === 'GLOBAL_EVENT').length, 1);
});

test('old Restore Point without maintenance value clears future result', () => {
    const engine = GameEngine.createGame({ runSeed: 15 });
    const history = engine.historySnapshotService;
    const point = history.getRestorePoint(1);
    history.restorePoints[0] = { ...point, runtime: { ...point.runtime } };
    delete history.restorePoints[0].runtime.lastTurnMaintenanceResult;
    engine.lastTurnMaintenanceResult = { foodCost: 999 };
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.equal(engine.lastTurnMaintenanceResult, null);
});

test('both independent RNG streams and deterministic IDs resume exactly', () => {
    const engine = GameEngine.createGame({ runSeed: 81271 });
    const point = engine.historySnapshotService.getRestorePoint(1);
    const continuation = () => [
        engine.checkSystem.resolve({ checkId: 'standard_2d6' }),
        engine.gameplayRandom.nextFloat(),
        engine.gameplayRandom.nextId('offering', engine.state.turn),
        engine.checkSystem.resolve({ checkId: 'standard_2d6' }),
        engine.gameplayRandom.nextFloat()
    ];
    const expected = continuation();
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(engine.checkSystem.getState(), point.rngState);
    assert.deepEqual(engine.gameplayRandom.getState(), point.gameplayRngState);
    assert.deepEqual(continuation(), expected);
});

test('replaying the same Verse decision regenerates only the same future Offering and world', () => {
    const engine = GameEngine.createGame({ runSeed: 98765 });
    const preview = engine.previewTurnEndMaintenance().production;
    engine.nextTurn();
    const nextVerse = serializeGameState(engine.state);
    const nextCheck = engine.checkSystem.getState();
    const nextGameplay = engine.gameplayRandom.getState();
    assert.equal(engine.historyRestoreService.restoreVerse(1).success, true);
    assert.deepEqual(engine.previewTurnEndMaintenance().production, preview, 'pre-advance production must match');
    engine.nextTurn();
    assert.deepEqual(serializeGameState(engine.state), nextVerse);
    assert.deepEqual(engine.checkSystem.getState(), nextCheck);
    assert.deepEqual(engine.gameplayRandom.getState(), nextGameplay);
    assert.deepEqual(engine.historySnapshotService.getAllRestorePoints().map(p => p.verse), [1, 2]);
});

test('rarity Cooldown uses the gameplay stream, never Math.random on the canonical path', () => {
    const first = GameEngine.createGame({ runSeed: 3321 });
    const second = GameEngine.createGame({ runSeed: 3321 });
    const originalRandom = Math.random;
    try {
        Math.random = () => { throw new Error('UNOWNED_RANDOM'); };
        const a = first.deckManager.cycleSystem.getRandomJitter();
        const b = second.deckManager.cycleSystem.getRandomJitter();
        assert.equal(a, b);
        assert.deepEqual(first.gameplayRandom.getState(), second.gameplayRandom.getState());
        assert.deepEqual(first.checkSystem.getState(), second.checkSystem.getState());
    } finally {
        Math.random = originalRandom;
    }
});

console.log(`HistoryRestoreService V5: ${passed}/${passed} PASS`);
