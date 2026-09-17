import {
    WARNING_STATES,
    canAdvanceWarningState,
    getWarningStateRank,
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
        this.listeners = new Set();
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

    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("WARNING_STATE_LISTENER_REQUIRED");
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    _notify(transition) {
        const snapshot = Object.freeze(cloneData(transition));
        this.listeners.forEach(listener => listener(snapshot));
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
        const transition = Object.freeze({
            revision: this.revision,
            previous,
            current: nextState,
            source: source || null,
            verse: Number.isInteger(verse) ? verse : null
        });
        this.history.push(transition);
        this._notify(transition);
        return { changed: true, readModel: this.getReadModel() };
    }

    advanceAtLeast(minimumState, context = {}) {
        if (!isWarningState(minimumState)) {
            throw new TypeError("WARNING_STATE_TARGET_INVALID");
        }
        if (getWarningStateRank(this.state) >= getWarningStateRank(minimumState)) {
            return { changed: false, readModel: this.getReadModel() };
        }
        return this.advanceTo(minimumState, context);
    }

    markOmen(context = {}) {
        return this.advanceAtLeast(WARNING_STATES.OMEN, context);
    }

    markWatch(context = {}) {
        return this.advanceAtLeast(WARNING_STATES.WATCH, context);
    }

    markTense(context = {}) {
        return this.advanceAtLeast(WARNING_STATES.TENSE, context);
    }

    markImminent(context = {}) {
        return this.advanceAtLeast(WARNING_STATES.IMMINENT, context);
    }

    resetForNextTrial({ source = "TRIAL_SETTLED", verse = null } = {}) {
        const previous = this.state;
        this.state = WARNING_STATES.CALM;
        this.revision += 1;
        const transition = Object.freeze({
            revision: this.revision,
            previous,
            current: WARNING_STATES.CALM,
            source,
            verse: Number.isInteger(verse) ? verse : null
        });
        this.history.push(transition);
        this._notify(transition);
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
