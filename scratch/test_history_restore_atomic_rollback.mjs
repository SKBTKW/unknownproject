import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { TrialRestoreBoundaryService } from '../game/src/core/trial_restore_boundary_service.js';

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function prepareFutureState(seed) {
    const engine = GameEngine.createGame({ runSeed: seed });
    engine.nextTurn();
    engine.nextTurn();
    engine.state.ember = 7;
    engine.state.gameLogs = ['FUTURE_LOG'];
    engine.state.activeGlobalEvents = [{ definitionId: 'FUTURE_EVENT', remainingTurns: 2 }];
    engine.state.eventCooldowns = { FUTURE_EVENT: 4 };
    engine.state.temporaryWeightModifiers = [{ id: 'FUTURE_WEIGHT', weight: 3 }];
    engine.state.lastGlobalEventTurn = 3;
    engine.runSeed = seed + 1;
    engine.state.runSeed = seed + 1;
    engine.lastTurnMaintenanceResult = { foodCost: 77 };
    engine.buffSystem.buffs = [{ id: 'FUTURE_BUFF', category: 'CARD_EFFECT', remainingTurns: 2 }];
    engine.chronicleSystem.record({ id: 'FUTURE_CHRONICLE', turn: 3 });
    engine.checkSystem.resolve({ checkId: 'standard_2d6' });
    engine.gameplayRandom.nextFloat();
    engine.gameplayRandom.nextId('future', 3);

    const threat = engine.trialThreatStateService.getRestoreState();
    threat.dirty = true;
    threat.revision = 77;
    threat.lastCommittedVerse = null;
    threat.lastDevelopmentChange = { future: true };
    threat.current = { ...threat.current, revision: 77, committedVerse: null };
    engine.trialThreatStateService.restoreState(threat);

    const enemy = engine.trueEnemyStateService.getRestoreState();
    enemy.current = { ...enemy.current, strategicSuppression: 77, revision: 77 };
    enemy.lastThreat = { future: true };
    engine.trueEnemyStateService.restoreState(enemy);

    engine.transactionManager.history = [{ id: 'FUTURE_TRANSACTION', payload: { value: 1 } }];
    engine.undoSystem.snapshot = { future: true, nested: { value: 2 } };
    engine.undoSystem.placedCellCoords = [{ r: 1, c: 2 }];
    engine.trialRestoreBoundaryService = new TrialRestoreBoundaryService(engine);
    engine.trialRestoreBoundaryService.begin(1);
    engine.turnLifecycleService.lastCommittedBoundary = { completedTurn: 2, nextTurn: 3 };
    return engine;
}

function capture(engine) {
    return {
        stateIdentity: engine.state,
        gameState: serializeGameState(engine.state),
        checkState: clone(engine.checkSystem.getState()),
        gameplayState: clone(engine.gameplayRandom.getState()),
        chronicle: clone(engine.chronicleSystem.getAllEvents()),
        threat: clone(engine.trialThreatStateService.getRestoreState()),
        enemy: clone(engine.trueEnemyStateService.getRestoreState()),
        runSeed: engine.runSeed,
        stateRunSeed: engine.state.runSeed,
        gameLogs: clone(engine.state.gameLogs),
        activeGlobalEvents: clone(engine.state.activeGlobalEvents),
        eventCooldowns: clone(engine.state.eventCooldowns),
        temporaryWeightModifiers: clone(engine.state.temporaryWeightModifiers),
        lastGlobalEventTurn: engine.state.lastGlobalEventTurn,
        buffs: clone(engine.buffSystem.buffs),
        maintenance: clone(engine.lastTurnMaintenanceResult),
        snapshots: [...engine.historySnapshotService.snapshots],
        restorePoints: [...engine.historySnapshotService.restorePoints],
        transactionHistory: clone(engine.transactionManager.history),
        undoSnapshot: clone(engine.undoSystem.snapshot),
        undoPlacedCellCoords: clone(engine.undoSystem.placedCellCoords),
        trialBoundary: clone(engine.trialRestoreBoundaryService.getState()),
        lastCommittedBoundary: clone(engine.turnLifecycleService.lastCommittedBoundary)
    };
}

function assertRestored(engine, expected) {
    assert.equal(engine.state, expected.stateIdentity, 'GameState identity must survive rollback');
    assert.deepEqual(serializeGameState(engine.state), expected.gameState, 'GameState must roll back exactly');
    assert.deepEqual(engine.checkSystem.getState(), expected.checkState, 'Check RNG must roll back exactly');
    assert.deepEqual(engine.gameplayRandom.getState(), expected.gameplayState, 'Gameplay RNG must roll back exactly');
    assert.deepEqual(engine.chronicleSystem.getAllEvents(), expected.chronicle, 'Chronicle must roll back exactly');
    assert.deepEqual(engine.trialThreatStateService.getRestoreState(), expected.threat, 'Threat must roll back exactly');
    assert.deepEqual(engine.trueEnemyStateService.getRestoreState(), expected.enemy, 'Enemy Truth must roll back exactly');
    assert.equal(engine.runSeed, expected.runSeed);
    assert.equal(engine.state.runSeed, expected.stateRunSeed);
    assert.deepEqual(engine.state.gameLogs, expected.gameLogs);
    assert.deepEqual(engine.state.activeGlobalEvents, expected.activeGlobalEvents);
    assert.deepEqual(engine.state.eventCooldowns, expected.eventCooldowns);
    assert.deepEqual(engine.state.temporaryWeightModifiers, expected.temporaryWeightModifiers);
    assert.equal(engine.state.lastGlobalEventTurn, expected.lastGlobalEventTurn);
    assert.deepEqual(engine.buffSystem.buffs, expected.buffs);
    assert.deepEqual(engine.lastTurnMaintenanceResult, expected.maintenance);
    assert.deepEqual(engine.historySnapshotService.snapshots, expected.snapshots, 'future snapshots must survive failure');
    assert.deepEqual(engine.historySnapshotService.restorePoints, expected.restorePoints, 'future Restore Points must survive failure');
    assert.deepEqual(engine.transactionManager.history, expected.transactionHistory);
    assert.deepEqual(engine.undoSystem.snapshot, expected.undoSnapshot);
    assert.deepEqual(engine.undoSystem.placedCellCoords, expected.undoPlacedCellCoords);
    assert.deepEqual(engine.trialRestoreBoundaryService.getState(), expected.trialBoundary);
    assert.deepEqual(engine.turnLifecycleService.lastCommittedBoundary, expected.lastCommittedBoundary);
    assert.equal(engine.historyRestoreService.isRestoring, false);
}

function assertFailureRollsBack(engine, installFault, removeFault) {
    const before = capture(engine);
    let renders = 0;
    installFault();
    assert.throws(
        () => engine.historyRestoreService.restoreVerse(3, { render: () => renders++ }),
        /INJECTED_/
    );
    removeFault();
    assert.equal(renders, 0, 'failed Restore must not render');
    assertRestored(engine, before);
    assert.equal(engine.historyRestoreService.restoreVerse(3).success, true,
        'Restore must succeed after fault removal');
}

{
    const engine = prepareFutureState(1001);
    const original = engine.checkSystem.setState.bind(engine.checkSystem);
    assertFailureRollsBack(
        engine,
        () => { engine.checkSystem.setState = () => { throw new Error('INJECTED_CHECK_FAILURE'); }; },
        () => { engine.checkSystem.setState = original; }
    );
    console.log('  PASS: early CheckSystem failure rolls every subsystem back');
}

{
    const engine = prepareFutureState(1002);
    const original = engine.gameplayRandom.setState.bind(engine.gameplayRandom);
    assertFailureRollsBack(
        engine,
        () => { engine.gameplayRandom.setState = () => { throw new Error('INJECTED_GAMEPLAY_FAILURE'); }; },
        () => { engine.gameplayRandom.setState = original; }
    );
    console.log('  PASS: GameplayRandom public setter failure uses rollback-only fallback');
}

{
    const engine = prepareFutureState(1003);
    const original = engine.trialRestoreBoundaryService.end.bind(engine.trialRestoreBoundaryService);
    assertFailureRollsBack(
        engine,
        () => {
            engine.trialRestoreBoundaryService.end = () => {
                original();
                throw new Error('INJECTED_LATE_FAILURE');
            };
        },
        () => { engine.trialRestoreBoundaryService.end = original; }
    );
    console.log('  PASS: late failure restores history, transaction, undo and Trial boundary');
}

console.log('History Restore atomic rollback: 3/3 PASS');
