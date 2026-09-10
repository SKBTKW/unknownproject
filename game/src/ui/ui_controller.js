import { I18n } from '../i18n.js';
import { LogComponent } from './log_component.js';
import { BuffPanelComponent } from './buff_panel_component.js';
import { TerritoryBadgeComponent } from './territory_badge_component.js';
import { UILayoutConfig } from './layout_config.js';
import { BlockPlacementSystem } from './block_placement_system.js';
import { ProductionCalculator } from '../systems/production_calculator.js';
import { ModalSystem } from './modal_system.js';
import { focusLayerManager } from './focus_layer_system.js';
import { boardCameraSystem } from './board_camera_system.js';
import { UndoLandSystem } from '../systems/undo_land_system.js';
import { EmberStatusComponent } from './ember_status_component.js';
import { HandCardsComponent } from './hand_cards_component.js';
import { ReserveSlotComponent } from './reserve_slot_component.js';
import { TopHeaderComponent } from './top_header_component.js';
import { BoardGridComponent } from './board_grid_component.js';
import { HqComponent } from './hq_component.js';
import { tooltipSystemInstance } from './tooltip_system.js';
import { UIInteractionState } from './ui_interaction_state.js';
import { attachLegacyUIBridge } from './legacy_ui_bridge.js';
import { DiceWidgetComponent } from './dice_widget_component.js';
import { DiceDisplayQueue } from './dice_display_queue.js';
import { DevDiceControlsComponent } from './dev_dice_controls_component.js';
import { BuildIdentityBadgeComponent } from './build_identity_badge_component.js';
import { TrialController } from '../trial/flow/trial_controller.js';
import { TrialPresentationState } from '../trial/presentation/trial_presentation_state.js';
import { TrialInterceptionPreviewComponent } from './trial_interception_preview_component.js';
import { TrialDefenseAllocationComponent } from './trial_defense_allocation_component.js';
import { DevelopmentTrialPreviewHarness } from '../trial/dev/development_trial_preview_harness.js';
import { TRIAL_PLAN_REASONS, TRIAL_BATTLE_STATUSES } from '../trial/domain/trial_types.js';
import { gameSettings, settingsModalInstance } from './settings_modal_system.js';
import { AdvisorDockComponent } from './advisor/advisor_dock_component.js?v=20260909_advisor2';
import { resolveAdvisorAwareToast } from './advisor/advisor_toast_policy.js';
import {
    resolvePlacementAnchor,
    resolvePlacementShape,
    rotatePlacementClockwise
} from '../core/placement_geometry.js';
import { sfxManager } from '../audio/sfx_manager.js';
import { resolveLandSelectSfx } from '../audio/land_sfx_resolver.js';

class UIController {
    /**
     * @param {GameEngine|Object} engine - ゲームエンジンまたはGameState
     */
    constructor(engine) {
        if (!engine) {
            throw new Error("UIController requires a GameEngine instance.");
        }
        if (typeof engine.nextTurn === "function") {
            this.engine = engine;
            this.state = engine.state;
        } else if (engine.engine && typeof engine.engine.nextTurn === "function") {
            this.engine = engine.engine;
            this.state = engine;
        } else {
            // テスト等で GameState が直接渡された場合の保護ラッパー (Engine必須化)
            const GameEngineClass = (typeof globalThis !== 'undefined' && globalThis.GameEngine) ? globalThis.GameEngine : null;
            this.engine = GameEngineClass ? new GameEngineClass({ state: engine }) : engine;
            this.state = this.engine.state || engine;
        }
        this.drawSys = (this.engine && this.engine.deckManager) ? this.engine.deckManager : null;
        this.undoSys = (this.engine && this.engine.undoSystem) ? this.engine.undoSystem : (UndoLandSystem && this.state ? new UndoLandSystem(this.state) : null);
        this.emberStatusComponent = (typeof document !== 'undefined') ? new EmberStatusComponent() : null;
        this.hqComponent = (typeof document !== 'undefined') ? new HqComponent(this) : null;
        this.handCardsComponent = (typeof document !== 'undefined') ? new HandCardsComponent(this) : null;
        this.reserveSlotComponent = (typeof document !== 'undefined') ? new ReserveSlotComponent(this) : null;
        this.topHeaderComponent = (typeof document !== 'undefined') ? new TopHeaderComponent(this) : null;
        this.boardGridComponent = (typeof document !== 'undefined') ? new BoardGridComponent(this) : null;
        this.diceWidget = (typeof document !== 'undefined') ? new DiceWidgetComponent() : null;
        this.diceQueue = new DiceDisplayQueue(this.diceWidget);
        this.devDiceControls = (typeof document !== 'undefined') ? new DevDiceControlsComponent(this) : null;
        this.buildIdentityBadge = (typeof document !== 'undefined') ? new BuildIdentityBadgeComponent() : null;
        this.trialDefenseAllocationComponent = (typeof document !== 'undefined') ? new TrialDefenseAllocationComponent(this) : null;
        this.trialController = new TrialController();
        this.trialPresentationState = new TrialPresentationState();
        this.trialPreviewConfig = null;
        this.developmentTrialPreviewHarness = new DevelopmentTrialPreviewHarness(this);
        this.advisorDockComponent = (typeof document !== 'undefined') ? new AdvisorDockComponent({
            stateProvider: () => this.state,
            trialStatusProvider: () => ({ active: Boolean(this.trialPreviewConfig && this.trialController.state) }),
            settingsModal: settingsModalInstance,
            gameFactHub: this.trialController.gameFactHub
        }) : null;
        
        // 🎛️ UI セッション状態モデル (Single Source of Truth)
        this.interactionState = new UIInteractionState();

        let initialMinimal = false;
        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem("toa_hand_minimal_mode");
            if (saved !== null) {
                initialMinimal = (saved === "true");
            } else if (typeof window !== 'undefined' && window.gameSettings) {
                initialMinimal = (window.gameSettings.get("defaultHandMode") === "minimal");
            }
        }
        this.isMinimalMode = initialMinimal;

        // 🌉 レガシー HTML / グローバル互換境界の接続 (UIController 本体の純粋化)
        attachLegacyUIBridge(this);
    }

    // 🎛️ UIInteractionState プロキシゲッター/セッター (100% 後方互換性保証)
    get selectedCard() { return this.interactionState.selectedCard; }
    set selectedCard(v) { this.interactionState.selectedCard = v; }

    get selectedCardIdx() { return this.interactionState.selectedCardIdx; }
    set selectedCardIdx(v) { this.interactionState.selectedCardIdx = v; }

    get selectedReserveIdx() { return this.interactionState.selectedReserveIdx; }
    set selectedReserveIdx(v) { this.interactionState.selectedReserveIdx = v; }

    get isReservePopoverOpen() { return this.interactionState.isReservePopoverOpen; }
    set isReservePopoverOpen(v) { this.interactionState.isReservePopoverOpen = v; }

    get pinnedPreviewCard() { return this.interactionState.pinnedPreviewCard; }
    set pinnedPreviewCard(v) { this.interactionState.pinnedPreviewCard = v; }

    startTrialInterceptionPreview(scenario, { deployedDefense = 6, routeId = null, cellResolver = null } = {}) {
        const availableDefense = scenario.availableDefense ?? this.state.currentDefense ?? this.state.defense ?? 0;
        const ember = scenario.ember ?? this.state?.ember ?? (this.state?.emberSystem?.current ?? 20);
        const maxEmber = scenario.maxEmber ?? this.state?.maxEmber ?? (this.state?.emberSystem?.max ?? 20);
        this.trialController.emberSystem = this.state?.emberSystem || null;
        const resolvedCellResolver = (typeof cellResolver === "function")
            ? cellResolver
            : ((r, c) => this.getBoardDisplayGrid()?.[r]?.[c] || null);
        this.trialController.startScenario({ ...scenario, availableDefense, ember, maxEmber }, { cellResolver: resolvedCellResolver });
        this.trialPresentationState.clearPlanningState();
        this.trialPresentationState.setActiveEnemyRoute(routeId);
        this.trialPresentationState.setPreviewDefenseAllocation(deployedDefense, availableDefense, 0);
        this.trialPreviewConfig = { active: true };
        this.render();
        return this.trialController.state;
    }

    startDevelopmentTrialPreview(scenarioId = "TERRAIN_COMPARE_BASIC") {
        return this.developmentTrialPreviewHarness.start(scenarioId);
    }

    stopDevelopmentTrialPreview() {
        return this.developmentTrialPreviewHarness.stop();
    }

    getBoardDisplayGrid() {
        return this.developmentTrialPreviewHarness.getDisplayGrid() || this.state.grid;
    }

    stopTrialInterceptionPreview() {
        this.trialPreviewConfig = null;
        this.trialController.state = null;
        this.trialPresentationState.clearPlanningState();
        this.hideCellTooltip();
        this.render();
    }

    getTrialAvailableDefense() {
        return Math.max(0, Math.floor(Number(this.trialController.state?.human?.availableDefense) || 0));
    }

    getActiveTrialRoute() {
        if (!this.trialPreviewConfig || !this.trialController.state) return null;
        const routes = this.trialController.state.routes || [];
        const activeRouteId = this.trialPresentationState.activeEnemyRoute;
        if (activeRouteId !== null) {
            return routes.find(route => route.id === activeRouteId) || null;
        }
        return routes[0] || null;
    }

    getTrialRoutePosition(r, c) {
        const route = this.getActiveTrialRoute();
        const cells = route ? (route.cells || route.path || []) : [];
        const index = cells.findIndex(entry => {
            const row = Number.isInteger(entry.r) ? entry.r : entry.row;
            const column = Number.isInteger(entry.c) ? entry.c : entry.column;
            return row === r && column === c;
        });
        return index >= 0 ? { route, cells, index } : null;
    }

    createTrialPreviewInput(r, c) {
        const position = this.getTrialRoutePosition(r, c);
        const displayGrid = this.getBoardDisplayGrid();
        const interceptCell = displayGrid?.[r]?.[c];
        if (!position || !interceptCell || !interceptCell.placed || interceptCell.isHQ) return null;

        const approachEntry = position.index > 0 ? position.cells[position.index - 1] : null;
        const approachR = approachEntry ? (Number.isInteger(approachEntry.r) ? approachEntry.r : approachEntry.row) : r;
        const approachC = approachEntry ? (Number.isInteger(approachEntry.c) ? approachEntry.c : approachEntry.column) : c;
        const approachCell = displayGrid?.[approachR]?.[approachC] || interceptCell;

        return {
            allocatedDefense: this.trialPresentationState.previewDefenseAllocation,
            interceptCell: { ...interceptCell, cellId: `${r}:${c}` },
            approachCell: { ...approachCell, cellId: `${approachR}:${approachC}` }
        };
    }

    getTrialInterceptionCellState(r, c) {
        if (!this.trialPreviewConfig) return null;
        const pos = this.getTrialRoutePosition(r, c);
        const displayGrid = this.getBoardDisplayGrid();
        const cell = displayGrid?.[r]?.[c];
        const activeRoute = this.getActiveTrialRoute();
        const activeRouteId = activeRoute?.id || null;

        const blockId = cell?.placementGroupId != null
            ? `placement:${cell.placementGroupId}`
            : `cell:${r}:${c}`;
        const isBlockPlannedByOther = Boolean(activeRouteId && this.trialPresentationState.isBlockPlannedByOtherRoute(activeRouteId, blockId));

        const plannedInfo = this.trialPresentationState.getPlannedCellInfo(r, c);
        const isPlanned = Boolean(plannedInfo);
        const isPlannedActive = Boolean(plannedInfo && plannedInfo.routeId === activeRouteId);
        const isPlannedOther = Boolean(plannedInfo && plannedInfo.routeId !== activeRouteId);

        if (!pos && !isPlanned) {
            return null;
        }

        const state = {
            onRoute: Boolean(pos),
            canIntercept: false
        };

        if (isPlanned) state.isPlanned = true;
        if (isPlannedActive) state.isPlannedActive = true;
        if (isPlannedOther) state.isPlannedOther = true;

        if (!pos || !cell || !cell.placed || cell.isHQ) {
            if (isBlockPlannedByOther) state.isBlockPlannedByOther = true;
            return state;
        }

        if (isBlockPlannedByOther) {
            state.canIntercept = false;
            state.isBlockPlannedByOther = true;
            state.reason = "BLOCK_ALREADY_PLANNED";
            return state;
        }

        const input = this.createTrialPreviewInput(r, c);
        if (!input) {
            return state;
        }

        const result = this.trialController.previewInterception(input);
        state.canIntercept = result.success !== false;
        return state;
    }

    updateTrialInterceptionPreview(r, c) {
        if (!this.trialPreviewConfig) return null;
        const cellState = this.getTrialInterceptionCellState(r, c);
        if (!cellState?.canIntercept) {
            this.trialPresentationState.clearHoveredCell();
            return this.refreshTrialInterceptionPreview();
        }
        this.trialPresentationState.setHoveredCell({ r, c });
        return this.refreshTrialInterceptionPreview();
    }

    refreshTrialInterceptionPreview() {
        if (!this.trialPreviewConfig) return null;
        const effectiveCell = this.trialPresentationState.getEffectiveInterceptCell();
        if (!effectiveCell) {
            this.trialPresentationState.clearInterceptionPreview();
            if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
            return null;
        }
        const { r, c } = effectiveCell;
        const input = this.createTrialPreviewInput(r, c);
        if (!input) {
            this.trialPresentationState.clearInterceptionPreview();
            if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
            return null;
        }
        const result = this.trialController.previewInterception(input);
        const terrainNameKey = input.interceptCell.terrain?.nameKey || input.interceptCell.terrain?.id || null;
        const preview = this.trialPresentationState.setInterceptionPreview({
            cell: { r, c, cellId: `${r}:${c}` },
            terrainNameKey,
            deployedDefense: this.trialPresentationState.previewDefenseAllocation,
            result
        });
        if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
        return preview;
    }

    selectTrialInterceptionCell(r, c) {
        if (!this.trialPreviewConfig) return false;
        if (this.trialPresentationState.planningReviewRequested || this.isTrialPlanningConfirmed() || this.isTrialPlanActivated()) return false;
        const cellState = this.getTrialInterceptionCellState(r, c);
        if (!cellState?.canIntercept) return false;
        this.trialPresentationState.selectInterceptCell({ r, c });
        this.trialPresentationState.clearHoveredCell();
        this.refreshTrialInterceptionPreview();
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        this.renderBoardGrid(I18n);
        if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
        return true;
    }

    setTrialDefenseAllocation(value) {
        if (!this.trialPreviewConfig) return 0;
        if (this.trialPresentationState.planningReviewRequested || this.isTrialPlanningConfirmed() || this.isTrialPlanActivated()) {
            return this.trialPresentationState.previewDefenseAllocation;
        }
        const activeRoute = this.getActiveTrialRoute();
        const activeRouteId = activeRoute?.id;
        const maxForRoute = activeRouteId
            ? this.trialPresentationState.getMaxAllocationForRoute(activeRouteId, this.getTrialAvailableDefense())
            : this.getTrialAvailableDefense();
        const allocation = this.trialPresentationState.setPreviewDefenseAllocation(
            value,
            maxForRoute
        );
        this.refreshTrialInterceptionPreview();
        return allocation;
    }

    adjustTrialDefenseAllocation(delta) {
        if (this.trialPresentationState.planningReviewRequested || this.isTrialPlanningConfirmed() || this.isTrialPlanActivated()) {
            return this.trialPresentationState.previewDefenseAllocation;
        }
        const current = this.trialPresentationState.previewDefenseAllocation;
        return this.setTrialDefenseAllocation(current + Number(delta || 0));
    }

    getTrialPlannedDefenseTotal() {
        return this.trialPresentationState.getPlannedDefenseTotal();
    }

    getTrialRemainingDefense() {
        return this.trialPresentationState.getRemainingDefense(this.getTrialAvailableDefense());
    }

    getTrialPlanningRoutes() {
        if (!this.trialPreviewConfig || !this.trialController.state) return [];
        return this.trialController.getPlanningRoutes();
    }

    selectTrialRoute(routeId) {
        if (!this.trialPreviewConfig) return false;
        this.trialPresentationState.setActiveEnemyRoute(routeId);
        this.trialPresentationState.clearHoveredCell();

        const decision = this.trialPresentationState.getRouteDecision(routeId);
        const available = this.getTrialAvailableDefense();
        const maxForRoute = this.trialPresentationState.getMaxAllocationForRoute(routeId, available);

        if (decision.status === "INTERCEPT" && decision.interceptCell) {
            this.trialPresentationState.selectInterceptCell(decision.interceptCell);
            this.trialPresentationState.setPreviewDefenseAllocation(decision.defenseAllocation, maxForRoute);
            this.refreshTrialInterceptionPreview();
        } else if (decision.status === "SKIP") {
            this.trialPresentationState.clearSelectedInterceptCell();
            this.trialPresentationState.setPreviewDefenseAllocation(0, maxForRoute);
            this.trialPresentationState.clearInterceptionPreview();
        } else {
            this.trialPresentationState.clearSelectedInterceptCell();
            this.trialPresentationState.setPreviewDefenseAllocation(0, maxForRoute);
            this.trialPresentationState.clearInterceptionPreview();
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        this.renderBoardGrid(I18n);
        if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
        return true;
    }

    setTrialActiveRouteIntercept() {
        if (!this.trialPreviewConfig) return { success: false, reason: "NOT_IN_TRIAL" };
        if (this.trialPresentationState.planningReviewRequested) return { success: false, reason: "REVIEW_REQUESTED" };
        if (this.isTrialPlanActivated()) return { success: false, reason: "PLAN_ALREADY_ACTIVATED" };
        if (this.isTrialPlanningConfirmed()) return { success: false, reason: "ALREADY_CONFIRMED" };
        const activeRoute = this.getActiveTrialRoute();
        if (!activeRoute) return { success: false, reason: "NO_ACTIVE_ROUTE" };
        const selectedCell = this.trialPresentationState.selectedInterceptCell;
        if (!selectedCell) return { success: false, reason: "NO_SELECTED_CELL" };
        const allocation = this.trialPresentationState.previewDefenseAllocation;
        if (allocation < 1) return { success: false, reason: "INVALID_DEFENSE_ALLOCATION" };

        const displayGrid = this.getBoardDisplayGrid();
        const routes = this.trialController.state?.routes || [];

        const result = this.trialPresentationState.setRouteInterceptPlan(
            activeRoute.id,
            selectedCell,
            allocation,
            {
                availableDefense: this.getTrialAvailableDefense(),
                routes,
                cellResolver: (r, c) => displayGrid?.[r]?.[c] || null,
                domainValidator: (routeId, coords, defense) => {
                    const input = this.createTrialPreviewInput(coords.r, coords.c);
                    if (!input) return { success: false, reason: "INVALID_INTERCEPT_CELL" };
                    input.allocatedDefense = defense;
                    return this.trialController.previewInterception(input);
                }
            }
        );

        if (result.success) {
            this.trialPresentationState.clearPlanningReviewRequest();
            this.refreshTrialInterceptionPreview();
            this.render();
        }
        return result;
    }

    setTrialActiveRouteSkip() {
        if (!this.trialPreviewConfig) return { success: false, reason: "NOT_IN_TRIAL" };
        if (this.trialPresentationState.planningReviewRequested) return { success: false, reason: "REVIEW_REQUESTED" };
        if (this.isTrialPlanActivated()) return { success: false, reason: "PLAN_ALREADY_ACTIVATED" };
        if (this.isTrialPlanningConfirmed()) return { success: false, reason: "ALREADY_CONFIRMED" };
        const activeRoute = this.getActiveTrialRoute();
        if (!activeRoute) return { success: false, reason: "NO_ACTIVE_ROUTE" };

        const routes = this.trialController.state?.routes || [];
        const result = this.trialPresentationState.setRouteSkipped(activeRoute.id, routes);
        if (result.success) {
            this.trialPresentationState.clearPlanningReviewRequest();
            this.trialPresentationState.clearSelectedInterceptCell();
            this.trialPresentationState.setPreviewDefenseAllocation(0, this.getTrialAvailableDefense());
            this.refreshTrialInterceptionPreview();
            this.render();
        }
        return result;
    }

    clearTrialActiveRouteDecision() {
        if (!this.trialPreviewConfig) return { success: false, reason: "NOT_IN_TRIAL" };
        if (this.trialPresentationState.planningReviewRequested) return { success: false, reason: "REVIEW_REQUESTED" };
        if (this.isTrialPlanActivated()) return { success: false, reason: "PLAN_ALREADY_ACTIVATED" };
        if (this.isTrialPlanningConfirmed()) return { success: false, reason: "ALREADY_CONFIRMED" };
        const activeRoute = this.getActiveTrialRoute();
        if (!activeRoute) return { success: false, reason: "NO_ACTIVE_ROUTE" };

        const result = this.trialPresentationState.clearRouteDecision(activeRoute.id);
        if (result.success) {
            this.trialPresentationState.clearPlanningReviewRequest();
            this.trialPresentationState.clearSelectedInterceptCell();
            this.trialPresentationState.setPreviewDefenseAllocation(0, this.getTrialAvailableDefense());
            this.refreshTrialInterceptionPreview();
            this.render();
        }
        return result;
    }

    validateTrialPlanning() {
        if (!this.trialPreviewConfig || !this.trialController) {
            return { valid: false, errors: ["TRIAL_NOT_STARTED"], warnings: [], undecidedRoutes: [] };
        }
        const displayGrid = this.getBoardDisplayGrid();
        return this.trialController.validatePlanningDraft(this.trialPresentationState.routePlanDrafts, {
            cellResolver: (r, c) => displayGrid?.[r]?.[c] || null
        });
    }

    finishTrialPlanning() {
        const validation = this.validateTrialPlanning();
        if (!validation.valid) {
            this.trialPresentationState.planningValidationErrors = validation.errors || [];
            this.trialPresentationState.planningCompletionWarningOpen = false;
            this.trialPresentationState.planningReviewRequested = false;
            this.trialPresentationState.planningWarningsAccepted = false;
            this.render();
            return { success: false, errors: validation.errors, warnings: validation.warnings };
        }

        const hasUndecided = Array.isArray(validation.warnings) && validation.warnings.includes("ROUTES_UNDECIDED");
        if (hasUndecided && !this.trialPresentationState.planningWarningsAccepted) {
            this.trialPresentationState.planningValidationErrors = [];
            this.trialPresentationState.planningCompletionWarningOpen = true;
            this.trialPresentationState.planningWarningInfo = {
                undecidedRoutes: validation.undecidedRoutes || [],
                count: (validation.undecidedRoutes || []).length
            };
            this.trialPresentationState.planningReviewRequested = false;
            this.render();
            return { success: false, warning: "ROUTES_UNDECIDED", undecidedRoutes: validation.undecidedRoutes };
        }

        this.trialPresentationState.planningValidationErrors = [];
        this.trialPresentationState.planningCompletionWarningOpen = false;
        this.trialPresentationState.planningReviewRequested = true;
        this.render();
        return { success: true, reviewRequested: true };
    }

    dismissTrialPlanningWarning() {
        this.trialPresentationState.planningCompletionWarningOpen = false;
        this.trialPresentationState.planningWarningInfo = null;
        this.render();
        return { success: true };
    }

    acceptTrialPlanningWarningAndProceed() {
        this.trialPresentationState.planningCompletionWarningOpen = false;
        this.trialPresentationState.planningWarningsAccepted = true;
        this.trialPresentationState.planningReviewRequested = true;
        this.trialPresentationState.planningWarningInfo = null;
        this.render();
        return { success: true, reviewRequested: true };
    }

    clearTrialPlanningReviewRequest() {
        this.trialPresentationState.clearPlanningReviewRequest();
        this.render();
        return { success: true };
    }

    isTrialPlanningConfirmed() {
        return Boolean(this.trialController?.state?.interceptionPlan);
    }

    confirmTrialPlanning() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"], warnings: [] };
        }
        if (this.isTrialPlanningConfirmed()) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.ALREADY_CONFIRMED], warnings: [] };
        }

        const validation = this.validateTrialPlanning();
        if (!validation.valid || (validation.errors && validation.errors.length > 0)) {
            this.trialPresentationState.planningValidationErrors = validation.errors || [];
            this.render();
            return { success: false, errors: validation.errors, warnings: validation.warnings };
        }

        const hasUndecided = Array.isArray(validation.warnings) && validation.warnings.includes("ROUTES_UNDECIDED");
        const allowWarnings = Boolean(this.trialPresentationState.planningWarningsAccepted);
        if (hasUndecided && !allowWarnings) {
            return {
                success: false,
                requiresConfirmation: true,
                warnings: validation.warnings,
                errors: []
            };
        }

        const result = this.trialController.confirmInterceptionPlan(
            this.trialPresentationState.routePlanDrafts,
            { allowWarnings }
        );

        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }

        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    isTrialPlanActivated() {
        return Boolean(this.trialController?.state?.planActivated);
    }

    getTrialBattleQueue() {
        return this.trialController?.state?.battleQueue || null;
    }

    activateTrialPlan() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.activateInterceptionPlan();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    isTrialBattleActive() {
        return this.trialController?.state?.currentBattleIndex !== null;
    }

    isTrialBattleResolved() {
        const currentBattle = this.getCurrentTrialBattle();
        return Boolean(currentBattle && currentBattle.status === TRIAL_BATTLE_STATUSES.RESOLVED);
    }

    getCurrentTrialBattle() {
        return this.trialController ? this.trialController.getCurrentBattle() : null;
    }

    getCurrentTrialBattleResult() {
        return this.trialController?.state?.getCurrentBattleResult?.() || null;
    }

    startTrialBattle() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.startNextBattle();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    resolveCurrentTrialBattle() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.resolveCurrentBattle();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    advanceCurrentTrialBattle() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.advanceAfterCurrentBattle();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        if (result.traversalResult?.reachedRouteEnd) {
            this.trialController.resolveRouteEndDamage(result.traversalResult.battleIndex);
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    getCurrentTrialTraversalResult() {
        return this.trialController?.getCurrentTraversalResult?.() || null;
    }

    getCurrentTrialDamageResult() {
        return this.trialController?.getCurrentDamageResult?.() || null;
    }

    getTrialDamageResult(battleIndex) {
        return this.trialController?.getDamageResult?.(battleIndex) || null;
    }

    resolveTrialRouteEndDamage(battleIndex = null) {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.resolveRouteEndDamage(battleIndex);
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    isTrialTraversalApplied() {
        return this.trialController?.isCurrentTraversalApplied?.() || false;
    }

    getTrialRouteProgress(routeId) {
        return this.trialController?.getRouteProgress?.(routeId) || null;
    }

    transitionTrialAfterCurrentBattle() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.transitionAfterCurrentBattle();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    isTrialBattleSequenceAdvanced() {
        return this.trialController?.isCurrentBattleSequenceAdvanced?.() || false;
    }

    canCompleteTrial() {
        return this.trialController ? this.trialController.canCompleteTrial() : false;
    }

    completeTrial() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.completeTrial();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        this.render();
        return result;
    }

    isTrialCompleted() {
        return this.trialController ? this.trialController.isTrialCompleted() : false;
    }

    getTrialResult() {
        return this.trialController ? this.trialController.getTrialResult() : null;
    }

    /**
     * 🚀 UI の初期化とマウント
     */
    init() {
        this.initModularUIComponents();
        this.initStaticI18nLabels();
        this.initGlobalCancelListeners();
        if (tooltipSystemInstance) {
            tooltipSystemInstance.state = this.state;
            tooltipSystemInstance.stateProvider = () => this.state;
            tooltipSystemInstance.init(I18n);
        }
        this.render();
    }

    /**
     * 🛑 土地カード選択のキャンセル（解除）
     */
    deselectCard() {
        if (!this.selectedCard && this.selectedCardIdx === -1) return;
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = -1;
        if (focusLayerManager) focusLayerManager.onCardDeselect();
        this.clearCellPreviews();
        this.render();
        this.highlightPlaceableCells();
        this.updateFloatingPreview(null);
        sfxManager.play("UI_CARD_CANCEL");
    }

    /**
     * 🎯 盤面外クリック / Esc キー / 盤面外右クリックによる配置キャンセル検知
     */
    initGlobalCancelListeners() {
        if (typeof document === "undefined") return;

        // 1. 盤面外・背景クリックでキャンセル ＆ 保留ポップオーバー閉じ
        document.addEventListener("click", (e) => {
            if (this.isReservePopoverOpen && !e.target.closest(".reserve-popover-menu") && !e.target.closest(".reserve-card-hold")) {
                this.closeReservePopover();
            }

            if (!this.selectedCard) return;
            // クリック先がマス目(.cell)、手札カード、保留枠、手札トレイ全体、マリガンボタン、モーダル内の場合は除外
            if (e.target.closest(".cell") || 
                e.target.closest(".card-frame-tcg") || 
                e.target.closest(".card-slot-box") || 
                e.target.closest(".reserve-slot-empty") || 
                e.target.closest(".reserve-slot-single-box") || 
                e.target.closest(".offering-section") || 
                e.target.closest("#cardRow") || 
                e.target.closest("#btnMulligan") || 
                e.target.closest(".modal-container") || 
                e.target.closest("#directiveModal")) {
                return;
            }
            this.deselectCard();
        });

        // 2. Esc キーで即時キャンセル ＆ 保留ポップオーバー閉じ
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Esc") {
                if (this.isReservePopoverOpen) {
                    this.closeReservePopover();
                }
                if (this.selectedCard) {
                    this.deselectCard();
                }
            }
        });

        // 3. 右クリックによる選択解除（土地カードはセル・カード上回転/盤面外キャンセル、コマンドカードはどこでも右クリック即時キャンセル）
        document.addEventListener("contextmenu", (e) => {
            if (this.selectedCard) {
                const tObj = this.selectedCard.terrain || this.selectedCard;
                const category = this.selectedCard.category || tObj.category || "LAND";
                
                // コマンドカードの場合は、盤面内外を問わず右クリックで即座にキャンセル
                if (category !== "LAND") {
                    e.preventDefault();
                    this.deselectCard();
                    return;
                }

                // 土地カードの場合は、盤面セル・カード・保留・手札枠以外をクリックでキャンセル
                if (!e.target.closest(".cell") && 
                    !e.target.closest(".card-frame-tcg") && 
                    !e.target.closest(".reserve-slot-empty") && 
                    !e.target.closest(".reserve-slot-single-box") && 
                    !e.target.closest(".offering-section")) {
                    e.preventDefault();
                    this.deselectCard();
                }
            }
        });

        // 4. 🖱️ ドラッグ中の禁止カーソル (赤丸斜線 🚫) 抑止
        document.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        });
    }

    initModularUIComponents() {
        if (UILayoutConfig && typeof UILayoutConfig.applyLayout === "function") {
            UILayoutConfig.applyLayout();
        }
        if (typeof document === "undefined") return;

        const logContainer = document.getElementById("logComponentContainer");
        if (LogComponent && logContainer && !logContainer.hasChildNodes()) {
            LogComponent.mount(logContainer, this.state);
        }

        const advisorContainer = document.getElementById("advisorDockContainer");
        if (this.advisorDockComponent && advisorContainer) {
            this.advisorDockComponent.mount(advisorContainer);
        }

        const buffContainer = document.getElementById("buffComponentContainer");
        if (BuffPanelComponent && buffContainer && !buffContainer.hasChildNodes()) {
            BuffPanelComponent.mount(buffContainer);
        }

        const badgeContainer = document.getElementById("territoryBadgeFooterSlot") || document.getElementById("territoryBadgeContainer");
        const badgeComp = (typeof TerritoryBadgeComponent !== "undefined" && TerritoryBadgeComponent) ? TerritoryBadgeComponent : (typeof window !== "undefined" ? window.TerritoryBadgeComponent : null);
        if (badgeComp && badgeContainer) {
            if (typeof badgeComp.mount === "function") {
                badgeComp.mount(badgeContainer);
            }
        }

        // 🌟 2層レイヤー監視初期化 (手札フォーカス ✕ 盤面暗転ブラー)
        const boardEl = document.getElementById("layerWorldBoard") || document.querySelector(".layer-world-board") || document.querySelector(".board-container");
        const offeringEl = document.querySelector(".offering-section");
        if (focusLayerManager && typeof focusLayerManager.mount === "function") {
            focusLayerManager.mount(boardEl, offeringEl);
        }

        // 🎡 盤面マウスホイール可変ズーム初期化 (Civ6 スタイル)
        const boardWrapperEl = document.querySelector(".board-container-wrapper") || document.getElementById("gridBoard");
        if (boardCameraSystem && typeof boardCameraSystem.mount === "function") {
            boardCameraSystem.mount(boardWrapperEl, boardEl);
        }

        // ⚙️ 環境設定モーダル ＆ ヘッダーボタン初期化
        const settingsSys = (typeof settingsModalInstance !== "undefined" && settingsModalInstance) ? settingsModalInstance : (typeof window !== "undefined" ? window.settingsModalInstance : null);
        if (settingsSys && typeof settingsSys.mount === "function") {
            settingsSys.mount();
        }

        if (this.buildIdentityBadge && typeof this.buildIdentityBadge.mount === "function") {
            void this.buildIdentityBadge.mount();
        }
    }

    initStaticI18nLabels() {
        if (typeof document === "undefined") return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : null);
        if (!I18n) return;

        document.title = I18n.t("UI_TITLE");
        this.setElementText("lblAppTitle", I18n.t("UI_TITLE"));
        this.setElementText("lblRoleAvatar", I18n.t("UI_ROLE_AVATAR"));
        this.setElementText("lblTurnHeader", I18n.t("UI_TURN_LABEL"));
        this.setElementText("lblOfferingTitle", I18n.t("UI_OFFERING_TITLE") || "手札オファリング");
        this.setElementText("lblReserveTitle", I18n.t("UI_RESERVE_TITLE"));
        this.setElementText("lblMainBadge", I18n.t("UI_MAIN_AREA_BADGE"));
        this.setElementText("lblDataPanelTitle", I18n.t("UI_DATA_PANEL_TITLE"));
        this.setElementText("lblBuffPanelTitle", I18n.t("UI_BUFF_PANEL_TITLE"));
        this.setElementText("lblFood", I18n.t("UI_FOOD"));
        this.setElementText("lblWood", I18n.t("UI_WOOD"));
        this.setElementText("lblDefense", I18n.t("UI_DEFENSE"));
        this.setElementText("lblMystic", I18n.t("UI_MYSTIC"));
        this.setElementText("lblLogTitle", I18n.t("UI_LOG_TITLE"));
        this.setElementText("btnLogToggle", "▼");
        this.setElementText("btnTurnEnd", I18n.t("UI_TURN_END_BTN"));
        this.setElementText("lblLogSub", I18n.t("UI_LOG_SUB_HINT"));

        // 🌐 全 data-i18n 要素の自動多言語翻訳
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (key) el.innerHTML = I18n.t(key);
        });
    }

    setElementText(id, text) {
        if (typeof document === "undefined") return;
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    /**
     * 🖥️ 画面全体の描画更新 (Render)
     */
    render() {
        if (!this.state || typeof document === "undefined") return;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });

        // 1. ログ描画（最優先・絶対に失敗させない）
        try {
            this.renderLogs();
        } catch (e) {
            console.error("Log render error:", e);
        }

        try {
            // 🏛️ 最上部HUDヘッダー (資源・ターン数・領土バッジ・試練予告) - TopHeaderComponent へ委譲
            if (this.topHeaderComponent) {
                this.topHeaderComponent.render(I18n);
            }

            // 🗺️ 盤面グリッド描画 (本営C3セル含む)
            this.renderBoardGrid(I18n);

            // 🔥 本営 (C3) 残り火変動差分検知 ＆ フロートポップアップ演出 (盤面描画直後に実行することでDOM消失を完全防止)
            if (this.hqComponent && typeof this.hqComponent.checkAndTriggerDeltaPopup === "function") {
                this.hqComponent.checkAndTriggerDeltaPopup(this.state.ember);
            }

            this.renderOfferingCards(I18n);
            this.renderBuffPanel();
            this.updateMulliganButton();
            this.updateFloatingPreview(null);
            if (this.trialDefenseAllocationComponent) this.trialDefenseAllocationComponent.render();
            if (this.advisorDockComponent) this.advisorDockComponent.render();
        } catch (err) {
            console.error("UIController Render Error:", err);
        }
    }

    /**
     * 🏛️ 親メディエーター: 本営セルの描画委譲 (コンポーネント間直接参照の遮断)
     */
    renderHqCell(cellEl, state, I18n) {
        if (this.hqComponent && typeof this.hqComponent.renderCell === "function") {
            return this.hqComponent.renderCell(cellEl, state, I18n);
        }
    }

    /**
     * 🔥 親メディエーター: 本営変動差分ポップアップ委譲 (コンポーネント間直接参照の遮断)
     */
    showHqDeltaPopup(delta) {
        if (this.hqComponent && typeof this.hqComponent.showDeltaPopup === "function") {
            return this.hqComponent.showDeltaPopup(delta);
        }
    }

    /**
     * 🎲 CheckResolvedEvent の受動キューイング演出 (画面右下隅 HUD)
     * @param {Object} event - { result, context, feedback }
     */
    showDiceCheck(event) {
        if (this.diceQueue && typeof this.diceQueue.enqueue === "function") {
            this.diceQueue.enqueue(event);
        }
    }

    renderLogs() {
        if (typeof window !== "undefined" && window.LogComponent && typeof window.LogComponent.renderLogs === "function") {
            window.LogComponent.renderLogs();
        }
    }

    renderBoardGrid(I18n) {
        if (this.boardGridComponent && typeof this.boardGridComponent.render === "function") {
            this.boardGridComponent.render(I18n);
        }
    }

    renderOfferingHeader(I18n) {
        const offeringSection = document.querySelector(".offering-section");
        if (!offeringSection) return;

        let headerEl = offeringSection.querySelector(".section-title-offering");
        if (!headerEl) {
            headerEl = document.createElement("div");
            headerEl.className = "section-title-offering section-title-offering-header";
            offeringSection.insertBefore(headerEl, offeringSection.firstChild);
        }

        const canMulligan = !this.state.hasPickedThisTurn && !this.state.hasMulliganedThisTurn && this.state.ember >= 1;
        const reserveCostText = I18n ? (I18n.t("RESERVE_HEADER_COST") || "ターン終了時 🔥-1") : "ターン終了時 🔥-1";
        const mulliganBtnLabel = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const reserveCostTooltip = I18n ? (I18n.t("RESERVE_HEADER_COST_TOOLTIP") || "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します") : "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します";

        headerEl.innerHTML = `
            <div class="offering-header-hand-col">
                <button class="btn-mulligan-compact" id="btnMulligan" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                    <span>${mulliganBtnLabel}</span> <span class="btn-mulligan-ember-cost">🔥-1</span>
                </button>
            </div>
            <div class="offering-header-separator-space"></div>
            <div class="offering-header-reserve-col">
                <span class="reserve-header-cost-badge" data-tooltip="${reserveCostTooltip}">
                    ${reserveCostText}
                </span>
            </div>
        `;

        const btnMulligan = headerEl.querySelector("#btnMulligan");
        if (btnMulligan && canMulligan) {
            btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
        }
    }

    handleMulliganClick(btnMulligan) {
        const settings = (typeof window !== "undefined" && window.gameSettings) ? window.gameSettings : null;
        const confirmRequired = settings ? settings.get("mulliganConfirm") : true;

        const executeMulligan = () => {
            if (typeof window.mulligan === "function") {
                window.mulligan();
            } else if (this.engine && typeof this.engine.mulligan === "function") {
                this.engine.mulligan();
            }
        };

        if (!confirmRequired) {
            executeMulligan();
            return;
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const dlgTitle = I18n ? I18n.t("UI_DIALOG_MULLIGAN_TITLE") : "手札を引き直しますか？";
        const dlgDesc = I18n ? I18n.t("UI_DIALOG_MULLIGAN_DESC") : "🔥 残り火を 1 消費して新カード 3 枚を引き直します。";
        const dlgConfirm = I18n ? I18n.t("UI_DIALOG_MULLIGAN_CONFIRM") : "引き直す (🔥 -1)";
        const dlgCancel = I18n ? I18n.t("UI_DIALOG_MULLIGAN_CANCEL") : "やめる";
        const dlgDontAsk = I18n ? I18n.t("UI_DIALOG_DONT_ASK_AGAIN") : "次回から確認しない";

        if (typeof ModalSystem !== "undefined" && typeof ModalSystem.showConfirmDialog === "function") {
            ModalSystem.showConfirmDialog({
                title: `🔄 ${dlgTitle}`,
                descText: dlgDesc,
                costText: "🔥 -1",
                checkboxLabel: dlgDontAsk,
                confirmLabel: dlgConfirm,
                cancelLabel: dlgCancel,
                onConfirm: (dontAskAgain) => {
                    if (dontAskAgain && settings) {
                        settings.set("mulliganConfirm", false);
                    }
                    executeMulligan();
                }
            });
            return;
        }

        // フォールバック
        executeMulligan();
    }

    /**
     * 📐 手札表示モード（標準 260x390px ⇄ ミニマル 64x80px + ホバー拡大）切替
     */
    toggleHandMinimalMode() {
        if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
            window.tooltipSystemInstance.hide();
        }
        this.isMinimalMode = !this.isMinimalMode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem("toa_hand_minimal_mode", this.isMinimalMode ? "true" : "false");
        }
        this.render();
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        if (typeof window.showToast === "function") {
            const toastMsg = this.isMinimalMode ? (I18n ? I18n.t("UI_TOAST_MINIMAL_MODE_ON") : "手札をミニマル表示（ホバー拡大）に切り替えました") : (I18n ? I18n.t("UI_TOAST_MINIMAL_MODE_OFF") : "手札を標準表示に切り替えました");
            window.showToast(toastMsg);
        }
    }

    renderOfferingCards(I18n) {
        const offeringSection = document.querySelector(".offering-section");
        if (offeringSection) {
            // 既存の古い独立ヘッダーがあれば削除
            const oldHeader = offeringSection.querySelector(".section-title-offering");
            if (oldHeader) oldHeader.remove();

            // 🚀 保留ポップオーバー展開時は手札トレイ全体を最前面化 (z-index: 2500)
            offeringSection.classList.toggle("has-popover-open", !!this.isReservePopoverOpen);
            offeringSection.classList.toggle("is-minimal", !!this.isMinimalMode);
        }

        const cardRowEl = document.getElementById("cardRow");
        if (!cardRowEl || !this.state.handOffering) return;
        cardRowEl.innerHTML = "";
        cardRowEl.classList.toggle("is-minimal", !!this.isMinimalMode);

        const canMulligan = !this.state.hasPickedThisTurn && !this.state.hasMulliganedThisTurn && this.state.ember >= 1;
        const reserveCostText = I18n ? (I18n.t("RESERVE_HEADER_COST") || "ターン終了時 🔥-1") : "ターン終了時 🔥-1";
        const reserveCostTooltip = I18n ? (I18n.t("RESERVE_HEADER_COST_TOOLTIP") || "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します") : "⚠️ 保留枠にカードをキープしたままターンを終了すると、維持費として 🔥-1 を消費します";
        const mulliganTooltip = I18n ? (I18n.t("UI_MULLIGAN_HELP_TOOLTIP") || "🔥 残り火を 1 消費して手札 3 枚を破棄し、新たに 3 枚引き直します (1ターン1回のみ)") : "🔥 残り火を 1 消費して手札 3 枚を破棄し、新たに 3 枚引き直します (1ターン1回のみ)";
        const mulliganTitle = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const mulliganBtnLabel = I18n ? (I18n.t("UI_MULLIGAN_BTN_LABEL") || "🔄 マリガン") : "🔄 マリガン";
        const minimalToggleTitle = I18n ? (I18n.t("TOOLTIP_MINIMAL_TOGGLE_TITLE") || "📐 縮小表示切替") : "📐 縮小表示切替";
        const minimalToggleDesc = I18n ? (I18n.t("TOOLTIP_MINIMAL_TOGGLE_DESC") || "手札の表示サイズ（標準 ⇄ 縮小）を切り替えます") : "手札の表示サイズ（標準 ⇄ 縮小）を切り替えます";

        // 🃏 ミニマルモード時 (完全1段 3ブロック・センタリング構造)
        if (this.isMinimalMode) {
            // 1. 左端: 正方形ボタングループ (46×46px 2段)
            const btnGroup = document.createElement("div");
            btnGroup.className = "minimal-btn-group";
            btnGroup.innerHTML = `
                <button class="btn-minimal-toggle is-active" id="btnMinimalToggle" onclick="window.toggleHandMinimalMode()" data-tooltip-title="${minimalToggleTitle}" data-tooltip="${minimalToggleDesc}">
                    <span>⤢</span>
                </button>
                <button class="btn-minimal-mulligan" id="btnMulligan" data-tooltip-title="${mulliganTitle}" data-tooltip="${mulliganTooltip}" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                    <span>🔄</span>
                </button>
            `;
            const btnMulligan = btnGroup.querySelector("#btnMulligan");
            if (btnMulligan && canMulligan) {
                btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
            }
            cardRowEl.appendChild(btnGroup);

            // 2. 第1セパレーター (ボタンと手札を区切る縦線)
            const separator1 = document.createElement("div");
            separator1.className = "offering-tray-separator";
            cardRowEl.appendChild(separator1);

            // 3. 中央: 手札カード 3枚 (各 80×120px)
            const handContainer = this.handCardsComponent ? this.handCardsComponent.render(I18n) : document.createElement("div");
            cardRowEl.appendChild(handContainer);

            // 4. 第2セパレーター (手札と保留を区切る縦線)
            const separator2 = document.createElement("div");
            separator2.className = "offering-tray-separator";
            cardRowEl.appendChild(separator2);

            // 5. 右端: 保留スロット (80×120px / 手札と完全同一サイズ)
            const reserveContainer = this.reserveSlotComponent ? this.reserveSlotComponent.render(I18n) : document.createElement("div");
            cardRowEl.appendChild(reserveContainer);
            return;
        }

        // 🃏 標準モード時 (260x390px 左右2グループ完全規格レイアウト)
        // 🃏 1. 左側: 手札グループ (ヘッダー ＋ 手札3枚)
        const handGroup = document.createElement("div");
        handGroup.className = "offering-hand-group";

        const handHeader = document.createElement("div");
        handHeader.className = "offering-header-hand-col";
        handHeader.style.display = "flex";
        handHeader.style.alignItems = "center";
        handHeader.style.justifyContent = "flex-start";
        handHeader.style.gap = "8px";

        handHeader.innerHTML = `
            <button class="btn-minimal-toggle" id="btnMinimalToggle" onclick="window.toggleHandMinimalMode()" data-tooltip-title="${minimalToggleTitle}" data-tooltip="${minimalToggleDesc}">
                <span>⤢</span>
            </button>
            <button class="btn-mulligan-compact" id="btnMulligan" data-tooltip-title="${mulliganTitle}" data-tooltip="${mulliganTooltip}" ${canMulligan ? "" : "disabled style='opacity:0.45; cursor:not-allowed; filter:grayscale(0.8);'"}>
                <span>${mulliganBtnLabel}</span> <span class="btn-mulligan-ember-cost">🔥-1</span>
            </button>
        `;
        const btnMulligan = handHeader.querySelector("#btnMulligan");
        if (btnMulligan && canMulligan) {
            btnMulligan.onclick = () => this.handleMulliganClick(btnMulligan);
        }
        handGroup.appendChild(handHeader);

        const handContainer = this.handCardsComponent ? this.handCardsComponent.render(I18n) : document.createElement("div");
        handGroup.appendChild(handContainer);
        cardRowEl.appendChild(handGroup);

        // ⚡ 2. 中央: 縦セパレーター (上から下まで垂直貫通)
        const separator = document.createElement("div");
        separator.className = "offering-reserve-separator";
        cardRowEl.appendChild(separator);

        // 📦 3. 右側: 保留グループ (ヘッダー ＋ 保留スロット)
        const reserveGroup = document.createElement("div");
        reserveGroup.className = "offering-reserve-group";

        const reserveHeader = document.createElement("div");
        reserveHeader.className = "offering-header-reserve-col";
        reserveHeader.innerHTML = `
            <span class="reserve-header-cost-badge" data-tooltip="RESERVE_HEADER_COST_TOOLTIP">
                ${reserveCostText}
            </span>
        `;
        reserveGroup.appendChild(reserveHeader);

        const reserveContainer = this.reserveSlotComponent ? this.reserveSlotComponent.render(I18n) : document.createElement("div");
        reserveGroup.appendChild(reserveContainer);
        cardRowEl.appendChild(reserveGroup);
    }

    selectReserveCard(reserveIdx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        if (!this.state.reserveSlots || !this.state.reserveSlots[reserveIdx]) return;

        const resCard = this.state.reserveSlots[reserveIdx];
        const tObj = resCard.terrain || resCard;
        const category = resCard.category || tObj.category || "LAND";

        // 🔄 選択中の保留カードを再度クリックした場合: 常に選択解除
        if (this.selectedReserveIdx === reserveIdx) {
            this.deselectCard();
            return;
        }

        // ⚡ コマンドカードの場合: 発動確認ダイアログを開く
        if (category !== "LAND") {
            this.triggerCommandCardPlay(resCard, -1, reserveIdx);
            return;
        }

        // 🌱 土地カードの場合: 選択状態にする (盤面ハイライト)
        this.selectedCard = resCard;
        this.selectedCardIdx = -1;
        this.selectedReserveIdx = reserveIdx;
        if (focusLayerManager) focusLayerManager.onCardSelect();
        this.render();
        this.highlightPlaceableCells();
        sfxManager.play(resolveLandSelectSfx(resCard));
    }

    rotateReserveCard(e, reserveIdx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const card = this.state.reserveSlots[reserveIdx];
        if (!card) return;

        this.rotateLandCardPlacement(card);
        this.render();
        if (this.selectedReserveIdx === reserveIdx) {
            this.highlightPlaceableCells();
        }
    }

    rotateLandCardPlacement(card) {
        if (!card) return null;
        const currentShape = resolvePlacementShape(card);
        const currentAnchor = resolvePlacementAnchor(card, currentShape);
        const rotated = rotatePlacementClockwise(currentShape, currentAnchor);

        // 🔄 実際に形状・向き・アンカーが変化したかを厳密判定（点対称1x1等では鳴らさない）
        const shapeChanged = currentShape.length !== rotated.shape.length ||
            currentShape[0].length !== rotated.shape[0].length ||
            currentAnchor.r !== rotated.anchor.r ||
            currentAnchor.c !== rotated.anchor.c;

        card.currentShape = rotated.shape;
        card.currentAnchor = rotated.anchor;

        if (shapeChanged) {
            sfxManager.play("LAND_ROTATE");
        }
        return rotated;
    }

    renderBuffPanel() {
        const buffComp = (typeof BuffPanelComponent !== "undefined" && BuffPanelComponent) ? BuffPanelComponent : (typeof window !== "undefined" ? window.BuffPanelComponent : null);
        if (!buffComp || typeof buffComp.update !== "function") return;

        const buffs = (this.state && typeof this.state.getAllBuffs === "function") ? this.state.getAllBuffs() : [];
        buffComp.update(buffs);
    }

    updateMulliganButton() {
        const btnMulligan = document.getElementById("btnMulligan");
        if (btnMulligan && this.state) {
            const isMulliganBlocked = this.state.hasPickedThisTurn || this.state.hasMulliganedThisTurn || this.state.ember < 1;
            btnMulligan.disabled = isMulliganBlocked;
            btnMulligan.style.opacity = isMulliganBlocked ? "0.45" : "1.0";
            btnMulligan.style.cursor = isMulliganBlocked ? "not-allowed" : "pointer";
        }
    }

    triggerCommandCardPlay(card, idx = -1, reserveIdx = -1) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const tObj = card.terrain || card;
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const cName = tObj.nameKey ? I18n.t(tObj.nameKey) : (tObj.id || "Card");
        const cDesc = tObj.descriptionKey ? I18n.t(tObj.descriptionKey) : "";

        let costBadgeText = "";
        if (tObj.cost) {
            const c = tObj.cost;
            const parts = [];
            if (c.food) parts.push(`🌾-${c.food}`);
            if (c.wood) parts.push(`🧱-${c.wood}`);
            if (c.mystic) parts.push(`✨-${c.mystic}`);
            if (c.ember) parts.push(`🔥-${c.ember}`);
            costBadgeText = parts.join(" ");
        }

        if (typeof window !== "undefined" && window.ModalSystem) {
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            const titleStr = I18n ? I18n.t("UI_CMD_CONFIRM_TITLE", { name: cName }) : `📜 ${cName}`;
            const confirmStr = I18n ? I18n.t("UI_ACTIVATE_CMD") : "⚡ 発動する";
            const cancelStr = I18n ? I18n.t("UI_CANCEL") : "✖ キャンセル";

            window.ModalSystem.showConfirmDialog({
                title: titleStr,
                descText: cDesc,
                costText: costBadgeText,
                confirmLabel: confirmStr,
                cancelLabel: cancelStr,
                onConfirm: () => {
                    this.playCommandCard(card, idx);
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.selectedReserveIdx = -1;
                    if (focusLayerManager) focusLayerManager.onCardDeselect();
                    this.render();
                },
                onCancel: () => {
                    this.selectedCard = null;
                    this.selectedCardIdx = -1;
                    this.selectedReserveIdx = -1;
                    if (focusLayerManager) focusLayerManager.onCardDeselect();
                    this.render();
                    this.highlightPlaceableCells();
                }
            });
        }
    }

    selectCard(idx) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank) return;

        const tObj = card.terrain || card;
        const category = card.category || tObj.category || "LAND";

        // 🔄 選択中のカードを再度クリックした場合:
        // コマンドカードなら発動確認ダイアログを開く、土地カードなら選択解除
        if (this.selectedCardIdx === idx) {
            if (category !== "LAND") {
                this.triggerCommandCardPlay(card, idx, -1);
                return;
            }
            this.deselectCard();
            return;
        }

        // 1回目のクリック: 純粋な選択状態にする (保留可能にする)
        this.selectedCard = card;
        this.selectedCardIdx = idx;
        this.selectedReserveIdx = -1;
        if (focusLayerManager) focusLayerManager.onCardSelect();
        this.render();
        this.highlightPlaceableCells();

        // 🎵 SFX: 土地カードは地形固有音、コマンドカード等は共通カード選択音（二重再生を完全防止）
        if (category === "LAND") {
            sfxManager.play(resolveLandSelectSfx(card));
        } else {
            sfxManager.play("UI_CARD_SELECT");
        }
    }

    rotateSelectedCard(e, idx) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        if (!this.state || !this.state.handOffering) return;
        const card = this.state.handOffering[idx];
        if (!card || card.isBlank) return;

        const rotated = this.rotateLandCardPlacement(card);
        if (this.selectedCard && (this.selectedCardIdx === idx || this.selectedCard === card)) {
            this.selectedCard.currentShape = rotated.shape;
            this.selectedCard.currentAnchor = rotated.anchor;
        }

        this.render();
        if (this.selectedCardIdx === idx || (this.selectedCard && this.selectedCard === card)) {
            this.highlightPlaceableCells();
        } else if (this.selectedCardIdx === -1 && this.selectedReserveIdx === -1) {
            // 未選択時の手札ホバー中回転 ➔ 盤面候補ハイライトとヒントポップオーバーを即時更新
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.highlightPlaceableCandidates(card, this.state);
            }
            if (typeof document !== "undefined") {
                const cardElements = document.querySelectorAll(".cards-hand-container .card-frame-tcg");
                if (cardElements && cardElements[idx]) {
                    this.showCardActionHintPopover(cardElements[idx], card);
                }
            }
        }
    }

    onCellClick(r, c) {
        if (!this.state) return;
        if (this.trialPreviewConfig) {
            this.selectTrialInterceptionCell(r, c);
            return;
        }
        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);

        // ↩️ 当ターン配置済みマスをクリックした場合は配置取り消し（Undo）
        if (undoSys && typeof undoSys.isCellPlacedThisTurn === "function" && undoSys.isCellPlacedThisTurn(r, c)) {
            this.hideCellTooltip();
            let undoRes = null;
            if (this.engine && typeof this.engine.undoLastAction === "function") {
                undoRes = this.engine.undoLastAction();
            } else if (undoSys) {
                const ok = undoSys.undo();
                undoRes = typeof ok === "object" ? ok : { success: !!ok };
            }
            if (undoRes && undoRes.success) {
                sfxManager.play("LAND_UNDO");
            }
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.highlightPlaceableCells();
            return;
        }

        if (!this.selectedCard || this.state.hasPickedThisTurn) return;
        this.hideCellTooltip();

        const tObjCheck = this.selectedCard.terrain || this.selectedCard;
        const catCheck = this.selectedCard.category || tObjCheck.category || "LAND";
        if (catCheck !== "LAND") {
            this.triggerCommandCardPlay(this.selectedCard, this.selectedCardIdx, this.selectedReserveIdx);
            return;
        }

        const currentIdx = this.selectedCardIdx !== -1 ? this.selectedCardIdx : (this.state.handOffering ? this.state.handOffering.indexOf(this.selectedCard) : -1);
        const source = this.selectedReserveIdx !== -1
            ? { type: "RESERVE", index: this.selectedReserveIdx }
            : { type: "OFFERING", index: currentIdx };

        const actionRes = (this.engine && typeof this.engine.placeLand === "function")
            ? this.engine.placeLand(r, c, this.selectedCard, 0, source)
            : { success: false, reason: "NO_ENGINE" };

        if (actionRes && actionRes.success) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
            this.processToastQueue();
            sfxManager.resolveAndPlayPlacementOutcome(actionRes.placementOutcome || {});
        } else {
            if (typeof alert === "function") alert(I18n.t("ALERT_CANNOT_PLACE"));
        }
    }

    /**
     * 🌟 連結即時ボーナス・ソケット開花トーストキューの画面フロートポップアップ消費
     * - シーケンシャル・スタッガーディレイ (280ms) によるテンポ良い連鎖演出
     * - 垂直スタッククリアランス (54px) による物理的重なり・被りの完全根絶
     * - ビューポート安全クランプ (ヘッダー被り・画面外突き抜け防止)
     */
    processToastQueue() {
        if (typeof document === "undefined") return;
        const drainedToasts = (this.engine && typeof this.engine.drainToasts === "function")
            ? this.engine.drainToasts()
            : [];
        const advisorEnabled = this.advisorDockComponent?.isEnabled?.() === true;
        const toasts = drainedToasts.map(toast => resolveAdvisorAwareToast(toast, advisorEnabled)).filter(Boolean);
        if (toasts.length === 0) return;

        const viewportWidth = (typeof window !== "undefined" ? window.innerWidth : 800);
        const viewportHeight = (typeof window !== "undefined" ? window.innerHeight : 600);

        toasts.forEach((toast, idx) => {
            const { r, c, text } = toast;

            setTimeout(() => {
                // 当該セルの DOM 座標を取得
                let targetX = viewportWidth / 2;
                let targetY = viewportHeight / 2;

                const cellEl = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`) || document.querySelector(`#cell_${r}_${c}`);
                if (cellEl && typeof cellEl.getBoundingClientRect === "function") {
                    const rect = cellEl.getBoundingClientRect();
                    targetX = rect.left + rect.width / 2;
                    targetY = rect.top + rect.height / 2;
                }

                // 垂直オフセット（重なり防止スタック: 高さ48pxに対して 54px 上方へシフト）
                const offsetY = idx * 54;
                let finalY = targetY - offsetY;

                // 画面上部（ヘッダー 70px）に突き抜ける場合の安全クランプ
                if (finalY < 80) {
                    finalY = 80 + (idx * 54);
                }

                // 画面左右の安全クランプ
                const clampedX = Math.max(120, Math.min(viewportWidth - 120, targetX));

                // フロートポップアップ要素の生成
                const popup = document.createElement("div");
                popup.className = "float-toast-bonus";
                popup.innerHTML = text;
                popup.style.left = `${clampedX}px`;
                popup.style.top = `${finalY}px`;
                document.body.appendChild(popup);

                // アニメーション完了後に DOM から自動削除
                setTimeout(() => {
                    if (popup.parentNode) popup.parentNode.removeChild(popup);
                }, 1800);
            }, idx * 280);
        });
    }

    clearCellPreviews() {
        if (this.trialPreviewConfig) {
            this.trialPresentationState.clearHoveredCell();
            this.refreshTrialInterceptionPreview();
            this.hideTileTooltip();
            if (typeof document !== "undefined") {
                document.querySelectorAll(".merge-hover-highlight").forEach(cell => {
                    cell.classList.remove("merge-hover-highlight");
                });
            }
            return;
        }
        this.hideTileTooltip();
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        if (undoSys) undoSys.hideHoverTooltip();

        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            if (this.selectedCard) {
                // 🌟 カード選択中（手札の処理が残っている時）は配置可能ハイライトを絶対消去せず、ホバー枠のみ消去
                window.BlockPlacementSystem.clearHoverPreviews();
            } else {
                // カード非選択時のみ全ハイライトを完全消去
                window.BlockPlacementSystem.clearAllPreviews();
            }
        } else if (typeof document !== "undefined") {
            const cells = document.querySelectorAll(".cell");
            cells.forEach(c => c.classList.remove("preview-valid", "preview-invalid", "merge-hover-highlight", "hq-vicinity-hover-glow"));
            if (!this.selectedCard) {
                cells.forEach(c => c.classList.remove("placeable-candidate"));
            }
        }
    }

    hideCellTooltip() {
        if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.hide === "function") {
            window.tooltipSystemInstance.hide();
        }
    }
    hideTileTooltip() {
        this.hideCellTooltip();
    }

    highlightPlaceableCells() {
        if (!this.selectedCard) {
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.clearAllPreviews();
            }
            return;
        }
        const tObj = this.selectedCard.terrain || this.selectedCard;
        const category = this.selectedCard.category || tObj.category || "LAND";
        if (category !== "LAND") {
            // 🛡️ コマンドカード選択時は土地配置ハイライトを完全停止
            if (typeof window !== "undefined" && window.BlockPlacementSystem) {
                window.BlockPlacementSystem.clearAllPreviews();
            }
            return;
        }
        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            window.BlockPlacementSystem.highlightPlaceableCandidates(this.selectedCard, this.state);
        }
    }

    onCellMouseEnter(e, r, c) {
        if (!this.state || typeof document === "undefined") return;
        const cellData = this.getBoardDisplayGrid()[r][c];
        const groupId = cellData ? (cellData.mergeGroupId || cellData.placementGroupId) : null;
        if (groupId) {
            const groupCells = document.querySelectorAll(`.cell[data-group-id="${groupId}"]`);
            groupCells.forEach(el => el.classList.add("merge-hover-highlight"));
        }
        if (this.trialPreviewConfig) {
            this.updateTrialInterceptionPreview(r, c);
            return;
        }
        if (typeof window !== "undefined" && window.BlockPlacementSystem) {
            window.BlockPlacementSystem.updateHoverPreview(e, r, c, this.selectedCard, this.state);
        }
    }

    onCellMouseMove(e, r, c) {
        if (!this.state) return;
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        if (undoSys) undoSys.hideHoverTooltip();

        const cellData = this.getBoardDisplayGrid()[r][c];
        this.showCellTooltip(e, r, c, cellData);
    }

    showTileTooltip(e, r, c, cell) {
        this.showCellTooltip(e, r, c, cell);
    }

    showCellTooltip(e, r, c, cell) {
        if (typeof document === "undefined") return;
        if (!cell) {
            this.hideCellTooltip();
            return;
        }

        // 🛑 排他制御: カード選択中（配置プレビュー中）かつ未配置マスの場合は通常セルツールチップを抑制し、配置プレビュー/不可理由警告に100%委譲
        if (this.selectedCard && !cell.placed) {
            return;
        }

        // 🃏 カード大型プレビューモーダル表示中はスリープ
        const previewModal = document.getElementById("cardHoverPreviewModal");
        if (previewModal && previewModal.classList.contains("active")) {
            this.hideCellTooltip();
            return;
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        if (this.developmentTrialPreviewHarness.isActive()) {
            const cellState = this.getTrialInterceptionCellState(r, c);
            if (cellState?.isBlockPlannedByOther) {
                const title = `[${String.fromCharCode(65 + c)}${r + 1}]`;
                const desc = `<div class="trial-block-planned-warning">${I18n.t("UI_TRIAL_BLOCK_ALREADY_PLANNED")}</div>`;
                if (typeof window !== "undefined" && window.tooltipSystemInstance?.showCustom) {
                    window.tooltipSystemInstance.showCustom(e?.clientX || 0, e?.clientY || 0, title, desc);
                }
                return;
            }
            const preview = this.trialPresentationState.interceptionPreview;
            if (!preview || preview.cell?.r !== r || preview.cell?.c !== c) {
                this.hideCellTooltip();
                return;
            }
            const terrainName = I18n.t(preview.terrainNameKey || "TERRAIN_PLAINS");
            const title = `${terrainName} [${String.fromCharCode(65 + c)}${r + 1}]`;
            const desc = TrialInterceptionPreviewComponent.renderHtml(preview, I18n);
            if (typeof window !== "undefined" && window.tooltipSystemInstance?.showCustom) {
                window.tooltipSystemInstance.showCustom(e?.clientX || 0, e?.clientY || 0, title, desc);
            }
            return;
        }
        const undoSys = this.undoSys || (typeof window !== "undefined" ? window.undoSys : null);
        const isPlacedThisTurn = (undoSys && typeof undoSys.isCellPlacedThisTurn === "function") ? undoSys.isCellPlacedThisTurn(r, c) : false;

        const coordStr = `${String.fromCharCode(65 + c)}${r + 1}`;
        const isHQVic = (this.state && typeof this.state.isHQVicinity === "function") ? this.state.isHQVicinity(r, c) : false;

        // 🌊 湖 (Lake) / オアシス (Oasis) 周囲8マスの水脈判定
        let nearWaterType = null;
        if (this.state && this.state.grid) {
            const size = this.state.grid.length;
            for (let lr = 0; lr < size; lr++) {
                for (let lc = 0; lc < size; lc++) {
                    const lcCell = this.state.grid[lr][lc];
                    if (lcCell && lcCell.placed && lcCell.socketResource) {
                        const sid = lcCell.socketResource.id || lcCell.socketResource.nameKey || "";
                        if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                            if (Math.abs(lr - r) <= 1 && Math.abs(lc - c) <= 1 && !(lr === r && lc === c)) {
                                nearWaterType = sid === "SOCKET_OASIS" ? "OASIS" : "LAKE";
                                break;
                            }
                        }
                    }
                }
                if (nearWaterType) break;
            }
        }

        let title = `[${coordStr}]`;
        let desc = isHQVic 
            ? (I18n ? I18n.t("UI_CELL_HQ_VICINITY_DESC") : "🏛️ 本営近郊エリア") 
            : (I18n ? I18n.t("UI_CELL_UNCLAIMED") : "未開拓の土地");

        if (nearWaterType && !cell.placed) {
            const waterTitle = I18n ? I18n.t(nearWaterType === "OASIS" ? "UI_OASIS_VICINITY_TITLE" : "UI_LAKE_VICINITY_TITLE") : "🌊 水脈エリア";
            title = `[${coordStr}] ${waterTitle}`;
            const waterDesc = I18n ? I18n.t(nearWaterType === "OASIS" ? "UI_OASIS_VICINITY_UNPLACED_DESC" : "UI_LAKE_VICINITY_UNPLACED_DESC") : "";
            desc = `${desc}<div style="margin-top:6px;">${waterDesc}</div>`;
        }

        if (cell.isHQ) {
            title = I18n ? I18n.t("UI_CELL_HQ_TITLE", { coord: coordStr }) : `🏛️ HQ [${coordStr}]`;
            desc = I18n ? I18n.t("UI_CELL_HQ_DESC") : "🌾+10 🧱+10 🛡️10 ✨+1";
        } else if (cell.hasSocket && !cell.placed) {
            title = I18n ? I18n.t("UI_CELL_SOCKET_TITLE", { coord: coordStr }) : `★ [${coordStr}]`;
            desc = I18n ? I18n.t("UI_CELL_SOCKET_DESC") : "★ 資源ソケット";
        } else if (cell.placed && cell.terrain) {
            const t = cell.terrain;
            const tName = I18n.t(t.nameKey || t.id || "TERRAIN_PLAINS");
            const placedTag = isPlacedThisTurn ? ` <span style="font-size:12px; background:#e74c3c; color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">${I18n ? I18n.t("UI_CELL_PLACED_TAG") : "当ターン配置"}</span>` : "";
            title = `🌱 ${tName} [${coordStr}]${placedTag}`;

            const viewData = this.engine ? this.engine.getCellViewData(r, c) : null;
            const y = (viewData && viewData.yields) ? viewData.yields : { food: 0, wood: 0, defense: 0, mystic: 0 };
            const tf = y.food || 0;
            const tw = y.wood || 0;
            const td = y.defense || 0;
            const tm = y.mystic || 0;

            const bonusParts = [];
            let sourceWaterDesc = "";

            if (cell.socketResource) {
                const s = cell.socketResource;
                const sName = I18n.t(s.nameKey || "SOCKET_RESOURCE");
                const resIcon = (this.boardGridComponent && typeof this.boardGridComponent.getSocketResourceIcon === "function")
                    ? this.boardGridComponent.getSocketResourceIcon(s)
                    : (s.icon || "💎");
                bonusParts.push(`${resIcon} : ${sName}`);

                const sid = s.id || s.nameKey || "";
                if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                    sourceWaterDesc = I18n ? I18n.t(sid === "SOCKET_OASIS" ? "UI_OASIS_SOURCE_DESC" : "UI_LAKE_SOURCE_DESC") : "";
                }
            }

            if (viewData && Array.isArray(viewData.modifiers)) {
                let hqVicinityReported = false;
                for (const mod of viewData.modifiers) {
                    if (mod.type === "HQ_VICINITY" && !hqVicinityReported) {
                        bonusParts.push(I18n ? I18n.t("UI_CELL_BONUS_VICINITY") : "本営近郊(+1)");
                        hqVicinityReported = true;
                    } else if (mod.type === "LAKE_IRRIGATION") {
                        const i18nKey = nearWaterType === "OASIS" ? "UI_CELL_BONUS_OASIS_IRRIGATION" : "UI_CELL_BONUS_LAKE_IRRIGATION";
                        bonusParts.push(I18n ? I18n.t(i18nKey, { val: mod.amount }) : `灌漑(+${mod.amount})`);
                    } else if (mod.type === "PERMANENT_PLAINS") {
                        bonusParts.push(I18n ? I18n.t("UI_CELL_BONUS_PLAINS", { val: mod.amount }) : `平地強化(+${mod.amount})`);
                    }
                }
            }

            const yieldParts = [];
            if (tf > 0) yieldParts.push(`🌾+${tf}`);
            if (tw > 0) yieldParts.push(`🧱+${tw}`);
            if (td > 0) yieldParts.push(`🛡️+${td}`);
            if (tm > 0) yieldParts.push(`✨+${tm}`);

            const yieldStr = yieldParts.length > 0 ? yieldParts.join(" ") : (I18n ? I18n.t("UI_CELL_YIELD_NONE") : "産出なし");
            const bonusStr = bonusParts.length > 0 ? ` <span style="color:#f1c40f;">(${bonusParts.join(", ")})</span>` : "";
            const perTurnLabel = I18n ? I18n.t("UI_CELL_PER_TURN_YIELD") : "毎ターン産出:";
            desc = `${perTurnLabel} <strong>${yieldStr}</strong>${bonusStr}`;
            if (sourceWaterDesc) {
                desc += sourceWaterDesc;
            }

            // 🌐 範囲効果（湖水源バフ・本営近郊バフ）の影響圏ガイド
            const influenceNotes = [];
            if (nearWaterType) {
                influenceNotes.push(I18n ? I18n.t("TOOLTIP_INFLUENCE_LAKE") : "💧 Lake Influence");
            }
            if (isHQVic) {
                influenceNotes.push(I18n ? I18n.t("TOOLTIP_INFLUENCE_HQ") : "🏘 HQ Vicinity");
            }
            if (influenceNotes.length > 0) {
                desc += `<div class="tooltip-influence-note"><small>${influenceNotes.join("<br>")}</small></div>`;
            }

            // ↩️ 当ターン配置マスの場合は配置取り消し（置き直し）ガイドを明示
            if (isPlacedThisTurn) {
                const undoHint = I18n ? I18n.t("UI_CELL_UNDO_HINT") : "このマスをクリックすると配置を取り消せます";
                desc += `
                    <div class="tooltip-undo-hint-box">
                        <span class="undo-icon">↩</span>
                        <span>${undoHint}</span>
                    </div>
                `;
            }
        }

        const trialPreview = this.trialPresentationState.interceptionPreview;
        if (this.trialPreviewConfig && trialPreview && trialPreview.cell?.r === r && trialPreview.cell?.c === c) {
            desc += TrialInterceptionPreviewComponent.renderHtml(trialPreview, I18n);
        }

        if (typeof window !== "undefined" && window.tooltipSystemInstance && typeof window.tooltipSystemInstance.showCustom === "function") {
            const clientX = e ? (e.clientX !== undefined ? e.clientX : (e.pageX || 0)) : 0;
            const clientY = e ? (e.clientY !== undefined ? e.clientY : (e.pageY || 0)) : 0;
            window.tooltipSystemInstance.showCustom(clientX, clientY, title, desc);
        }
    }

    mulligan() {
        if (!this.engine || typeof this.engine.mulligan !== "function") return;
        const res = this.engine.mulligan();
        if (res && res.success) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.render();
        }
    }

    nextTurn() {
        const settings = (typeof window !== "undefined" && window.gameSettings) ? window.gameSettings : gameSettings;
        const warningRequired = settings ? settings.get("turnEndWarning") : true;
        const continueToMaintenanceCheck = () => this.confirmFoodDeficitFallback();

        if (warningRequired && this.state && !this.state.hasPickedThisTurn) {
            const modalSys = (typeof window !== "undefined" && window.ModalSystem) ? window.ModalSystem : ModalSystem;
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
            if (modalSys && typeof modalSys.showConfirmDialog === "function") {
                modalSys.showConfirmDialog({
                    title: I18n ? I18n.t("UI_CONFIRM_WARN_NO_LAND_TITLE") : "No land placed",
                    descText: I18n ? I18n.t("UI_CONFIRM_WARN_NO_LAND_MSG") : "End the turn without placing land?",
                    confirmLabel: I18n ? I18n.t("UI_TURN_END_BTN") : "End turn",
                    cancelLabel: I18n ? I18n.t("UI_CANCEL") : "Cancel",
                    onConfirm: continueToMaintenanceCheck
                });
                return;
            }
        }
        continueToMaintenanceCheck();
    }

    confirmFoodDeficitFallback() {
        const settings = (typeof window !== "undefined" && window.gameSettings) ? window.gameSettings : gameSettings;
        const autoFallbackEnabled = settings ? settings.get("autoFoodDeficitFallback") : true;
        const options = { autoFallbackEnabled, useHypotheticalFallback: false };
        if (autoFallbackEnabled || !this.engine || typeof this.engine.previewTurnEndMaintenance !== "function") {
            this.executeNextTurn(options);
            return;
        }

        const preview = this.engine.previewTurnEndMaintenance({ autoFallbackEnabled: false });
        const plan = preview && preview.hypotheticalFallbackPlan;
        if (!preview || preview.deficit <= 0 || !plan || !plan.canFullyCover) {
            this.executeNextTurn(options);
            return;
        }

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : { t: k => k });
        const modalSys = (typeof window !== "undefined" && window.ModalSystem) ? window.ModalSystem : ModalSystem;
        if (!modalSys || typeof modalSys.showConfirmDialog !== "function") {
            this.executeNextTurn(options);
            return;
        }

        modalSys.showConfirmDialog({
            title: I18n ? I18n.t("UI_FOOD_FALLBACK_CONFIRM_TITLE") : "Food deficit",
            descText: I18n ? I18n.t("UI_FOOD_FALLBACK_CONFIRM_MSG", { deficit: preview.deficit }) : "Spend resources to prevent Ember loss?",
            costText: `✨ -${plan.mysticSpent}  🧱 -${plan.materialSpent}`,
            confirmLabel: I18n ? I18n.t("UI_FOOD_FALLBACK_CONFIRM") : "Use resources",
            cancelLabel: I18n ? I18n.t("UI_FOOD_FALLBACK_SKIP") : "End without fallback",
            onConfirm: () => this.executeNextTurn({
                autoFallbackEnabled: false,
                useHypotheticalFallback: true
            }),
            onCancel: () => this.executeNextTurn(options)
        });
    }

    executeNextTurn(options = {}) {
        if (this.engine && typeof this.engine.nextTurn === "function") {
            this.engine.nextTurn(options);
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.render();
        }
    }

    toggleReservePopover(idx = 0) {
        if (!this.state || this.state.hasPickedThisTurn) return;
        if (!this.state.reserveSlots || !this.state.reserveSlots[idx]) return;

        this.isReservePopoverOpen = !this.isReservePopoverOpen;
        this.render();
    }

    closeReservePopover() {
        this.isReservePopoverOpen = false;
        this.render();
    }

    playReserveCard(idx = 0) {
        this.isReservePopoverOpen = false;
        this.selectReserveCard(idx);
    }

    reserveCard(idx) {
        if (!this.engine || typeof this.engine.reserveOfferingCard !== "function") return;
        const res = this.engine.reserveOfferingCard(idx);
        if (res && res.success) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    returnReserveCard(idx = 0, targetHandIdx = -1) {
        if (!this.engine || typeof this.engine.returnReservedCard !== "function") return;
        const res = this.engine.returnReservedCard(idx);
        if (res && res.success) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    discardReserveCard(idx = 0) {
        if (!this.engine || typeof this.engine.discardReservedCard !== "function") return;
        const res = this.engine.discardReservedCard(idx);
        if (res && res.success) {
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            this.isReservePopoverOpen = false;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.clearCellPreviews();
            this.render();
            this.highlightPlaceableCells();
        }
    }

    playCommandCard(card, targetIdx) {
        if (!this.engine || typeof this.engine.playCommandCard !== "function") return;
        let cardIdx = (typeof targetIdx === "number" && targetIdx >= 0) ? targetIdx : (this.state && this.state.handOffering ? this.state.handOffering.indexOf(card) : -1);
        const source = this.selectedReserveIdx !== -1
            ? { type: "RESERVE", index: this.selectedReserveIdx }
            : { type: "OFFERING", index: cardIdx };

        const res = this.engine.playCommandCard(card, source);
        if (res && res.success) {
            const cardData = card?.terrain || card || {};
            if ((cardData.category || card?.category) === "MILITARY") this.advisorDockComponent?.observeMilitaryAction?.(cardData.id || cardData.nameKey || "MILITARY");
            sfxManager.play("COMMAND_EXECUTE");
            const diceCheck = res.diceCheck || (res.result && res.result.diceCheck);
            if (diceCheck && typeof this.showDiceCheck === "function") {
                this.showDiceCheck(diceCheck);
            }
            this.selectedCard = null;
            this.selectedCardIdx = -1;
            this.selectedReserveIdx = -1;
            if (focusLayerManager) focusLayerManager.onCardDeselect();
            this.render();
        }
    }

    toggleDirectiveModal() {
        if (typeof window !== "undefined" && typeof window.toggleDirectiveModal === "function") {
            // 既存モーダル連携
        }
    }

    closeDirectiveModal() {
        if (typeof document !== "undefined") {
            const modal = document.getElementById("directiveModal");
            if (modal) modal.style.display = "none";
        }
    }

    selectDirective(id) {
        const dirSys = (this.engine && this.engine.directiveSystem) ? this.engine.directiveSystem : this.state.directiveSystem;
        if (dirSys) {
            dirSys.setDirective(id);
            this.closeDirectiveModal();
            this.render();
        }
    }

    /**
     * 🎨 盤面テキストスタイル切替 (盤面左上角のボタンクリックでトリガー)
     */
    toggleTileTextStyle(e) {
        if (e && typeof e.stopPropagation === "function") e.stopPropagation();
        const presets = [
            { id: "DEFAULT", icon: "🏷️", labelKey: "UI_TILE_STYLE_LABEL_DEFAULT" },
            { id: "PILL_BADGE", icon: "💊", labelKey: "UI_TILE_STYLE_LABEL_PILL" },
            { id: "ICON_SYMMETRIC", icon: "🌾", labelKey: "UI_TILE_STYLE_LABEL_SYMMETRIC" },
            { id: "MODERN_BOARD", icon: "✨", labelKey: "UI_TILE_STYLE_LABEL_MODERN" },
            { id: "SYMBOLIC_BOARD", icon: "🎨", labelKey: "UI_TILE_STYLE_LABEL_SYMBOLIC" }
        ];

        let currentStyle = (typeof UI_FEATURE_FLAGS !== "undefined" && UI_FEATURE_FLAGS.tileTextStyle) ? UI_FEATURE_FLAGS.tileTextStyle : "DEFAULT";
        let currentIdx = presets.findIndex(p => p.id === currentStyle);
        if (currentIdx < 0) currentIdx = 0;
        const nextIdx = (currentIdx + 1) % presets.length;
        const nextPreset = presets[nextIdx];

        if (typeof UI_FEATURE_FLAGS !== "undefined") {
            UI_FEATURE_FLAGS.tileTextStyle = nextPreset.id;
        }
        const boardEl = document.getElementById("gridBoard");
        if (boardEl) {
            boardEl.setAttribute("data-tile-style", nextPreset.id);
        }
        if (typeof document !== "undefined" && document.body) {
            document.body.setAttribute("data-tile-style", nextPreset.id);
        }

        const btn = document.getElementById("cornerTileStyleToggleBtn");
        if (btn) {
            btn.innerText = nextPreset.icon;
            const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' ? window.I18n : null);
            const label = I18n ? I18n.t(nextPreset.labelKey) : nextPreset.id;
            btn.title = label;
        }
    }

    toggleBoardLabelMode(e) {
        this.toggleTileTextStyle(e);
    }

    /**
     * 📊 ヘッダーデータパネルのホバー表示 (TooltipSystemへの統一委譲・Single Source of Truth)
     */
    showDataPanelTooltip(e) {
        const targetEl = (e && e.currentTarget) ? e.currentTarget : (document.getElementById("headerDataPanel") || document.querySelector(".header-resource-data-panel"));
        if (targetEl && tooltipSystemInstance) {
            tooltipSystemInstance.state = this.state;
            tooltipSystemInstance.stateProvider = () => this.state;
            tooltipSystemInstance.show(targetEl, e);
        }
    }

    hideDataPanelTooltip() {
        if (tooltipSystemInstance) {
            tooltipSystemInstance.hide();
        }
    }

    /**
     * 🃏 ミニマルモード時の手札直上フローティング拡大プレビューの完全制御
     * （トレイ実座標からのピクセル完全センタリング ＆ 選択中は常時表示維持）
     * @param {HTMLElement|null} overrideCardEl ホバーされたカード要素 (nullの場合は選択中カードを参照)
     */
    updateFloatingPreview(overrideCardEl = null) {
        if (typeof document === "undefined") return;
        const previewEl = document.getElementById("cardFloatingPreview");
        if (!previewEl) return;

        // ミニマルモードでない場合は常に非表示
        if (!this.isMinimalMode) {
            previewEl.classList.remove("is-visible");
            return;
        }

        let targetEl = overrideCardEl;

        // ホバー対象がない場合、現在選択中のカード（手札または保留）があればそれを表示し続ける
        if (!targetEl) {
            if (this.selectedCardIdx !== -1) {
                const cardElements = document.querySelectorAll(".cards-hand-container .card-frame-tcg");
                if (cardElements && cardElements[this.selectedCardIdx]) {
                    targetEl = cardElements[this.selectedCardIdx];
                }
            } else if (this.selectedReserveIdx !== -1) {
                targetEl = document.querySelector(".reserve-slot-single-box .card-frame-tcg");
            }
        }

        if (!targetEl) {
            previewEl.classList.remove("is-visible");
            return;
        }

        const fullHtml = targetEl.getAttribute("data-full-card-html") || targetEl.innerHTML;
        const categoryClass = Array.from(targetEl.classList).find(c => c.startsWith("category-")) || "";
        const isReserveEmpty = targetEl.classList.contains("reserve-slot-empty");

        if (isReserveEmpty) {
            previewEl.innerHTML = `
                <div class="reserve-slot-empty">
                    ${fullHtml}
                </div>
            `;
        } else {
            previewEl.innerHTML = `
                <div class="card-frame-tcg ${categoryClass}">
                    ${fullHtml}
                </div>
            `;
        }

        previewEl.classList.add("is-visible");
    }

    hideFloatingPreviewIfNotSelected() {
        // 選択中のカードがなければプレビューを非表示、あれば選択中カードに戻す
        this.updateFloatingPreview(null);
    }

    /**
     * 💡 マウスオーバー時のカード操作ガイドポップアップ表示 (3大操作ヒント)
     * @param {HTMLElement} targetCardEl 
     * @param {Object} card 
     */
    showCardActionHintPopover(targetCardEl, card) {
        if (this.isMinimalMode || (typeof document !== "undefined" && (document.body.classList.contains("is-minimal") || !!document.querySelector("#cardRow.is-minimal, .offering-section.is-minimal")))) return;
        if (typeof document === "undefined" || !targetCardEl || !card || card.isBlank) return;
        this.hideCardActionHintPopover();

        const I18n = (typeof globalThis !== 'undefined' && globalThis.I18n) ? globalThis.I18n : (typeof window !== 'undefined' && window.I18n ? window.I18n : { t: k => k });
        const tObj = card.terrain || card;
        const category = card.category || tObj.category || "LAND";

        const popover = document.createElement("div");
        popover.id = "cardActionHintPopover";
        popover.className = "card-action-hint-popover";

        if (category === "LAND") {
            popover.innerHTML = `
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_PLACE_LAND")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_ROTATE")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_RESERVE")}</span>
                </div>
            `;
        } else {
            popover.innerHTML = `
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_PLAY_CMD")}</span>
                </div>
                <div class="card-action-hint-item">
                    <span class="card-action-hint-bullet">&bull;</span>
                    <span>${I18n.t("UI_CARD_HINT_RESERVE")}</span>
                </div>
            `;
        }

        targetCardEl.style.position = "relative";
        targetCardEl.appendChild(popover);
    }

    hideCardActionHintPopover() {
        if (typeof document === "undefined") return;
        const existing = document.getElementById("cardActionHintPopover");
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
    }
}

if (typeof window !== "undefined") {
    window.UIController = UIController;
}
if (typeof globalThis !== "undefined") {
    globalThis.UIController = UIController;
}

export { UIController };
export default UIController;
