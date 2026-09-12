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

export const BOARD_VIEW_MODES = Object.freeze({
    TOP: "top",
    QUARTER: "quarter"
});

const VALID_LAYOUT_STATES = new Set(Object.values(UI_LAYOUT_STATES));
const VALID_CONTEXT_OWNERS = new Set(Object.values(RIGHT_CONTEXT_OWNERS));
const VALID_BOARD_VIEW_MODES = new Set(Object.values(BOARD_VIEW_MODES));

export class LayoutStateManager {
    constructor({ documentRef = typeof document !== "undefined" ? document : null } = {}) {
        this.documentRef = documentRef;
        this.state = UI_LAYOUT_STATES.NORMAL;
        this.contextOwner = RIGHT_CONTEXT_OWNERS.NONE;
        this.advisorReturnState = UI_LAYOUT_STATES.NORMAL;
        this.boardViewMode = BOARD_VIEW_MODES.TOP;
        this.adapters = {};
        this.applyRootState();
    }

    setAdapters(adapters = {}) {
        this.adapters = { ...adapters };
        this.applyContract();
    }

    getState() { return this.state; }
    getContextOwner() { return this.contextOwner; }
    getBoardViewMode() { return this.boardViewMode; }

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

    setBoardViewMode(nextMode) {
        if (!VALID_BOARD_VIEW_MODES.has(nextMode)) throw new Error(`Unknown board view mode: ${nextMode}`);
        this.boardViewMode = nextMode;
        this.applyContract();
        return this.boardViewMode;
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

    /** Restore presentation reconciliation is followed by one canonical UI render. */
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
        const advisorExpanded = this.state === UI_LAYOUT_STATES.ADVISOR_EXPANDED;
        const trialContextVisible = this.contextOwner === RIGHT_CONTEXT_OWNERS.TRIAL;
        this.applyRootState(handState, playerTrayMode, boardViewMode);
        this.adapters.setHandState?.(handState);
        this.adapters.setPlayerTrayMode?.(playerTrayMode);
        this.adapters.setBoardViewMode?.(boardViewMode);
        this.adapters.setAdvisorExpanded?.(advisorExpanded);
        this.adapters.setTrialContextVisible?.(trialContextVisible);
        this.adapters.onChange?.({ state: this.state, contextOwner: this.contextOwner, handState, playerTrayMode, boardViewMode });
    }

    applyRootState(
        handState = this.getHandState(),
        playerTrayMode = this.getPlayerTrayMode(),
        boardViewMode = this.getBoardViewMode()
    ) {
        const roots = [this.documentRef?.documentElement, this.documentRef?.body].filter(Boolean);
        roots.forEach(root => {
            if (!root.dataset) return;
            root.dataset.layoutState = this.state;
            root.dataset.contextOwner = this.contextOwner;
            root.dataset.handState = handState;
            root.dataset.playerTrayMode = playerTrayMode;
            root.dataset.boardView = boardViewMode;
        });
    }
}

export default LayoutStateManager;