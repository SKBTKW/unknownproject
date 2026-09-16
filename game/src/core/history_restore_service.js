import { hydrateGameState } from './hydrate_game_state.js';
import { serializeGameState } from './state_serializer.js';
import { TURN_LIFECYCLE_PHASES } from './turn_lifecycle_service.js';

function cloneData(value, fallback = null) {
    return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
}

function captureRollbackCheckpoint(engine, history) {
    const state = engine.state;
    return {
        gameState: serializeGameState(state),
        checkState: cloneData(engine.checkSystem.getState()),
        gameplayState: cloneData(engine.gameplayRandom.getState()),
        chronicle: cloneData(engine.chronicleSystem.getAllEvents(), []),
        trialThreatState: cloneData(engine.trialThreatStateService?.getRestoreState?.()),
        trueEnemyState: cloneData(engine.trueEnemyStateService?.getRestoreState?.()),
        trialTimingState: cloneData(engine.trialTimingAuthorityService?.getRestoreState?.()),
        runSeed: engine.runSeed,
        stateRunSeed: state.runSeed,
        gameLogs: cloneData(state.gameLogs, []),
        activeGlobalEvents: cloneData(state.activeGlobalEvents, []),
        eventCooldowns: cloneData(state.eventCooldowns, {}),
        temporaryWeightModifiers: cloneData(state.temporaryWeightModifiers, []),
        lastGlobalEventTurn: state.lastGlobalEventTurn,
        buffs: cloneData(engine.buffSystem?.buffs, []),
        lastTurnMaintenanceResult: cloneData(engine.lastTurnMaintenanceResult),
        historySnapshots: Array.isArray(history.snapshots) ? [...history.snapshots] : [],
        historyRestorePoints: Array.isArray(history.restorePoints) ? [...history.restorePoints] : [],
        transactionHistory: cloneData(engine.transactionManager?.history, []),
        undoSnapshot: cloneData(engine.undoSystem?.snapshot),
        undoPlacedCellCoords: cloneData(engine.undoSystem?.placedCellCoords, []),
        trialBoundary: cloneData(engine.trialRestoreBoundaryService?.getState?.(), {
            active: false,
            startVerse: null
        }),
        lastCommittedBoundary: cloneData(engine.turnLifecycleService?.lastCommittedBoundary)
    };
}

function bestEffort(operation) {
    try {
        operation();
    } catch {
        // Rollback continues across subsystem failures; the original restore error wins.
    }
}

function restoreCheckState(checkSystem, savedState) {
    let restored = false;
    try {
        checkSystem.setState(cloneData(savedState));
        restored = true;
    } catch {
        // The rollback-only fallback below handles fault-injected public setters.
    }
    if (!restored) {
        bestEffort(() => checkSystem.rng.setState(cloneData(savedState.rng)));
    }
    if (savedState?.history !== undefined) {
        bestEffort(() => { checkSystem.history = cloneData(savedState.history); });
    }
}

function restoreGameplayState(gameplayRandom, savedState) {
    let restored = false;
    try {
        gameplayRandom.setState(cloneData(savedState));
        restored = true;
    } catch {
        // The rollback-only fallback below handles fault-injected public setters.
    }
    if (!restored) {
        bestEffort(() => gameplayRandom.source.setState(cloneData(savedState.source)));
        bestEffort(() => { gameplayRandom.sequence = savedState.sequence; });
    }
}

function restoreTrialBoundary(service, savedState) {
    if (!service) return;
    let restored = false;
    try {
        service.end();
        if (savedState?.active) service.begin(savedState.startVerse);
        const current = service.getState?.();
        restored = Boolean(current) &&
            current.active === Boolean(savedState?.active) &&
            current.startVerse === (savedState?.active ? savedState.startVerse : null);
    } catch {
        // A direct boundary fallback is limited to failed-Restore rollback.
    }
    if (!restored) {
        bestEffort(() => {
            service.boundary = savedState?.active
                ? Object.freeze({ active: true, startVerse: savedState.startVerse })
                : null;
        });
    }
}

function rollbackFailedRestore(engine, history, checkpoint, resolveCardMaster) {
    bestEffort(() => hydrateGameState(engine.state, checkpoint.gameState, { resolveCardMaster }));
    bestEffort(() => restoreCheckState(engine.checkSystem, checkpoint.checkState));
    bestEffort(() => restoreGameplayState(engine.gameplayRandom, checkpoint.gameplayState));
    bestEffort(() => engine.chronicleSystem.restoreEvents(cloneData(checkpoint.chronicle, [])));
    if (checkpoint.trialThreatState !== null) {
        bestEffort(() => engine.trialThreatStateService?.restoreState?.(cloneData(checkpoint.trialThreatState)));
    }
    if (checkpoint.trueEnemyState !== null) {
        bestEffort(() => engine.trueEnemyStateService?.restoreState?.(cloneData(checkpoint.trueEnemyState)));
    }
    if (checkpoint.trialTimingState !== null) {
        bestEffort(() => engine.trialTimingAuthorityService?.restoreState?.(cloneData(checkpoint.trialTimingState)));
    }

    const state = engine.state;
    bestEffort(() => { engine.runSeed = checkpoint.runSeed; });
    bestEffort(() => { state.runSeed = checkpoint.stateRunSeed; });
    bestEffort(() => { state.gameLogs = cloneData(checkpoint.gameLogs, []); });
    bestEffort(() => { state.activeGlobalEvents = cloneData(checkpoint.activeGlobalEvents, []); });
    bestEffort(() => { state.eventCooldowns = cloneData(checkpoint.eventCooldowns, {}); });
    bestEffort(() => { state.temporaryWeightModifiers = cloneData(checkpoint.temporaryWeightModifiers, []); });
    bestEffort(() => { state.lastGlobalEventTurn = checkpoint.lastGlobalEventTurn; });
    bestEffort(() => { engine.lastTurnMaintenanceResult = cloneData(checkpoint.lastTurnMaintenanceResult); });
    if (engine.buffSystem) {
        bestEffort(() => { engine.buffSystem.buffs = cloneData(checkpoint.buffs, []); });
    }

    bestEffort(() => { history.snapshots = [...checkpoint.historySnapshots]; });
    bestEffort(() => { history.restorePoints = [...checkpoint.historyRestorePoints]; });
    if (engine.transactionManager) {
        bestEffort(() => { engine.transactionManager.history = cloneData(checkpoint.transactionHistory, []); });
    }
    if (engine.undoSystem) {
        bestEffort(() => { engine.undoSystem.snapshot = cloneData(checkpoint.undoSnapshot); });
        bestEffort(() => { engine.undoSystem.placedCellCoords = cloneData(checkpoint.undoPlacedCellCoords, []); });
    }
    restoreTrialBoundary(engine.trialRestoreBoundaryService, checkpoint.trialBoundary);
    if (engine.turnLifecycleService) {
        bestEffort(() => {
            engine.turnLifecycleService.lastCommittedBoundary = cloneData(checkpoint.lastCommittedBoundary);
        });
    }
}

/** Restore an observed Verse start; never advance or regenerate the simulation. */
export class HistoryRestoreService {
    constructor(engine) {
        if (!engine) throw new TypeError('HISTORY_RESTORE_ENGINE_REQUIRED');
        this.engine = engine;
        this.isRestoring = false;
    }

    restoreVerse(requestedVerse, { render = null } = {}) {
        if (this.isRestoring) throw new Error('HISTORY_RESTORE_ALREADY_IN_PROGRESS');
        if (!Number.isInteger(requestedVerse) || requestedVerse < 1) {
            return { success: false, reason: 'HISTORY_RESTORE_VERSE_REQUIRED' };
        }
        if (render !== null && typeof render !== 'function') {
            return { success: false, reason: 'HISTORY_RESTORE_RENDER_INVALID' };
        }

        const engine = this.engine;
        if (engine.turnLifecycleService?.getPhase?.() !== TURN_LIFECYCLE_PHASES.ACTIVE) {
            return { success: false, reason: 'HISTORY_RESTORE_LIFECYCLE_NOT_ACTIVE' };
        }

        const restoredVerse = engine.trialRestoreBoundaryService?.resolveRestoreVerse?.(requestedVerse)
            ?? requestedVerse;
        const history = engine.historySnapshotService;
        const restorePoint = history?.getRestorePoint?.(restoredVerse);
        if (!restorePoint) return { success: false, reason: 'HISTORY_RESTORE_POINT_NOT_FOUND' };
        const runtime = restorePoint.runtime || {};
        const hasThreatRestoreState = runtime.trialThreatState !== undefined;
        const hasEnemyRestoreState = runtime.trueEnemyState !== undefined;
        const hasTimingRestoreState = runtime.trialTimingState !== undefined;
        if (!engine.state || !engine.checkSystem?.getState || !engine.checkSystem?.setState ||
            !engine.gameplayRandom?.getState || !engine.gameplayRandom?.setState ||
            !engine.chronicleSystem?.getAllEvents || !engine.chronicleSystem?.restoreEvents ||
            !history?.truncateAfterVerse ||
            !restorePoint.rngState || !restorePoint.gameplayRngState ||
            !Array.isArray(restorePoint.chronicle) || !restorePoint.gameState ||
            (hasThreatRestoreState && !engine.trialThreatStateService?.restoreState) ||
            (hasEnemyRestoreState && !engine.trueEnemyStateService?.restoreState) ||
            (hasTimingRestoreState && !engine.trialTimingAuthorityService?.restoreState)) {
            return { success: false, reason: 'HISTORY_RESTORE_DEPENDENCY_MISSING' };
        }

        // Master lookup must be independent from the *current* unlock state.
        // A restore point may contain cards that are unavailable in the present Verse.
        const masters = engine.deckManager?.getLandCardMaster?.() || [];
        const additionalMasters = engine.getAdditionalCardMastersForRestore?.() || [];
        const byId = new Map();
        for (const master of [...masters, ...additionalMasters]) {
            if (master?.id) byId.set(master.id, master);
        }
        const resolveCardMaster = id => byId.get(id) || null;
        const checkpoint = captureRollbackCheckpoint(engine, history);
        this.isRestoring = true;
        try {
            hydrateGameState(engine.state, restorePoint.gameState, {
                resolveCardMaster
            });
            engine.checkSystem.setState(restorePoint.rngState);
            engine.gameplayRandom.setState(restorePoint.gameplayRngState);
            engine.chronicleSystem.restoreEvents(restorePoint.chronicle);

            // Service-owned simulation state is restored directly. Never replay facts or recalculate
            // Threat/Enemy Truth/Trial timing during history restore: the Restore Point is the observed authority.
            if (hasThreatRestoreState) {
                engine.trialThreatStateService.restoreState(runtime.trialThreatState);
            }
            if (hasEnemyRestoreState) {
                engine.trueEnemyStateService.restoreState(runtime.trueEnemyState);
            }
            if (hasTimingRestoreState) {
                engine.trialTimingAuthorityService.restoreState(runtime.trialTimingState);
            }

            // GameState event runtime is authoritative; derived buffs are rebuilt once.
            const state = engine.state;
            // Earlier restore points have no log copy; never display a future log as past.
            state.gameLogs = Array.isArray(runtime.gameLogs) ? cloneData(runtime.gameLogs) : [];
            state.activeGlobalEvents = cloneData(runtime.activeGlobalEvents, []);
            state.eventCooldowns = cloneData(runtime.eventCooldowns, {});
            state.temporaryWeightModifiers = cloneData(runtime.temporaryWeightModifiers, []);
            state.lastGlobalEventTurn = runtime.lastGlobalEventTurn ?? 0;
            if (Number.isFinite(runtime.runSeed)) {
                engine.runSeed = runtime.runSeed;
                state.runSeed = runtime.runSeed;
            }
            engine.lastTurnMaintenanceResult = cloneData(runtime.lastTurnMaintenanceResult);
            if (engine.buffSystem) {
                engine.buffSystem.buffs = cloneData(runtime.buffs, []).filter(buff =>
                    buff.category !== 'ENVIRONMENT' && buff.category !== 'GLOBAL_EVENT' && !buff.isProxy);
                engine.buffSystem.updateEnvironmentBuffs();
            }
            engine.globalEventManager?.syncBuffProxy?.();

            history.truncateAfterVerse(restoredVerse);
            engine.transactionManager?.clearHistory?.();
            engine.undoSystem?.clearSnapshot?.();
            // A restored Trial start is not an in-progress battle.
            engine.trialRestoreBoundaryService?.end?.();
            if (engine.turnLifecycleService) engine.turnLifecycleService.lastCommittedBoundary = null;
        } catch (originalError) {
            rollbackFailedRestore(engine, history, checkpoint, resolveCardMaster);
            throw originalError;
        } finally {
            this.isRestoring = false;
        }

        if (render) render();
        return { success: true, requestedVerse, restoredVerse, restorePoint };
    }
}

export default HistoryRestoreService;
