import {
    BoardPresentationState,
    BOARD_VIEW_MODES,
    BOARD_CONTEXT_MODES
} from "../presentation/board_presentation_state.js";
import { BoardRendererBridge } from "../presentation/board_renderer_bridge.js";
import {
    BOARD_INPUT_COMMANDS,
    parseBoardInputCommand
} from "../presentation/board_input_contract.js";

const LIVE_TRIAL_BLOCKED_COMMANDS = new Set([
    BOARD_INPUT_COMMANDS.SELECT_CELL,
    BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
    BOARD_INPUT_COMMANDS.CLEAR_SELECTION,
    BOARD_INPUT_COMMANDS.HOVER_CELL,
    BOARD_INPUT_COMMANDS.CLEAR_HOVER,
    BOARD_INPUT_COMMANDS.FOCUS_CELL,
    BOARD_INPUT_COMMANDS.CLEAR_FOCUS
]);

const ROUTE_SCOPED_TRIAL_COMMANDS = new Set([
    BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
    BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION
]);

function failure(command, reason) {
    return Object.freeze({ success: false, type: command.type, reason });
}

/**
 * Browser-only bridge between renderer-neutral BoardPresentationState and
 * screen-space LayoutStateManager.
 *
 * Ownership stays separated:
 * - BoardPresentationState owns viewMode/contextMode/board selection semantics.
 * - LayoutStateManager only projects those values into DOM layout attributes.
 */
export function attachBoardPresentationRuntime(uiController, {
    presentationState = null
} = {}) {
    if (!uiController) return null;
    if (uiController.boardPresentationRuntimeBridge) {
        return uiController.boardPresentationRuntimeBridge;
    }

    const state = presentationState || uiController.boardPresentationState || new BoardPresentationState();
    uiController.boardPresentationState = state;
    uiController.layoutStateManager?.bindBoardPresentationState?.(state);

    const rendererBridge = new BoardRendererBridge({
        presentationState: state,
        inputHandlers: {
            primaryCellAction: ({ cell }) => {
                if (!cell || typeof uiController.performPrimaryCellAction !== "function") return false;
                return uiController.performPrimaryCellAction(cell.r, cell.c);
            },
            selectTrialRoute: ({ routeId }) => {
                if (!routeId) return false;
                return uiController.selectTrialRoute?.(routeId) ?? false;
            },
            selectTrialInterception: ({ cell }) => {
                if (!cell) return false;
                return uiController.selectTrialInterceptionCell?.(cell.r, cell.c) ?? false;
            },
            hoverTrialInterception: ({ cell }) => {
                if (!cell) return false;
                return uiController.updateTrialInterceptionPreview?.(cell.r, cell.c) ?? false;
            },
            clearTrialHover: () => {
                uiController.trialPresentationState?.clearHoveredCell?.();
                return uiController.refreshTrialInterceptionPreview?.() ?? true;
            }
        }
    });

    const bridge = {
        rendererBridge,
        state,
        sync() {
            uiController.layoutStateManager?.applyContract?.();
            uiController.trialRouteBoardSelectionBridge?.sync?.();
            return state.snapshot();
        },
        setViewMode(mode) {
            state.setViewMode(mode);
            return this.sync();
        },
        toggleViewMode() {
            state.toggleViewMode();
            return this.sync();
        },
        setContextMode(mode) {
            state.setContextMode(mode);
            return this.sync();
        },
        toggleContextMode() {
            state.toggleContextMode();
            return this.sync();
        },
        dispatchInput(input) {
            const command = parseBoardInputCommand(input);
            const liveTrial = Boolean(uiController.isTrialInteractionActive?.());

            if (liveTrial && LIVE_TRIAL_BLOCKED_COMMANDS.has(command.type)) {
                return failure(command, "LIVE_TRIAL_REQUIRES_TRIAL_COMMAND");
            }

            const isTrialCommand = command.type === BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE
                || ROUTE_SCOPED_TRIAL_COMMANDS.has(command.type)
                || command.type === BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER;

            if (isTrialCommand && !liveTrial) {
                if (command.type === BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER) {
                    return Object.freeze({
                        success: true,
                        type: command.type,
                        result: null
                    });
                }
                return failure(command, "TRIAL_INTERACTION_INACTIVE");
            }

            if (ROUTE_SCOPED_TRIAL_COMMANDS.has(command.type)) {
                const activeRoute = uiController.getActiveTrialRoute?.() || null;
                const activeRouteId = activeRoute?.id
                    ?? activeRoute?.routeId
                    ?? uiController.trialPresentationState?.activeEnemyRoute
                    ?? null;
                if (!activeRouteId || command.payload.routeId !== activeRouteId) {
                    return failure(command, "TRIAL_ROUTE_NOT_ACTIVE");
                }
            }

            const result = rendererBridge.dispatch(command);
            this.sync();
            return result;
        }
    };

    uiController.boardPresentationRuntimeBridge = bridge;
    uiController.setBoardViewMode = mode => bridge.setViewMode(mode);
    uiController.toggleBoardViewMode = () => bridge.toggleViewMode();
    uiController.setBoardContextMode = mode => bridge.setContextMode(mode);
    uiController.toggleBoardContextMode = () => bridge.toggleContextMode();

    const baseStartTrial = uiController.startTrialInterceptionPreview;
    if (typeof baseStartTrial === "function") {
        const boundStartTrial = baseStartTrial.bind(uiController);
        uiController.startTrialInterceptionPreview = (...args) => {
            state.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
            bridge.sync();
            return boundStartTrial(...args);
        };
    }

    const baseStopTrial = uiController.stopTrialInterceptionPreview;
    if (typeof baseStopTrial === "function") {
        const boundStopTrial = baseStopTrial.bind(uiController);
        uiController.stopTrialInterceptionPreview = (...args) => {
            const result = boundStopTrial(...args);
            state.setContextMode(BOARD_CONTEXT_MODES.NORMAL);
            bridge.sync();
            return result;
        };
    }

    // Keep default browser composition explicit without making Layout its owner.
    if (!state.viewMode) state.setViewMode(BOARD_VIEW_MODES.STRATEGIC_2D);
    bridge.sync();
    return bridge;
}

export default attachBoardPresentationRuntime;