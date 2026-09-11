import { GAME_FACT_TYPES, GameFactHub } from './game_fact.js';
import { HistorySnapshotService } from './history_snapshot_service.js';

/**
 * TurnLifecycleService
 *
 * Owns the boundary orchestration for advancing one turn.
 * R3 makes this service the SSOT for turn increment and per-turn flag reset.
 * DeckManager remains responsible only for regenerating the offering.
 *
 * Verse presentation/semantics are intentionally out of scope here.
 */
export const TURN_LIFECYCLE_PHASES = Object.freeze({
    ACTIVE: "ACTIVE",
    COMMITTING: "COMMITTING",
    COMMITTED: "COMMITTED",
    INITIALIZING: "INITIALIZING"
});

export class TurnLifecycleService {
    constructor(engine) {
        if (!engine) {
            throw new TypeError("TURN_LIFECYCLE_ENGINE_REQUIRED");
        }
        this.engine = engine;
        this.gameFactHub = engine.gameFactHub || new GameFactHub();
        this.engine.gameFactHub = this.gameFactHub;
        this.engine.chronicleSystem?.attachGameFactHub?.(this.gameFactHub);
        this.historySnapshotService = engine.historySnapshotService || new HistorySnapshotService(engine);
        this.engine.historySnapshotService = this.historySnapshotService;
        this.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
        this.lastCommittedBoundary = null;
    }

    advance({
        autoFallbackEnabled = true,
        useHypotheticalFallback = false
    } = {}) {
        if (this.phase !== TURN_LIFECYCLE_PHASES.ACTIVE) {
            throw new Error(`TURN_LIFECYCLE_NOT_ACTIVE:${this.phase}`);
        }

        this.phase = TURN_LIFECYCLE_PHASES.COMMITTING;
        const boundary = this._commitCurrentTurn({
            autoFallbackEnabled,
            useHypotheticalFallback
        });

        this.phase = TURN_LIFECYCLE_PHASES.COMMITTED;
        this.lastCommittedBoundary = boundary;
        this._emitCommittedFact(boundary);
        this._captureHistorySnapshot(boundary);

        this.phase = TURN_LIFECYCLE_PHASES.INITIALIZING;
        this._initializeNextTurn();

        this.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
        return this.engine.state ? this.engine.state.turn : 1;
    }

    _commitCurrentTurn({
        autoFallbackEnabled = true,
        useHypotheticalFallback = false
    } = {}) {
        const engine = this.engine;
        const state = engine.state;
        const completedTurn = state ? state.turn : 1;

        if (engine.transactionManager) engine.transactionManager.clearHistory();
        if (engine.undoSystem) engine.undoSystem.clearSnapshot();

        const maintenancePreview = engine.previewTurnEndMaintenance({ autoFallbackEnabled });
        const prods = maintenancePreview.production;

        if (state) {
            state.food += (prods.grossFood ?? 0);
            state.wood += (prods.totalWood ?? 0);
            state.material = state.wood;
            state.mystic += (prods.totalMystic ?? 1);
        }

        const fallbackPlan = !autoFallbackEnabled
            && useHypotheticalFallback
            && maintenancePreview.hypotheticalFallbackPlan.canFullyCover
            ? maintenancePreview.hypotheticalFallbackPlan
            : maintenancePreview.automaticPlan;

        if (state && typeof state.processTurnEndMaintenance === "function") {
            engine.lastTurnMaintenanceResult = state.processTurnEndMaintenance({
                ...maintenancePreview,
                fallbackPlan
            });
        }

        if (engine.globalEventManager) {
            engine.globalEventManager.tickTurn();
        }

        return Object.freeze({
            completedTurn,
            nextTurn: completedTurn + 1
        });
    }

    _initializeNextTurn() {
        const engine = this.engine;
        const state = engine.state;

        this._advanceTurnState();

        if (engine.deckManager && typeof engine.deckManager.generateOfferingCards === "function") {
            engine.deckManager.generateOfferingCards();
        }

        if (engine.globalEventManager) {
            engine.globalEventManager.onTurnStart();
        }

        if (state && state.trialSchedule) {
            const currentTurn = state.turn;
            if (state.stage && state.stage.id === 1 && currentTurn >= state.trialSchedule.trial1) {
                state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
                state.nextTrialTurn = state.trialSchedule.trial2;
                if (engine.gridEngine) {
                    engine.gridEngine.expandGrid(7);
                }
                if (state.addLog) {
                    state.addLog(this._translate("LOG_STAGE_EXPAND", { stage: 2, size: 7 }, "⚔️ Stage 2 (7x7)"));
                }
            } else if (state.stage && state.stage.id === 2 && currentTurn >= state.trialSchedule.trial2) {
                state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
                state.nextTrialTurn = state.trialSchedule.trial3;
                if (engine.gridEngine) {
                    engine.gridEngine.expandGrid(9);
                }
                if (state.addLog) {
                    state.addLog(this._translate("LOG_STAGE_EXPAND", { stage: 3, size: 9 }, "⚔️ Stage 3 (9x9)"));
                }
            }
        }

        if (state && typeof state.addLog === "function") {
            state.addLog(this._translate(
                "LOG_TURN_START",
                { turn: state.turn },
                `Turn ${state.turn} started.`
            ));
        }
    }

    getPhase() {
        return this.phase;
    }

    getLastCommittedBoundary() {
        return this.lastCommittedBoundary;
    }

    _emitCommittedFact(boundary) {
        if (!this.gameFactHub || typeof this.gameFactHub.emit !== "function") return null;
        return this.gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, {
            completedTurn: boundary.completedTurn,
            nextTurn: boundary.nextTurn
        });
    }

    _captureHistorySnapshot(boundary) {
        if (!this.historySnapshotService || typeof this.historySnapshotService.capture !== 'function') return null;
        return this.historySnapshotService.capture(boundary);
    }

    _advanceTurnState() {
        const state = this.engine.state;
        if (!state) return;

        state.turn++;
        state.hasPickedThisTurn = false;
        state.hasReservedThisTurn = false;
        state.hasMulliganedThisTurn = false;
    }

    _translate(key, params, fallback) {
        const runtimeI18n = (typeof globalThis !== "undefined" && globalThis.I18n)
            ? globalThis.I18n
            : this.engine.i18n;
        if (!runtimeI18n || typeof runtimeI18n.t !== "function") return fallback;
        return runtimeI18n.t(key, params) || fallback;
    }
}

export default TurnLifecycleService;
