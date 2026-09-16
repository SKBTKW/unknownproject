import {
    WARNING_STATES,
    canAdvanceWarningState,
    isWarningState
} from "../domain/warning_state.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Player-facing semantic warning state.
 *
 * This service never stores or returns exact remaining Verse counts. A separate
 * policy/bridge may decide when the state should advance based on authoritative
 * simulation data, but callers only observe CALM/OMEN/WATCH/TENSE/IMMINENT.
 */
export class WarningStateService {
    constructor({ initialState = WARNING_STATES.CALM } = {}) {
        if (!isWarningState(initialState)) {
            throw new TypeError("WARNING_STATE_INITIAL_INVALID");
        }
        this.state = initialState;
        this.revision = 0;
        this.history = [];
    }

    getState() {
        return this.state;
    }

    getReadModel() {
        return {
            state: this.state,
            revision: this.revision,
            history: cloneData(this.history) || []
        };
    }

    advanceTo(nextState, { source = null, verse = null } = {}) {
        if (!isWarningState(nextState)) {
            throw new TypeError("WARNING_STATE_TARGET_INVALID");
        }
        if (!canAdvanceWarningState(this.state, nextState)) {
            throw new Error("WARNING_STATE_REGRESSION_FORBIDDEN");
        }
        if (nextState === this.state) {
            return { changed: false, readModel: this.getReadModel() };
        }

        const previous = this.state;
        this.state = nextState;
        this.revision += 1;
        this.history.push(Object.freeze({
            revision: this.revision,
            previous,
            current: nextState,
            source: source || null,
            verse: Number.isInteger(verse) ? verse : null
        }));
        return { changed: true, readModel: this.getReadModel() };
    }

    markOmen(context = {}) {
        return this.advanceTo(WARNING_STATES.OMEN, context);
    }

    markWatch(context = {}) {
        return this.advanceTo(WARNING_STATES.WATCH, context);
    }

    markTense(context = {}) {
        return this.advanceTo(WARNING_STATES.TENSE, context);
    }

    markImminent(context = {}) {
        return this.advanceTo(WARNING_STATES.IMMINENT, context);
    }

    resetForNextTrial({ source = "TRIAL_SETTLED", verse = null } = {}) {
        const previous = this.state;
        this.state = WARNING_STATES.CALM;
        this.revision += 1;
        this.history.push(Object.freeze({
            revision: this.revision,
            previous,
            current: WARNING_STATES.CALM,
            source,
            verse: Number.isInteger(verse) ? verse : null
        }));
        return this.getReadModel();
    }

    getRestoreState() {
        return cloneData(this.getReadModel());
    }

    restoreState(snapshot) {
        if (!snapshot || typeof snapshot !== "object" || !isWarningState(snapshot.state)) {
            throw new TypeError("WARNING_STATE_RESTORE_INVALID");
        }
        this.state = snapshot.state;
        this.revision = Math.max(0, Math.floor(Number(snapshot.revision) || 0));
        this.history = Array.isArray(snapshot.history)
            ? snapshot.history.map(item => Object.freeze(cloneData(item)))
            : [];
        return this.getRestoreState();
    }
}

export default WarningStateService;
