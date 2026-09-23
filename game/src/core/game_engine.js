import { I18n } from '../i18n.js';
import { LAND_SYSTEM_DATA } from '../data/land_system.js';
import { DIRECTIVES, DirectiveSystem } from '../systems/directive_system.js';
import { DeckManager, OFFERING_GENERATION_REASONS } from '../systems/deck_manager.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';
import { GridEngine } from '../systems/grid_engine.js';
import { SpecialBlockService } from '../systems/special_block_service.js';
import { BoardDomainAdapter } from './board_domain_adapter.js';
import { createCardDomainActionExecutor } from '../cards/card_domain_action_executor.js';
import { BuffSystem } from '../systems/buff_system.js';
import { ChronicleSystem } from '../systems/chronicle_system.js';
import { GlobalEventManager } from '../systems/global_event_system.js';
import { ConditionEvaluator } from './condition_evaluator.js';
import { RunHistoryReadModel } from '../systems/run_history_read_model.js';
import { EmberSystem } from '../systems/ember_system.js';
import { CardCycleSystem } from '../systems/card_cycle_system.js';
import { MaintenanceFallbackSystem } from '../systems/maintenance_fallback_system.js';
import { DefenseSystem } from '../systems/defense_system.js';
import { CellViewDataService } from '../services/cell_view_data_service.js';
import { ActionTransactionManager } from './transaction_manager.js';
import { resolvePlacementGeometry } from './placement_geometry.js';
import { CheckSystem } from './check_system/check_system.js';
import { GameplayRandomService } from './gameplay_random_service.js';
import { TurnLifecycleService } from './turn_lifecycle_service.js';
import { HistoryRestoreService } from './history_restore_service.js';
import { GameState } from '../v2_unity_ready_main.js';
import { EnemyObservationProjector } from '../warning/systems/enemy_observation_projector.js';
import { attachInvestigationSubsystem } from '../warning/integration/investigation_bootstrap.js';
import { FirstRunService } from '../tutorial/first_run_service.js';
import { FirstRunState } from '../tutorial/first_run_state.js';
import { TrialTimingAuthorityService } from '../trial/systems/trial_timing_authority_service.js';

function normalizeRunSeed(seed) {
    if (!Number.isFinite(seed)) return null;
    return Math.trunc(seed) >>> 0;
}

function createRunSeed() {
    if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
        const values = new Uint32Array(1);
        globalThis.crypto.getRandomValues(values);
        return values[0] >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

class GameEngine {
    /**
     * @param {Object} [dependencies={}] - 注入するサブシステム依存群
     */
    constructor(dependencies = {}) {
        // 1. 外部サービス / 共通モジュールの解決
        this.i18n = dependencies.i18n || I18n;
        this.productionCalculator = dependencies.productionCalculator || ProductionCalculator;
        this.landData = dependencies.landData || LAND_SYSTEM_DATA;
        this.cellViewDataService = dependencies.cellViewDataService || new CellViewDataService(this.productionCalculator);
        this.transactionManager = dependencies.transactionManager || new ActionTransactionManager(this);
        const isExplicitFirstRun = dependencies.firstRun === true
            || dependencies.firstRunState?.active === true
            || dependencies.firstRunService?.enabled === true;
        this.firstRunState = dependencies.firstRunState
            || new FirstRunState({ active: isExplicitFirstRun });
        this.firstRunService = dependencies.firstRunService
            || (this.firstRunState.active ? new FirstRunService({ enabled: true }) : null);
        this.offeringMinimumRequirementProvider = dependencies.offeringMinimumRequirementProvider
            || this.firstRunService
            || null;

        const injectedCheckSystem = dependencies.checkSystem || dependencies.state?.checkSystem || null;
        const injectedRngState = injectedCheckSystem && typeof injectedCheckSystem.getState === "function"
            ? injectedCheckSystem.getState()?.rng
            : null;
        this.runSeed = normalizeRunSeed(dependencies.runSeed)
            ?? normalizeRunSeed(dependencies.state?.runSeed)
            ?? normalizeRunSeed(injectedRngState?.seed)
            ?? createRunSeed();
        const CheckSystemClass = dependencies.CheckSystemClass || CheckSystem;
        this.checkSystem = injectedCheckSystem || new CheckSystemClass({ seed: this.runSeed });

        // Gameplay-facing randomness is deliberately independent from CheckSystem dice/check RNG.
        // It must exist before GameState construction because GameState creates world-start randomness.
        const GameplayRandomServiceClass = dependencies.GameplayRandomServiceClass || GameplayRandomService;
        this.gameplayRandom = dependencies.gameplayRandom
            || new GameplayRandomServiceClass(this.runSeed);

        // 2. GameState (データストア) の初期化
        if (dependencies.state) {
            this.state = dependencies.state;
        } else {
            const GameStateClass = dependencies.GameStateClass || GameState;
            this.state = GameStateClass ? new GameStateClass({ engine: this }) : { turn: 1, ember: 20, food: 50, wood: 30, defense: 10, currentDefense: 10, maxDefense: 10, mystic: 0, handOffering: [], reserveSlots: [null] };
        }

        // 3. ドメインサブシステムの初期化と注入
        const GridEngineClass = dependencies.GridEngineClass || GridEngine;
        this.gridEngine = dependencies.gridEngine || (GridEngineClass ? new GridEngineClass(this.state, this) : null);

        const SpecialBlockServiceClass = dependencies.SpecialBlockServiceClass || SpecialBlockService;
        this.specialBlockService = dependencies.specialBlockService
            || (SpecialBlockServiceClass ? new SpecialBlockServiceClass(this.state) : null);

        const BoardDomainAdapterClass = dependencies.BoardDomainAdapterClass || BoardDomainAdapter;
        this.boardDomainAdapter = dependencies.boardDomainAdapter
            || (BoardDomainAdapterClass ? new BoardDomainAdapterClass({
                state: this.state,
                gridEngine: this.gridEngine,
                specialBlockService: this.specialBlockService
            }) : null);

        this.cardDomainActionExecutor = dependencies.cardDomainActionExecutor
            || createCardDomainActionExecutor(this);

        const DeckManagerClass = dependencies.DeckManagerClass || DeckManager;
        this.deckManager = dependencies.deckManager || (DeckManagerClass ? new DeckManagerClass(this.state, this) : null);

        const DirectiveSystemClass = dependencies.DirectiveSystemClass || DirectiveSystem;
        this.directiveSystem = dependencies.directiveSystem || (DirectiveSystemClass ? new DirectiveSystemClass(this.state, this) : null);

        const BuffSystemClass = dependencies.BuffSystemClass || BuffSystem;
        this.buffSystem = dependencies.buffSystem || (BuffSystemClass ? new BuffSystemClass(this.state, this) : null);

        const UndoLandSystemClass = dependencies.UndoLandSystemClass || UndoLandSystem;
        this.undoSystem = dependencies.undoSystem || (UndoLandSystemClass ? new UndoLandSystemClass(this.state) : null);

        const ChronicleSystemClass = dependencies.ChronicleSystemClass || ChronicleSystem;
        this.chronicleSystem = dependencies.chronicleSystem || (ChronicleSystemClass ? new ChronicleSystemClass(this.state) : null);

        this.boardWorldQuery = dependencies.boardWorldQuery || this.boardDomainAdapter || null;
        this.boardHistoryQuery = dependencies.boardHistoryQuery || null;
        this.runHistoryReadModel = dependencies.runHistoryReadModel || new RunHistoryReadModel({
            chronicleSystem: this.chronicleSystem,
            boardHistoryQuery: this.boardHistoryQuery
        });

        this.getWorldEligibilityContext = () => ({
            state: this.state,
            engine: this,
            boardQuery: this.boardWorldQuery || null,
            historyQuery: this.runHistoryReadModel || null,
            warningStateService: this.warningStateService || null
        });
        this.evaluateWorldEligibilityRequirement = (requirement) =>
            ConditionEvaluator.evaluateStrict(requirement, this.getWorldEligibilityContext());

        const GlobalEventManagerClass = dependencies.GlobalEventManagerClass || GlobalEventManager;
        this.globalEventManager = dependencies.globalEventManager || (GlobalEventManagerClass ? new GlobalEventManagerClass(this.state, this) : null);

        if (this.firstRunService) {
            const firstRunAttachment = this.firstRunService.attach({ engine: this });
            if (!firstRunAttachment?.success) {
                throw new Error(`FIRST_RUN_ATTACH_FAILED:${firstRunAttachment?.reason || "UNKNOWN"}`);
            }
            this.firstRunAttachment = firstRunAttachment;