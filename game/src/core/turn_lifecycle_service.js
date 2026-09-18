import { GAME_FACT_TYPES, GameFactHub } from './game_fact.js';
import { HistorySnapshotService } from './history_snapshot_service.js';
import { RunTerminationService } from './run_termination_service.js';
import { attachTrialTimingSubsystem } from '../trial/integration/trial_timing_bootstrap.js';
import { TrialThreatStateService } from '../trial/systems/trial_threat_state_service.js';
import { TrueEnemyStateService } from '../trial/systems/true_enemy_state_service.js';
import { EnemyTruthReadModel } from '../trial/systems/enemy_truth_read_model.js';
import { createEnemyStateTransitionResolver } from '../trial/systems/enemy_state_transition_resolver.js';

export const TURN_LIFECYCLE_PHASES = Object.freeze({ ACTIVE: "ACTIVE", COMMITTING: "COMMITTING", COMMITTED: "COMMITTED", INITIALIZING: "INITIALIZING" });

export class TurnLifecycleService {
    constructor(engine) {
        if (!engine) throw new TypeError("TURN_LIFECYCLE_ENGINE_REQUIRED");
        this.engine = engine;
        if (!this.engine.runTerminationService) this.engine.runTerminationService = new RunTerminationService(this.engine.state);
        this.gameFactHub = engine.gameFactHub || new GameFactHub();
        this.engine.gameFactHub = this.gameFactHub;
        this.engine.chronicleSystem?.attachGameFactHub?.(this.gameFactHub);

        // Exact Trial timing becomes live internal state on fresh runs. A due
        // request may be created from VERSE_COMMITTED, but presentation launch
        // is intentionally deferred until the next Verse is fully initialized.
        this.trialTimingAttachment = attachTrialTimingSubsystem(engine, {
            timingAuthority: engine.trialTimingAuthorityService || null
        });

        this.threatStateService = engine.trialThreatStateService || new TrialThreatStateService({
            gameState: engine.state,
            gameFactHub: this.gameFactHub
        });
        this.engine.trialThreatStateService = this.threatStateService;

        const enemyStateTransitionResolver = engine.enemyStateTransitionResolver
            || createEnemyStateTransitionResolver();
        this.engine.enemyStateTransitionResolver = enemyStateTransitionResolver;
        this.trueEnemyStateService = engine.trueEnemyStateService || new TrueEnemyStateService({
            gameState: engine.state,
            gameFactHub: this.gameFactHub,
            transitionResolver: enemyStateTransitionResolver
        });
        this.engine.trueEnemyStateService = this.trueEnemyStateService;
        this.engine.enemyTruthReadModel = engine.enemyTruthReadModel || new EnemyTruthReadModel(this.trueEnemyStateService);
        this.historySnapshotService = engine.historySnapshotService || new HistorySnapshotService(engine);
        this.engine.historySnapshotService = this.historySnapshotService;
        this.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
        this.lastCommittedBoundary = null;
        this.lastAdvanceBlock = null;
    }

    advance({ autoFallbackEnabled = true, useHypotheticalFallback = false } = {}) {
        const existingTermination = this.engine.runTerminationService?.evaluate?.({ source: "VERSE_ADVANCE" }) || null;
        if (existingTermination?.terminated) return this.engine.state ? this.engine.state.turn : 1;
        if (this.phase !== TURN_LIFECYCLE_PHASES.ACTIVE) throw new Error(`TURN_LIFECYCLE_NOT_ACTIVE:${this.phase}`);

        const postTrialProgression = this.engine.postTrialProgressionService || null;
        if (postTrialProgression?.canResumeNormalProgression?.() === false) {
            this.lastAdvanceBlock = Object.freeze({
                reason: "POST_TRIAL_PROGRESSION_PENDING",
                transition: postTrialProgression.getTransition?.() || null
            });
            return this.engine.state ? this.engine.state.turn : 1;
        }
        this.lastAdvanceBlock = null;

        this.phase = TURN_LIFECYCLE_PHASES.COMMITTING;
        const boundary = this._commitCurrentTurn({ autoFallbackEnabled, useHypotheticalFallback });
        this.phase = TURN_LIFECYCLE_PHASES.COMMITTED;
        this.lastCommittedBoundary = boundary;
        this._emitCommittedFact(boundary);
        this._captureHistorySnapshot(boundary);

        if (boundary.runTermination?.terminated) {
            this.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
            return this.engine.state ? this.engine.state.turn : 1;
        }

        this.phase = TURN_LIFECYCLE_PHASES.INITIALIZING;
        this._initializeNextTurn();
        this._captureRestorePoint(boundary);
        this.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
        this._tryStartPendingTrial();
        return this.engine.state ? this.engine.state.turn : 1;
    }

    _commitCurrentTurn({ autoFallbackEnabled = true, useHypotheticalFallback = false } = {}) {
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
        const fallbackPlan = !autoFallbackEnabled && useHypotheticalFallback && maintenancePreview.hypotheticalFallbackPlan.canFullyCover
            ? maintenancePreview.hypotheticalFallbackPlan : maintenancePreview.automaticPlan;
        if (state && typeof state.processTurnEndMaintenance === "function") {
            engine.lastTurnMaintenanceResult = state.processTurnEndMaintenance({ ...maintenancePreview, fallbackPlan });
        }
        const runTermination = engine.runTerminationService?.evaluate?.({ source: "VERSE_COMMIT" }) || null;
        if (engine.globalEventManager && !runTermination?.terminated) engine.globalEventManager.tickTurn();
        return Object.freeze({ completedTurn, nextTurn: completedTurn + 1, runTermination });
    }

    _initializeNextTurn() {
        const engine = this.engine;
        const state = engine.state;
        this._advanceTurnState();
        if (engine.deckManager && typeof engine.deckManager.generateOfferingCards === "function") engine.deckManager.generateOfferingCards();
        if (engine.globalEventManager) engine.globalEventManager.onTurnStart();
        if (state && typeof state.addLog === "function") state.addLog(this._translate("LOG_TURN_START", { turn: state.turn }, `Turn ${state.turn} started.`));
    }

    _tryStartPendingTrial() {
        if (typeof this.engine.retryPendingTrialLaunch === "function") {
            try {
                const result = this.engine.retryPendingTrialLaunch();
                this.engine.lastTrialLaunchAttempt = result;
                return result;
            } catch (error) {
                const result = {
                    started: false,
                    reason: "TRIAL_LAUNCH_UNEXPECTED_ERROR",
                    errorMessage: error?.message || String(error)
                };
                this.engine.lastTrialLaunchAttempt = result;
                return result;
            }
        }

        const coordinator = this.engine.trialLaunchCoordinator;
        if (!coordinator || typeof coordinator.tryStartPending !== "function") return null;

        let result;
        try {
            result = coordinator.tryStartPending({ gameState: this.engine.state });
        } catch (error) {
            result = {
                started: false,
                reason: "TRIAL_LAUNCH_UNEXPECTED_ERROR",
                errorMessage: error?.message || String(error)
            };
        }
        this.engine.lastTrialLaunchAttempt = result;
        return result;
    }

    getPhase() { return this.phase; }
    getLastCommittedBoundary() { return this.lastCommittedBoundary; }
    getLastAdvanceBlock() { return this.lastAdvanceBlock; }
    _emitCommittedFact(boundary) {
        if (!this.gameFactHub || typeof this.gameFactHub.emit !== "function") return null;
        return this.gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: boundary.completedTurn, nextTurn: boundary.nextTurn });
    }
    _captureHistorySnapshot(boundary) {
        if (!this.historySnapshotService || typeof this.historySnapshotService.capture !== 'function') return null;
        return this.historySnapshotService.capture(boundary);
    }
    _captureRestorePoint(boundary) {
        if (!this.historySnapshotService || typeof this.historySnapshotService.captureRestorePoint !== 'function') return null;
        return this.historySnapshotService.captureRestorePoint({ verse: boundary.nextTurn, sourceCompletedTurn: boundary.completedTurn });
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
        const runtimeI18n = (typeof globalThis !== "undefined" && globalThis.I18n) ? globalThis.I18n : this.engine.i18n;
        if (!runtimeI18n || typeof runtimeI18n.t !== "function") return fallback;
        return runtimeI18n.t(key, params) || fallback;
    }
}

export default TurnLifecycleService;