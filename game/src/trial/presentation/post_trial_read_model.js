function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

/**
 * Mutation-free consumer boundary for Post-Trial state.
 *
 * UI / Advisor / Ending consumers should prefer this model over reading
 * state.postTrialTransition directly. The transition remains the persisted SSOT;
 * this class only projects a stable subset for presentation and interpretation.
 */
export class PostTrialReadModel {
    constructor({ state, progressionService = null } = {}) {
        if (!state) throw new TypeError("POST_TRIAL_READ_MODEL_STATE_REQUIRED");
        this.state = state;
        this.progressionService = progressionService;
    }

    read() {
        const transition = this.state.postTrialTransition || null;
        if (!transition) {
            return Object.freeze({
                active: false,
                transitionId: null,
                trialIndex: null,
                scenarioId: null,
                status: null,
                runTerminated: false,
                presentationCleanupComplete: false,
                currentStep: null,
                aftermath: null,
                canResumeNormalProgression: true
            });
        }

        const currentStep = this.progressionService?.getCurrentPendingStep?.()
            || (Array.isArray(transition.steps)
                ? transition.steps.find(step => step?.status === "PENDING") || null
                : null);
        const canResumeNormalProgression = typeof this.progressionService?.canResumeNormalProgression === "function"
            ? this.progressionService.canResumeNormalProgression()
            : transition.status === "COMPLETED";

        return Object.freeze({
            active: true,
            transitionId: transition.transitionId || null,
            trialIndex: Number.isInteger(transition.trialIndex) ? transition.trialIndex : null,
            scenarioId: transition.scenarioId || null,
            status: transition.status || null,
            runTerminated: Boolean(transition.runTerminated),
            presentationCleanupComplete: Boolean(transition.presentationCleanupComplete),
            currentStep: cloneData(currentStep),
            aftermath: cloneData(transition.aftermath),
            canResumeNormalProgression: Boolean(canResumeNormalProgression)
        });
    }
}

export default PostTrialReadModel;
