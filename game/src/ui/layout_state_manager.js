import {
    BOARD_VIEW_MODES,
    BOARD_CONTEXT_MODES,
    isBoardViewMode,
    isBoardContextMode
} from "../presentation/board_presentation_state.js";

export { BOARD_VIEW_MODES, BOARD_CONTEXT_MODES };

export const UI_LAYOUT_STATES = Object.freeze({
    NORMAL: "normal",
    HAND_EXPANDED: "hand-expanded",
    ADVISOR_EXPANDED: "advisor-expanded",
    ALERT: "alert",
    TRIAL: "trial"
});

export const RIGHT_CONTEXT_OWNERS = Object.freeze({
    NONE: "none",
    ADVISOR: "advisor",
    ALERT: "alert",
    TRIAL: "trial"
});

export const HAND_LAYOUT_STATES = Object.freeze({
    COLLAPSED: "collapsed",
    EXPANDED: "expanded",
    TRIAL_COLLAPSED: "trial-collapsed"
});

export const PLAYER_TRAY_MODES = Object.freeze({
    NORMAL: "normal",
    TRIAL: "trial"
});

const VALID_LAYOUT_STATES = new Set(Object.values(UI_LAYOUT_STATES));
const VALID_CONTEXT_OWNERS = new Set(Object.values(RIGHT_CONTEXT_OWNERS));

function toBoardViewDataset(mode) {
    return mode === BOARD_VIEW_MODES.WORLD_2_5D ? "quarter" : "top";
}

function toBoardContextDataset(mode) {
    return mode === BOARD_CONTEXT_MODES.TRIAL ? "trial" : "normal";
}

/**
 * Screen-space layout state only.
 *
 * Board view/context semantics are owned by BoardPresentationState. Layout only
 * consumes a bound presentation state and projects it to DOM dataset values so
 * CSS can decide where HUD regions sit and which layout rules apply.
 */
export class LayoutStateManager {
    constructor({ documentRef = typeof document !== "undefined" ? document : null } = {}) {
        this.documentRef = documentRef;
        this.state = UI_LAYOUT_STATES.NORMAL;
        this.contextOwner = RIGHT_CONTEXT_OWNERS.NONE;
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.boardPresentationState = null;
        this.adapters = {};
        this.applyRootState();
    }

    bindBoardPresentationState(presentationState) {
        if (!presentationState || typeof presentationState.snapshot !== "function") {
            throw new Error("BoardPresentationState with snapshot() is required.");
        }
        this.boardPresentationState = presentationState;
        this.applyContract();
        return this.boardPresentationState;
    }

    setAdapters(adapters = {}) {
        this.adapters = { ...adapters };
        this.applyContract();
    }

    getState() { return this.state; }
    getContextOwner() { return this.contextOwner; }
    getBoardViewMode() {
        return this.boardPresentationState?.viewMode ?? BOARD_VIEW_MODES.STRATEGIC_2D;
    }
    getBoardContextMode() {
        return this.boardPresentationState?.contextMode ?? BOARD_CONTEXT_MODES.NORMAL;
    }

    setState(nextState) {
        if (!VALID_LAYOUT_STATES.has(nextState)) throw new Error(`Unknown layout state: ${nextState}`);
        this.state = nextState;
        this.contextOwner = this.resolveDefaultOwner(nextState);
        this.applyContract();
        return this.state;
    }

    setContextOwner(nextOwner) {
        if (!VALID_CONTEXT_OWNERS.has(nextOwner)) throw new Error(`Unknown context owner: ${nextOwner}`);
        const allowedOwner = this.resolveAllowedOwner(nextOwner);
        this.contextOwner = allowedOwner;
        this.applyContract();
        return this.contextOwner;
    }

    /** @deprecated BoardPresentationState owns viewMode. Kept as a migration shim. */
    setBoardViewMode(nextMode) {
        if (!isBoardViewMode(nextMode)) throw new Error(`Unknown board view mode: ${nextMode}`);
        if (!this.boardPresentationState) throw new Error("BoardPresentationState is not bound.");
        this.boardPresentationState.setViewMode(nextMode);
        this.applyContract();
        return this.getBoardViewMode();
    }

    /** @deprecated BoardPresentationState owns contextMode. Kept as a migration shim. */
    setBoardContextMode(nextMode) {
        if (!isBoardContextMode(nextMode)) throw new Error(`Unknown board context mode: ${nextMode}`);
        if (!this.boardPresentationState) throw new Error("BoardPresentationState is not bound.");
        this.boardPresentationState.setContextMode(nextMode);
        this.applyContract();
        return this.getBoardContextMode();
    }

    openHand() {
        if (this.state === UI_LAYOUT_STATES.TRIAL || this.advisorReturnState === UI_LAYOUT_STATES.TRIAL) return false;
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.setState(UI_LAYOUT_STATES.HAND_EXPANDED);
        return true;
    }

    closeHand() {
        if (this.state !== UI_LAYOUT_STATES.HAND_EXPANDED) return false;
        this.setState(UI_LAYOUT_STATES.NORMAL);
        return true;
    }

    openAdvisor() {
        const returnState = this.state === UI_LAYOUT_STATES.TRIAL || this.state === UI_LAYOUT_STATES.ALERT
            ? this.state
            : UI_LAYOUT_STATES.NORMAL;
        this.advisorReturnState = returnState;
        this.setState(UI_LAYOUT_STATES.ADVISOR_EXPANDED);
        return true;
    }

    claimAdvisorContext() {
        if (this.state !== UI_LAYOUT_STATES.ADVISOR_EXPANDED) return false;
        this.setContextOwner(RIGHT_CONTEXT_OWNERS.ADVISOR);
        return true;
    }

    releaseAdvisorContext() {
        if (this.state !== UI_LAYOUT_STATES.ADVISOR_EXPANDED) return false;
        this.setContextOwner(RIGHT_CONTEXT_OWNERS.NONE);
        return true;
    }

    closeAdvisor() {
        if (this.state !== UI_LAYOUT_STATES.ADVISOR_EXPANDED) return false;
        const returnState = this.advisorReturnState;
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.setState(returnState);
        return true;
    }

    enterAlert() {
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.setState(UI_LAYOUT_STATES.ALERT);
    }

    enterTrial() {
        this.advisorReturnState = UI_LAYOUT_STATES.TRIAL;
        this.setState(UI_LAYOUT_STATES.TRIAL);
    }

    exitTrial() {
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.setState(UI_LAYOUT_STATES.NORMAL);
    }

    /** Restore layout only. BoardPresentationState is restored independently. */
    prepareRestoreView() {
        this.state = UI_LAYOUT_STATES.NORMAL;
        this.contextOwner = RIGHT_CONTEXT_OWNERS.NONE;
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.applyRootState();
    }

    resolveDefaultOwner(state) {
        if (state === UI_LAYOUT_STATES.TRIAL) return RIGHT_CONTEXT_OWNERS.TRIAL;
        if (state === UI_LAYOUT_STATES.ALERT) return RIGHT_CONTEXT_OWNERS.ALERT;
        return RIGHT_CONTEXT_OWNERS.NONE;
    }

    resolveAllowedOwner(owner) {
        if (this.state === UI_LAYOUT_STATES.TRIAL) return RIGHT_CONTEXT_OWNERS.TRIAL;
        if (this.state === UI_LAYOUT_STATES.ALERT) return RIGHT_CONTEXT_OWNERS.ALERT;
        if (this.state === UI_LAYOUT_STATES.ADVISOR_EXPANDED) {
            return owner === RIGHT_CONTEXT_OWNERS.ADVISOR ? owner : RIGHT_CONTEXT_OWNERS.NONE;
        }
        return RIGHT_CONTEXT_OWNERS.NONE;
    }

    getHandState() {
        if (this.state === UI_LAYOUT_STATES.HAND_EXPANDED) return HAND_LAYOUT_STATES.EXPANDED;
        if (this.state === UI_LAYOUT_STATES.TRIAL
            || (this.state === UI_LAYOUT_STATES.ADVISOR_EXPANDED && this.advisorReturnState === UI_LAYOUT_STATES.TRIAL)) {
            return HAND_LAYOUT_STATES.TRIAL_COLLAPSED;
        }
        return HAND_LAYOUT_STATES.COLLAPSED;
    }

    getPlayerTrayMode() {
        if (this.state === UI_LAYOUT_STATES.TRIAL
            || (this.state === UI_LAYOUT_STATES.ADVISOR_EXPANDED && this.advisorReturnState === UI_LAYOUT_STATES.TRIAL)) {
            return PLAYER_TRAY_MODES.TRIAL;
        }
        return PLAYER_TRAY_MODES.NORMAL;
    }

    applyContract() {
        const handState = this.getHandState();
        const playerTrayMode = this.getPlayerTrayMode();
        const boardViewMode = this.getBoardViewMode();
        const boardContextMode = this.getBoardContextMode();
        const advisorExpanded = this.state === UI_LAYOUT_STATES.ADVISOR_EXPANDED;
        const trialContextVisible = this.contextOwner === RIGHT_CONTEXT_OWNERS.TRIAL;
        this.applyRootState(handState, playerTrayMode, boardViewMode, boardContextMode);
        this.adapters.setHandState?.(handState);
        this.adapters.setPlayerTrayMode?.(playerTrayMode);
        this.adapters.setBoardViewMode?.(boardViewMode);
        this.adapters.setBoardContextMode?.(boardContextMode);
        this.adapters.setAdvisorExpanded?.(advisorExpanded);
        this.adapters.setTrialContextVisible?.(trialContextVisible);
        this.adapters.onChange?.({
            state: this.state,
            contextOwner: this.contextOwner,
            handState,
            playerTrayMode,
            boardViewMode,
            boardContextMode
        });
    }

    applyRootState(
        handState = this.getHandState(),
        playerTrayMode = this.getPlayerTrayMode(),
        boardViewMode = this.getBoardViewMode(),
        boardContextMode = this.getBoardContextMode()
    ) {
        const boardViewDataset = toBoardViewDataset(boardViewMode);
        const boardContextDataset = toBoardContextDataset(boardContextMode);
        const roots = [this.documentRef?.documentElement, this.documentRef?.body].filter(Boolean);
        roots.forEach(root => {
            if (!root.dataset) return;
            root.dataset.layoutState = this.state;
            root.dataset.contextOwner = this.contextOwner;
            root.dataset.handState = handState;
            root.dataset.playerTrayMode = playerTrayMode;
            root.dataset.boardView = boardViewDataset;
            root.dataset.boardContext = boardContextDataset;
        });
    }
}

export default LayoutStateManager;