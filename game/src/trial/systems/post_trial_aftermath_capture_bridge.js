import { GAME_FACT_TYPES } from "../../core/game_fact.js";

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Captures the immutable settled Trial snapshot for downstream Post-Trial readers.
 *
 * This bridge does not calculate consequences. It runs after
 * PostTrialProgressionService has created state.postTrialTransition from the same
 * TRIAL_RESULT_SETTLED fact, then stores only the already-settled payload needed by
 * UI / Advisor / Ending consumers.
 */
export class PostTrialAftermathCaptureBridge {
    constructor({ gameFactHub, state } = {}) {
        if (!gameFactHub || typeof gameFactHub.subscribe !== "function") {
            throw new TypeError("POST_TRIAL_AFTERMATH_FACT_HUB_REQUIRED");
        }
        if (!state) {
            throw new TypeError("POST_TRIAL_AFTERMATH_STATE_REQUIRED");
        }
        this.gameFactHub = gameFactHub;
        this.state = state;
        this.unsubscribe = gameFactHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;
        const payload = fact.payload || {};
        const transition = this.state.postTrialTransition || null;
        if (!transition) return;

        const transitionTrialIndex = Number.isInteger(transition.trialIndex)
            ? transition.trialIndex
            : null;
        const payloadTrialIndex = Number.isInteger(payload.trialIndex)
            ? payload.trialIndex
            : null;
        if (transitionTrialIndex !== null && payloadTrialIndex !== null
            && transitionTrialIndex !== payloadTrialIndex) return;

        // First settled snapshot wins. Duplicate facts/retries must not mutate the
        // historical aftermath record after downstream consumers have read it.
        if (transition.aftermath) return;

        transition.aftermath = Object.freeze({
            trialIndex: payloadTrialIndex,
            scenarioId: payload.scenarioId || null,
            turn: Number.isInteger(payload.turn) ? payload.turn : null,
            outcome: payload.outcome || null,
            result: cloneData(payload.result),
            settlement: cloneData(payload.settlement)
        });
    }

    getSnapshot() {
        return cloneData(this.state.postTrialTransition?.aftermath);
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default PostTrialAftermathCaptureBridge;
