import { UIController as LegacyUIController } from './ui_controller.js?v=20260909_advisor2';
import { TrialInterceptionSemanticProvider } from '../trial/presentation/trial_interception_semantic_provider.js';
import {
    BoardPresentationState,
    BOARD_CONTEXT_MODES
} from '../presentation/board_presentation_state.js';
import { BoardPresentationDataService } from '../presentation/board_presentation_data_service.js';
import {
    BOARD_VISIBILITY,
    getBoardPresentationProfile
} from '../presentation/board_presentation_profile.js';
import { BoardPresentationRuntimeAdapter } from '../presentation/board_presentation_runtime_adapter.js';
import { TrialBoardSemanticAdapter } from '../presentation/trial_board_semantic_adapter.js';
import { PlacementPreviewResolver } from '../presentation/placement_preview_resolver.js';
import { BoardPresentationGridComponent } from './board_presentation_grid_component.js';
import { LegacyWeb2DBoardInputAdapter } from './legacy_web2d_board_input_adapter.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from '../presentation/board_input_contract.js';

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
        this.boardPresentationRuntimeAdapter = new BoardPresentationRuntimeAdapter({
            dataService: this.boardPresentationDataService
        });
        this.placementPreviewResolver = new PlacementPreviewResolver();
        this.legacyWeb2DBoardInputAdapter = new LegacyWeb2DBoardInputAdapter(this);
        this.preTrialBoardContextMode = null;
        if (typeof document !== 'undefined') {
            this.boardGridComponent = new BoardPresentationGridComponent(this);
        }
    }

    /**
     * Production-facing Trial session entry.
     *
     * The legacy UIController still exposes startTrialInterceptionPreview().
     * Keep that method as the compatibility implementation for now while new
     * runtime callers use this session-level name.
     */
    startTrialSession(scenario, options = {}) {
        this.preTrialBoardContextMode = this.boardPresentationState.contextMode;
        this.boardPresentationState.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
        return super.startTrialInterceptionPreview(scenario, options);
    }

    /** @deprecated Use startTrialSession(). */
    startTrialInterceptionPreview(scenario, options = {}) {
        return this.startTrialSession(scenario, options);
    }

    /**
     * Production-facing Trial session teardown.
     */
    stopTrialSession() {
        if (this.preTrialBoardContextMode) {
            this.boardPresentationState.setContextMode(this.preTrialBoardContextMode);
        }
        this.preTrialBoardContextMode = null;
        return super.stopTrialInterceptionPreview();
    }

    /** @deprecated Use stopTrialSession(). */
    stopTrialInterceptionPreview() {
        return this.stopTrialSession();
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

    shouldShowBoardDevelopmentHints() {
        const profile = getBoardPresentationProfile(
            this.boardPresentationState.contextMode,
            this.boardPresentationState.viewPreset
        );
        return profile.developmentHints !== BOARD_VISIBILITY.HIDDEN
            && profile.developmentHints !== BOARD_VISIBILITY.SUPPRESSED;
    }

    getPlacementPreviewPresentationData() {
        if (!this.shouldShowBoardDevelopmentHints()) {
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
        const board = this.boardPresentationRuntimeAdapter.getBoard(this.state, {
            presentationState: this.boardPresentationState,
            trialSemanticData: this.getTrialBoardSemanticData(),
            gridOverride: this.getBoardDisplayGrid(),
            interactionQuery: {
                isCellPlacedThisTurn: (r, c) => Boolean(
                    this.engine?.undoSystem?.isCellPlacedThisTurn?.(r, c)
                )
            }
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

    selectBoardPresentationCell(r, c) {
        return this.boardPresentationState.selectCell({ r, c });
    }

    performPrimaryCellAction(r, c) {
        if (this.boardPresentationState.contextMode !== BOARD_CONTEXT_MODES.TRIAL) {
            this.boardPresentationState.focusOnCell({ r, c });
        }
        return super.onCellClick(r, c);
    }

    onCellMouseMove(e, r, c) {
        if (this.boardPresentationState.contextMode === BOARD_CONTEXT_MODES.TRIAL) {
            return super.onCellMouseMove(e, r, c);
        }
        const cell = this.getBoardPresentationData()?.cells?.[r]?.[c] || null;
        return this.showBoardPresentationCellTooltip(e, r, c, cell);
    }

    showBoardPresentationCellTooltip(e, r, c, cell) {
        if (typeof document === "undefined") return;
        if (!cell) {
            this.hideCellTooltip();
            return;
        }

        if (this.selectedCard && !cell.placed) return;

        const previewModal = document.getElementById("cardHoverPreviewModal");
        if (previewModal && previewModal.classList.contains("active")) {
            this.hideCellTooltip();
            return;
        }

        const I18n = (typeof globalThis !== "undefined" && globalThis.I18n)
            ? globalThis.I18n
            : (typeof window !== "undefined" && window.I18n ? window.I18n : { t: k => k });

        const coordStr = `${String.fromCharCode(65 + c)}${r + 1}`;
        const isHQVic = Boolean(cell.influence?.hqVicinity);
        const waterSourceType = cell.influence?.waterSourceType || null;
        const hasIrrigationInfluence = Boolean(cell.influence?.waterSource);
        const isPlacedThisTurn = Boolean(cell.interaction?.placedThisTurn);

        let title = `[${coordStr}]`;
        let desc = isHQVic
            ? (I18n.t("UI_CELL_HQ_VICINITY_DESC"))
            : (I18n.t("UI_CELL_UNCLAIMED"));

        if (waterSourceType && !cell.placed) {
            const isOasis = waterSourceType === "OASIS";
            const waterTitle = I18n.t(isOasis ? "UI_OASIS_VICINITY_TITLE" : "UI_LAKE_VICINITY_TITLE");
            title = `[${coordStr}] ${waterTitle}`;
            const waterDesc = I18n
                ? I18n.t(isOasis ? "UI_OASIS_VICINITY_UNPLACED_DESC" : "UI_LAKE_VICINITY_UNPLACED_DESC")
                : "";
            desc = `${desc}<div style="margin-top:6px;">${waterDesc}</div>`;
        }

        if (cell.isHQ) {
            title = I18n ? I18n.t("UI_CELL_HQ_TITLE", { coord: coordStr }) : `🏛️ HQ [${coordStr}]`;
            desc = I18n ? I18n.t("UI_CELL_HQ_DESC") : "🌾+10 🧱+10 🛡️10 ✨+1";
        } else if (cell.hasSocket && !cell.placed) {
            title = I18n ? I18n.t("UI_CELL_SOCKET_TITLE", { coord: coordStr }) : `★ [${coordStr}]`;
            desc = I18n.t("UI_CELL_SOCKET_DESC");
        } else if (cell.placed && cell.terrainId) {
            const tName = I18n.t(cell.nameKey || cell.terrainId || "TERRAIN_PLAINS");
            const placedTag = isPlacedThisTurn
                ? ` <span style="font-size:12px; background:#e74c3c; color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:bold;">${I18n.t("UI_CELL_PLACED_TAG")}</span>`
                : "";
            title = `🌱 ${tName} [${coordStr}]${placedTag}`;

            const y = cell.yields || {};
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
                    : "💎";
                bonusParts.push(`${resIcon} : ${sName}`);

                const sid = s.id || s.nameKey || "";
                if (sid === "SOCKET_LAKE" || sid === "SOCKET_OASIS") {
                    sourceWaterDesc = I18n
                        ? I18n.t(sid === "SOCKET_OASIS" ? "UI_OASIS_SOURCE_DESC" : "UI_LAKE_SOURCE_DESC")
                        : "";
                }
            }

            if (Array.isArray(cell.modifiers)) {
                let hqVicinityReported = false;
                for (const mod of cell.modifiers) {
                    if (mod.type === "HQ_VICINITY" && !hqVicinityReported) {
                        bonusParts.push(I18n.t("UI_CELL_BONUS_VICINITY"));
                        hqVicinityReported = true;
                    } else if (mod.type === "IRRIGATION" || mod.type === "LAKE_IRRIGATION") {
                        if (waterSourceType === "OASIS") {
                            bonusParts.push(I18n.t("UI_CELL_BONUS_OASIS_IRRIGATION", { val: mod.amount }));
                        } else if (waterSourceType === "LAKE") {
                            bonusParts.push(I18n.t("UI_CELL_BONUS_LAKE_IRRIGATION", { val: mod.amount }));
                        } else {
                            bonusParts.push(`${I18n.t("CMD_IRRIGATION")}(+${mod.amount})`);
                        }
                    } else if (mod.type === "PERMANENT_PLAINS") {
                        bonusParts.push(I18n.t("UI_CELL_BONUS_PLAINS", { val: mod.amount }));
                    }
                }
            }

            const yieldParts = [];
            if (tf > 0) yieldParts.push(`🌾+${tf}`);
            if (tw > 0) yieldParts.push(`🧱+${tw}`);
            if (td > 0) yieldParts.push(`🛡️+${td}`);
            if (tm > 0) yieldParts.push(`✨+${tm}`);

            const yieldStr = yieldParts.length > 0
                ? yieldParts.join(" ")
                : (I18n.t("UI_CELL_YIELD_NONE"));
            const bonusStr = bonusParts.length > 0
                ? ` <span style="color:#f1c40f;">(${bonusParts.join(", ")})</span>`
                : "";
            const perTurnLabel = I18n.t("UI_CELL_PER_TURN_YIELD");
            desc = `${perTurnLabel} <strong>${yieldStr}</strong>${bonusStr}`;
            if (sourceWaterDesc) desc += sourceWaterDesc;

            const influenceNotes = [];
            if (waterSourceType) {
                influenceNotes.push(I18n ? I18n.t("TOOLTIP_INFLUENCE_LAKE") : "💧 Lake Influence");
            } else if (hasIrrigationInfluence) {
                influenceNotes.push(I18n ? `💧 ${I18n.t("CMD_IRRIGATION")}` : "💧 Irrigation");
            }
            if (isHQVic) {
                influenceNotes.push(I18n ? I18n.t("TOOLTIP_INFLUENCE_HQ") : "🏘 HQ Vicinity");
            }
            if (influenceNotes.length > 0) {
                desc += `<div class="tooltip-influence-note"><small>${influenceNotes.join("<br>")}</small></div>`;
            }

            if (isPlacedThisTurn) {
                const undoHint = I18n.t("UI_CELL_UNDO_HINT");
                desc += `
                    <div class="tooltip-undo-hint-box">
                        <span class="undo-icon">↩</span>
                        <span>${undoHint}</span>
                    </div>
                `;
            }
        }

        if (typeof window !== "undefined"
            && window.tooltipSystemInstance
            && typeof window.tooltipSystemInstance.showCustom === "function") {
            const clientX = e ? (e.clientX !== undefined ? e.clientX : (e.pageX || 0)) : 0;
            const clientY = e ? (e.clientY !== undefined ? e.clientY : (e.pageY || 0)) : 0;
            window.tooltipSystemInstance.showCustom(clientX, clientY, title, desc);
        }
    }

    onCellClick(r, c) {
        if (this.boardPresentationState.contextMode === BOARD_CONTEXT_MODES.TRIAL) {
            const activeRoute = this.getActiveTrialRoute?.() || null;
            const routeId = activeRoute?.id ?? activeRoute?.routeId ?? null;
            if (!routeId) return super.onCellClick(r, c);
            const response = this.legacyWeb2DBoardInputAdapter.dispatch(
                createBoardInputCommand(
                    BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
                    { routeId, cell: { r, c } }
                )
            );
            return response.success ? response.result : false;
        }

        const response = this.legacyWeb2DBoardInputAdapter.dispatch(
            createBoardInputCommand(
                BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
                { cell: { r, c } }
            )
        );
        return response.success ? response.result : false;
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
