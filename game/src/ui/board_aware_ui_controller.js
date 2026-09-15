import { UIController as LegacyUIController } from './ui_controller.js?v=20260909_advisor2';
import { TrialInterceptionSemanticProvider } from '../trial/presentation/trial_interception_semantic_provider.js';
import {
    BoardPresentationState,
    BOARD_CONTEXT_MODES
} from '../presentation/board_presentation_state.js';
import { BoardPresentationDataService } from '../presentation/board_presentation_data_service.js';
import { TrialBoardSemanticAdapter } from '../presentation/trial_board_semantic_adapter.js';
import { PlacementPreviewResolver } from '../presentation/placement_preview_resolver.js';
import { BoardPresentationGridComponent } from './board_presentation_grid_component.js';

/**
 * Browser compatibility subclass that wires the renderer-neutral board
 * presentation boundary into the existing UIController without moving layout
 * responsibilities into the presentation layer.
 */
export class BoardAwareUIController extends LegacyUIController {
    constructor(engine) {
        super(engine);
        this.trialInterceptionSemanticProvider = new TrialInterceptionSemanticProvider();
        this.boardPresentationState = new BoardPresentationState();
        this.layoutStateManager.bindBoardPresentationState(this.boardPresentationState);
        this.boardPresentationDataService = new BoardPresentationDataService();
        this.placementPreviewResolver = new PlacementPreviewResolver();
        this.preTrialBoardContextMode = null;
        if (typeof document !== 'undefined') {
            this.boardGridComponent = new BoardPresentationGridComponent(this);
        }
    }

    startTrialInterceptionPreview(scenario, options = {}) {
        this.preTrialBoardContextMode = this.boardPresentationState.contextMode;
        this.boardPresentationState.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
        return super.startTrialInterceptionPreview(scenario, options);
    }

    stopTrialInterceptionPreview() {
        if (this.preTrialBoardContextMode) {
            this.boardPresentationState.setContextMode(this.preTrialBoardContextMode);
        }
        this.preTrialBoardContextMode = null;
        return super.stopTrialInterceptionPreview();
    }

    getBoardPresentationSnapshot() {
        return this.boardPresentationState.snapshot();
    }

    setBoardViewMode(mode) {
        const snapshot = this.boardPresentationState.setViewMode(mode);
        this.trialPresentationState?.setMode?.(snapshot.viewMode);
        this.layoutStateManager.applyContract();
        return snapshot;
    }

    toggleBoardViewMode() {
        const snapshot = this.boardPresentationState.toggleViewMode();
        this.trialPresentationState?.setMode?.(snapshot.viewMode);
        this.layoutStateManager.applyContract();
        return snapshot;
    }

    setBoardContextMode(mode) {
        const snapshot = this.boardPresentationState.setContextMode(mode);
        this.layoutStateManager.applyContract();
        return snapshot;
    }

    toggleBoardContextMode() {
        const snapshot = this.boardPresentationState.toggleContextMode();
        this.layoutStateManager.applyContract();
        return snapshot;
    }

    getTrialBoardSemanticData() {
        const grid = this.getBoardDisplayGrid();
        const rows = Array.isArray(grid) ? grid.length : 0;
        const columns = rows > 0
            ? grid.reduce((max, row) => Math.max(max, row?.length || 0), 0)
            : 0;
        const activeRoute = this.getActiveTrialRoute();

        const interceptionCandidates = this.trialPreviewConfig
            ? this.trialInterceptionSemanticProvider.collect({
                displayGrid: grid,
                activeRoute,
                trialPresentationState: this.trialPresentationState,
                previewResolver: input => this.trialController.previewInterception(input)
            })
            : [];

        return TrialBoardSemanticAdapter.fromRuntime({
            trialState: this.trialPreviewConfig ? this.trialController.state : null,
            trialPresentationState: this.trialPresentationState,
            boardSize: { rows, columns },
            interceptionCandidates
        });
    }

    getPlacementPreviewPresentationData() {
        if (this.boardPresentationState.contextMode === BOARD_CONTEXT_MODES.TRIAL) {
            return Object.freeze({ active: false, candidates: Object.freeze([]), hover: null });
        }
        if (!this.selectedCard || this.state?.hasPickedThisTurn) {
            return Object.freeze({ active: false, candidates: Object.freeze([]), hover: null });
        }

        const hovered = this.boardPresentationState.hoveredCell;
        const candidates = this.placementPreviewResolver.resolveCandidates(this.selectedCard, this.state);
        const hover = hovered
            ? this.placementPreviewResolver.resolveHover(this.selectedCard, this.state, hovered.r, hovered.c)
            : null;

        return Object.freeze({
            active: true,
            candidates,
            hover
        });
    }

    getBoardPresentationData() {
        const board = this.boardPresentationDataService.getBoard(this.state, {
            presentationState: this.boardPresentationState,
            trialSemanticData: this.getTrialBoardSemanticData(),
            gridOverride: this.getBoardDisplayGrid()
        });
        return Object.freeze({
            ...board,
            placementPreview: this.getPlacementPreviewPresentationData()
        });
    }

    createTrialPreviewInput(r, c) {
        return this.trialInterceptionSemanticProvider.createPreviewInput({
            r,
            c,
            displayGrid: this.getBoardDisplayGrid(),
            activeRoute: this.getActiveTrialRoute(),
            trialPresentationState: this.trialPresentationState
        });
    }

    getTrialInterceptionCellState(r, c) {
        if (!this.trialPreviewConfig) return null;
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            return null;
        }
        return this.trialInterceptionSemanticProvider.getCellState({
            r,
            c,
            displayGrid: this.getBoardDisplayGrid(),
            activeRoute: this.getActiveTrialRoute(),
            trialPresentationState: this.trialPresentationState,
            previewResolver: input => this.trialController.previewInterception(input)
        });
    }

    getTrialRouteVisualState(r, c) {
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            return null;
        }
        const cell = this.getBoardPresentationData()?.cells?.[r]?.[c] || null;
        return cell?.trial?.route || null;
    }

    selectTrialInterceptionCell(r, c) {
        // Trial selection/hover belongs to TrialPresentationState. Do not mirror it
        // into BoardPresentationState or normal board selection would be lost when
        // Trial ends.
        return super.selectTrialInterceptionCell(r, c);
    }

    onCellClick(r, c) {
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            this.boardPresentationState.focusOnCell({ r, c });
        }
        return super.onCellClick(r, c);
    }

    onCellMouseEnter(e, r, c) {
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            this.boardPresentationState.hoverCell({ r, c });
        }
        return super.onCellMouseEnter(e, r, c);
    }

    clearCellPreviews() {
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            this.boardPresentationState.clearHover();
        }
        return super.clearCellPreviews();
    }
}

export default BoardAwareUIController;
