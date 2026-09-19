const STAGE_ADVANCE_STEP_TYPE = "STAGE_ADVANCE";

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function cloneFrozen(value) {
    return Object.freeze(cloneData(value, {}));
}

/**
 * Read-only projection for Run-level Post-Trial progression.
 *
 * UI / Advisor / Ending consumers should read this boundary instead of depending
 * on engine.state.postTrialTransition or PostTrialProgressionService internals.
 * Mutation remains exclusively owned by the progression/step authorities.
 */
export class PostTrialProgressionReadService {
    constructor(source) {
        if (!source
            || typeof source.getTransition !== "function"
            || typeof source.getCurrentPendingStep !== "function"
            || typeof source.getPendingSteps !== "function"
            || typeof source.canResumeNormalProgression !== "function") {
            throw new TypeError("POST_TRIAL_READ_SOURCE_REQUIRED");
        }
        this.source = source;
    }

    read() {
        const transition = this.source.getTransition();
        if (!transition) {
            return cloneFrozen({
                available: false,
                transitionId: null,
                trialIndex: null,
                scenarioId: null,
                status: null,
                presentationCleanupComplete: false,
                currentStep: null,
                pendingStepTypes: [],
                stepTypes: [],
                stageAdvance: null,
                aftermath: null,
                runTerminated: false,
                canResumeNormalProgression: true
            });
        }

        const steps = Array.isArray(transition.steps) ? transition.steps : [];
        const currentStep = this.source.getCurrentPendingStep();
        const pendingStepTypes = this.source.getPendingSteps()
            .map(step => step?.type)
            .filter(type => typeof type === "string" && type.length > 0);
        const stepTypes = steps
            .map(step => step?.type)
            .filter(type => typeof type === "string" && type.length > 0);
        const stageStep = steps.find(step => step?.type === STAGE_ADVANCE_STEP_TYPE) || null;

        return cloneFrozen({
            available: true,
            transitionId: transition.transitionId || null,
            trialIndex: Number.isInteger(Number(transition.trialIndex))
                ? Number(transition.trialIndex)
                : null,
            scenarioId: transition.scenarioId || null,
            status: transition.status || null,
            presentationCleanupComplete: Boolean(transition.presentationCleanupComplete),
            currentStep: currentStep
                ? {
                    type: currentStep.type || null,
                    status: currentStep.status || null,
                    payload: cloneData(currentStep.payload)
                }
                : null,
            pendingStepTypes,
            stepTypes,
            stageAdvance: stageStep
                ? {
                    status: stageStep.status || null,
                    payload: cloneData(stageStep.payload)
                }
                : null,
            aftermath: cloneData(transition.aftermath),
            runTerminated: Boolean(transition.runTerminated),
            canResumeNormalProgression: Boolean(this.source.canResumeNormalProgression())
        });
    }
}

export default PostTrialProgressionReadService;
