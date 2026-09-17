import { GAME_FACT_TYPES } from "../../core/game_fact.js";

export const POST_TRIAL_TRANSITION_STATUS = Object.freeze({
    WAITING_FOR_PRESENTATION_CLEANUP: "WAITING_FOR_PRESENTATION_CLEANUP",
    PENDING_STEPS: "PENDING_STEPS",
    COMPLETED: "COMPLETED"
});

export const POST_TRIAL_STEP_TYPES = Object.freeze({
    STAGE_ADVANCE: "STAGE_ADVANCE"
});

export const POST_TRIAL_STEP_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPLIED: "APPLIED"
});

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function normalizeTrialIndex(value) {
    const normalized = Math.floor(Number(value));
    return Number.isInteger(normalized) && normalized >= 1 ? normalized : null;
}

function createTransitionId({ trialIndex, scenarioId = null } = {}) {
    return `POST_TRIAL_${trialIndex}_${scenarioId || "UNKNOWN"}`;
}

/**
 * Run-level authority beginning at TRIAL_RESULT_SETTLED.
 *
 * This service owns which post-Trial work remains before normal progression may
 * resume. It does not calculate Trial results and it does not own presentation.
 * Stage progression remains delegated to TrialStageProgressionService.
 */
export class PostTrialProgressionService {
    constructor(engine, {
        gameFactHub = null,
        stageProgressionService = null
    } = {}) {
        if (!engine?.state) throw new TypeError("POST_TRIAL_PROGRESSION_ENGINE_REQUIRED");
        const factHub = gameFactHub || engine.gameFactHub || null;
        if (!factHub || typeof factHub.subscribe !== "function") {
            throw new TypeError("POST_TRIAL_PROGRESSION_FACT_HUB_REQUIRED");
        }

        this.engine = engine;
        this.gameFactHub = factHub;
        this.stageProgressionService = stageProgressionService
            || engine.trialStageProgressionService
            || null;
        this.unsubscribe = factHub.subscribe(fact => this._onFact(fact));

        this._restoreDelegatedStagePending();
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;
        this.createFromSettlement(fact.payload || {});
    }

    createFromSettlement(payload = {}) {
        const trialIndex = normalizeTrialIndex(payload.trialIndex);
        if (!trialIndex) {
            return { success: false, reason: "POST_TRIAL_TRIAL_INDEX_REQUIRED" };
        }

        const transitionId = createTransitionId({
            trialIndex,
            scenarioId: payload.scenarioId || null
        });
        const existing = this.engine.state.postTrialTransition || null;
        if (existing?.transitionId === transitionId) {
            return {
                success: true,
                alreadyCreated: true,
                transition: this.getTransition()
            };
        }
        if (existing && existing.status !== POST_TRIAL_TRANSITION_STATUS.COMPLETED) {
            return {
                success: false,
                reason: "POST_TRIAL_TRANSITION_ALREADY_ACTIVE",
                transition: this.getTransition()
            };
        }

        const stagePending = this.stageProgressionService?.getPending?.() || null;
        const steps = [];
        if (stagePending?.trialIndex === trialIndex) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: cloneData(stagePending)
            });
        }

        const transition = {
            schemaVersion: 1,
            transitionId,
            trialIndex,
            scenarioId: payload.scenarioId || null,
            outcome: payload.outcome || null,
            runTerminated: Boolean(payload.settlement?.runTerminated),
            presentationCleanupComplete: false,
            status: POST_TRIAL_TRANSITION_STATUS.WAITING_FOR_PRESENTATION_CLEANUP,
            steps
        };
        this.engine.state.postTrialTransition = transition;

        return {
            success: true,
            alreadyCreated: false,
            transition: this.getTransition()
        };
    }

    getTransition() {
        return cloneData(this.engine.state.postTrialTransition);
    }

    hasPendingWork() {
        const transition = this.engine.state.postTrialTransition;
        return Boolean(transition && transition.status !== POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    }

    canResumeNormalProgression() {
        const transition = this.engine.state.postTrialTransition;
        return !transition || transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED;
    }

    completeAfterPresentationCleanup({ translate = null } = {}) {
        const transition = this.engine.state.postTrialTransition;
        if (!transition) {
            return { success: false, reason: "POST_TRIAL_TRANSITION_NOT_FOUND" };
        }
        if (transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED) {
            return {
                success: true,
                alreadyCompleted: true,
                transition: this.getTransition(),
                stageProgression: null
            };
        }

        transition.presentationCleanupComplete = true;
        transition.status = POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS;

        let stageProgression = null;
        const stageStep = transition.steps.find(step =>
            step?.type === POST_TRIAL_STEP_TYPES.STAGE_ADVANCE
            && step.status === POST_TRIAL_STEP_STATUS.PENDING
        );
        if (stageStep) {
            const reconciled = this._reconcileAppliedStageStep(stageStep);
            if (!reconciled) {
                this._restoreDelegatedStagePending();
                if (!this.stageProgressionService?.getPending?.()) {
                    return {
                        success: false,
                        reason: "POST_TRIAL_STAGE_AUTHORITY_NOT_PENDING",
                        transition: this.getTransition()
                    };
                }

                stageProgression = this.stageProgressionService.applyPending({ translate });
                if (!stageProgression?.success) {
                    return {
                        success: false,
                        reason: stageProgression?.reason || "POST_TRIAL_STAGE_ADVANCE_FAILED",
                        stageProgression,
                        transition: this.getTransition()
                    };
                }
                stageStep.status = POST_TRIAL_STEP_STATUS.APPLIED;
                stageStep.result = cloneData(stageProgression);
            }
        }

        const hasPendingStep = transition.steps.some(step => step?.status === POST_TRIAL_STEP_STATUS.PENDING);
        if (!hasPendingStep) {
            transition.status = POST_TRIAL_TRANSITION_STATUS.COMPLETED;
        }

        return {
            success: true,
            alreadyCompleted: false,
            stageProgression,
            transition: this.getTransition()
        };
    }

    _reconcileAppliedStageStep(stageStep) {
        const toStageId = Number(stageStep?.payload?.toStageId) || null;
        const currentStageId = Number(this.engine.state?.stage?.id) || null;
        if (!toStageId || currentStageId !== toStageId) return false;

        stageStep.status = POST_TRIAL_STEP_STATUS.APPLIED;
        stageStep.result = stageStep.result || {
            success: true,
            stageId: toStageId,
            restoredAsAlreadyApplied: true
        };
        return true;
    }

    _restoreDelegatedStagePending() {
        const transition = this.engine.state.postTrialTransition;
        if (!transition || transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED) return;
        const stageStep = Array.isArray(transition.steps)
            ? transition.steps.find(step =>
                step?.type === POST_TRIAL_STEP_TYPES.STAGE_ADVANCE
                && step.status === POST_TRIAL_STEP_STATUS.PENDING
            )
            : null;
        if (!stageStep?.payload) return;
        if (this._reconcileAppliedStageStep(stageStep)) {
            const hasPendingStep = transition.steps.some(step => step?.status === POST_TRIAL_STEP_STATUS.PENDING);
            if (transition.presentationCleanupComplete && !hasPendingStep) {
                transition.status = POST_TRIAL_TRANSITION_STATUS.COMPLETED;
            }
            return;
        }
        if (this.stageProgressionService?.getPending?.()) return;
        this.stageProgressionService?.restorePending?.(stageStep.payload);
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default PostTrialProgressionService;
