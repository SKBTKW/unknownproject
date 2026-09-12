import { hydrateGameState } from './hydrate_game_state.js';
import { TURN_LIFECYCLE_PHASES } from './turn_lifecycle_service.js';

function cloneData(value, fallback = null) {
    return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
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
        if (!engine.state || !engine.checkSystem?.setState || !engine.gameplayRandom?.setState ||
            !engine.chronicleSystem?.restoreEvents || !history?.truncateAfterVerse ||
            !restorePoint.rngState || !restorePoint.gameplayRngState ||
            !Array.isArray(restorePoint.chronicle) || !restorePoint.gameState) {
            return { success: false, reason: 'HISTORY_RESTORE_DEPENDENCY_MISSING' };
        }

        // Master lookup is read-only. The hydrator stays independent of DeckManager.
        const masters = engine.deckManager?.getLandCardMaster?.() || [];
        const byId = new Map(masters.map(master => [master.id, master]));
        const runtime = restorePoint.runtime || {};
        this.isRestoring = true;
        try {
            hydrateGameState(engine.state, restorePoint.gameState, {
                resolveCardMaster: id => byId.get(id) || null
            });
            engine.checkSystem.setState(restorePoint.rngState);
            engine.gameplayRandom.setState(restorePoint.gameplayRngState);
            engine.chronicleSystem.restoreEvents(restorePoint.chronicle);

            // GameState event runtime is authoritative; derived buffs are rebuilt once.
            const state = engine.state;
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
        } finally {
            this.isRestoring = false;
        }

        if (render) render();
        return { success: true, requestedVerse, restoredVerse, restorePoint };
    }
}

export default HistoryRestoreService;
