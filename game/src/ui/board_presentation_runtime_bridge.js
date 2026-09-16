import {
    BoardPresentationState,
    BOARD_VIEW_MODES,
    BOARD_CONTEXT_MODES
} from "../presentation/board_presentation_state.js";

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

    const bridge = {
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