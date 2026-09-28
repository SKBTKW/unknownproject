export const GLOBAL_EVENT_PRESENTATION_STATES = Object.freeze({
    CLOSED: "CLOSED",
    PRESENTING: "PRESENTING",
    AWAITING_INPUT: "AWAITING_INPUT",
    RESOLUTION: "RESOLUTION"
});

const VALID_STATES = new Set(Object.values(GLOBAL_EVENT_PRESENTATION_STATES));

export class GlobalEventPresentationRuntimeState {
    constructor() {
        this.state = GLOBAL_EVENT_PRESENTATION_STATES.CLOSED;
        this.advisorActive = false;
        this.interactionLocked = false;
        this.activePresentationKey = null;
        this.lastDismissedPresentationKey = null;
    }

    open(presentationKey) {
        if (!presentationKey) return false;
        this.state = GLOBAL_EVENT_PRESENTATION_STATES.PRESENTING;
        this.activePresentationKey = presentationKey;
        this.interactionLocked = true;
        this.state = GLOBAL_EVENT_PRESENTATION_STATES.AWAITING_INPUT;
        return true;
    }

    beginResolution() {
        if (this.state === GLOBAL_EVENT_PRESENTATION_STATES.CLOSED) return false;
        this.state = GLOBAL_EVENT_PRESENTATION_STATES.RESOLUTION;
        this.interactionLocked = true;
        return true;
    }

    close() {
        if (this.activePresentationKey) {
            this.lastDismissedPresentationKey = this.activePresentationKey;
        }
        this.state = GLOBAL_EVENT_PRESENTATION_STATES.CLOSED;
        this.activePresentationKey = null;
        this.interactionLocked = false;
        return true;
    }

    setAdvisorActive(active) {
        this.advisorActive = active === true;
        return this.advisorActive;
    }

    setInteractionLocked(locked) {
        this.interactionLocked = locked === true;
        return this.interactionLocked;
    }

    isOpen() {
        return this.state !== GLOBAL_EVENT_PRESENTATION_STATES.CLOSED;
    }

    isInteractionLocked() {
        return this.interactionLocked === true;
    }

    restore(snapshot = {}) {
        if (VALID_STATES.has(snapshot.state)) this.state = snapshot.state;
        this.advisorActive = snapshot.advisorActive === true;
        this.interactionLocked = snapshot.interactionLocked === true;
        this.activePresentationKey = snapshot.activePresentationKey || null;
        this.lastDismissedPresentationKey = snapshot.lastDismissedPresentationKey || null;
        return this.snapshot();
    }

    snapshot() {
        return Object.freeze({
            state: this.state,
            advisorActive: this.advisorActive,
            interactionLocked: this.interactionLocked,
            activePresentationKey: this.activePresentationKey,
            lastDismissedPresentationKey: this.lastDismissedPresentationKey
        });
    }
}

export default GlobalEventPresentationRuntimeState;
