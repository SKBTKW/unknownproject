import { TRIAL_PHASES } from "../domain/trial_types.js";

const NEXT_PHASE = Object.freeze({
    [TRIAL_PHASES.SETUP]: TRIAL_PHASES.DEPLOYMENT,
    [TRIAL_PHASES.DEPLOYMENT]: TRIAL_PHASES.BATTLE,
    [TRIAL_PHASES.BATTLE]: TRIAL_PHASES.RESULT
});

export class TrialFlow {
    advance(state) {
        const next = NEXT_PHASE[state.phase];
        if (!next) return state.phase;
        state.phase = next;
        return state.phase;
    }

    moveTo(state, phase) {
        if (NEXT_PHASE[state.phase] !== phase) {
            throw new Error(`INVALID_TRIAL_PHASE_TRANSITION:${state.phase}->${phase}`);
        }
        state.phase = phase;
        return state.phase;
    }
}

