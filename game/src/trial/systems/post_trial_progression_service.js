import { GAME_FACT_TYPES } from "../../core/game_fact.js";

export const POST_TRIAL_TRANSITION_STATUS = Object.freeze({
    WAITING_FOR_PRESENTATION_CLEANUP: "WAITING_FOR_PRESENTATION_CLEANUP",
    PENDING_STEPS: "PENDING_STEPS",
    COMPLETED: "COMPLETED"
});

export const POST_TRIAL_STEP_TYPES = Object.freeze({
    REWARD_SELECTION: "REWARD_SELECTION",
    UNLOCK_APPLY: "UNLOCK_APPLY",
    STAGE_ADVANCE: "STAGE_ADVANCE",
    ADVISOR_PROGRESSION: "ADVISOR_PROGRESSION",
    FINAL_RUN_COMPLETION: "FINAL_RUN_COMPLETION"
});

export const POST_TRIAL_STEP_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPLIED: "APPLIED"
});

export const POST_TRIAL_STEP_ORDER = Object.freeze([
    POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
    POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
    POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
    POST_TRIAL_STEP_TYPES.ADVISOR_PROGRESSION,
    POST_TRIAL_STEP_TYPES.FINAL_RUN_COMPLETION
]);

const STEP_ORDER_INDEX = new Map(
    POST_TRIAL_STEP_ORDER.map((type, index) => [type, index])
);

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

function normalizePolicyPayload(value) {
    if (value === null || value === undefined || value === false) return null;
    if (value === true) return {};
    return cloneData(value);
}

/**
 * Run-level authority beginning at TRIAL_RESULT_SETTLED.
 *
 * This service owns the ordered post-Trial transition only. Reward, Unlock and
 * Advisor content remain external policy/authority concerns. Stage progression
 * remains delegated to TrialStageProgressionService, and physical grid expansion
 * is never allowed before Trial presentation cleanup is complete.
 *
 * Canonical semantic order:
 * Reward -> Unlock -> Stage -> Advisor -> Final Run Completion.
 */
export class PostTrialProgressionService {
    constructor(engine, {
        gameFactHub = null,
        stageProgressionService = null,
        rewardStepPolicy = null,
        advisorProgressionStepPolicy = null,
        unlockStepPolicy = null
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
        this.rewardStepPolicy = rewardStepPolicy || engine.postTrialRewardStepPolicy || null;
        this.advisorProgressionStepPolicy = advisorProgressionStepPolicy
            || engine.postTrialAdvisorProgressionStepPolicy
            || null;
        this.unlockStepPolicy = unlockStepPolicy || engine.postTrialUnlockStepPolicy || null;

        if (this.rewardStepPolicy && typeof this.rewardStepPolicy !== "function") {
            throw new TypeError("POST_TRIAL_REWARD_POLICY_INVALID");
        }
        if (this.advisorProgressionStepPolicy && typeof this.advisorProgressionStepPolicy !== "function") {
            throw new TypeError("POST_TRIAL_ADVISOR_PROGRESSION_POLICY_INVALID");
        }
        if (this.unlockStepPolicy && typeof this.unlockStepPolicy !== "function") {
            throw new TypeError("POST_TRIAL_UNLOCK_POLICY_INVALID");
        }

        this.unsubscribe = factHub.subscribe(fact => this._onFact(fact));
        this._normalizeRestoredStepOrder();
        this._restoreDelegatedStagePending();
        this._reconcileRestoredTransitionStatus();
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

        const context = {
            trialIndex,
            scenarioId: payload.scenarioId || null,
            outcome: payload.outcome || null,
            runTerminated: Boolean(payload.settlement?.runTerminated),
            settlement: cloneData(payload.settlement),
            state: this.engine.state
        };
        const rewardPayload = this._resolvePolicyPayload(this.rewardStepPolicy, context);
        const unlockPayload = this._resolvePolicyPayload(this.unlockStepPolicy, context);
        const advisorProgressionPayload = this._resolvePolicyPayload(
            this.advisorProgressionStepPolicy,
            context
        );
        const stagePending = this.stageProgressionService?.getPending?.() || null;
        const steps = [];

        if (rewardPayload !== null) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: rewardPayload
            });
        }
        if (unlockPayload !== null) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: unlockPayload
            });
        }
        if (stagePending?.trialIndex === trialIndex) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: cloneData(stagePending)
            });
        }
        if (advisorProgressionPayload !== null) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.ADVISOR_PROGRESSION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: advisorProgressionPayload
            });
        }
        if (trialIndex === 3 && !context.runTerminated) {
            steps.push({
                type: POST_TRIAL_STEP_TYPES.FINAL_RUN_COMPLETION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: {
                    trialIndex,
                    scenarioId: context.scenarioId
                }
            });
        }

        const transition = {
            schemaVersion: 4,
            transitionId,
            trialIndex,
            scenarioId: payload.scenarioId || null,
            outcome: payload.outcome || null,
            runTerminated: context.runTerminated,
            presentationCleanupComplete: false,
            status: POST_TRIAL_TRANSITION_STATUS.WAITING_FOR_PRESENTATION_CLEANUP,
            steps
        };
        this.engine.state.postTrialTransition = transition;

        this._emitFact(GAME_FACT_TYPES.POST_TRIAL_TRANSITION_CREATED, {
            transitionId,
            trialIndex,
            scenarioId: transition.scenarioId,
            runTerminated: transition.runTerminated,
            stepTypes: steps.map(step => step.type)
        });
        const rewardStep = steps.find(step => step.type === POST_TRIAL_STEP_TYPES.REWARD_SELECTION) || null;
        if (rewardStep) {
            this._emitFact(GAME_FACT_TYPES.POST_TRIAL_REWARD_AVAILABLE, {
                transitionId,
                trialIndex,
                payload: rewardStep.payload
            });
        }

        return {
            success: true,
            alreadyCreated: false,
            transition: this.getTransition()
        };
    }

    getTransition() {
        return cloneData(this.engine.state.postTrialTransition);
    }

    getPendingSteps(type = null) {
        const steps = Array.isArray(this.engine.state.postTrialTransition?.steps)
            ? this.engine.state.postTrialTransition.steps
            : [];
        return steps
            .filter(step => step?.status === POST_TRIAL_STEP_STATUS.PENDING && (!type || step.type === type))
            .map(step => cloneData(step));
    }

    getCurrentPendingStep() {
        return cloneData(this._getCurrentPendingStepRef());
    }

    hasPendingWork() {
        const transition = this.engine.state.postTrialTransition;
        return Boolean(transition && transition.status !== POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    }

    canResumeNormalProgression() {
        const transition = this.engine.state.postTrialTransition;
        return !transition || transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED;
    }

    completeRewardSelection({ result = null } = {}) {
        return this._completeExternalStep(POST_TRIAL_STEP_TYPES.REWARD_SELECTION, {
            result,
            factType: GAME_FACT_TYPES.POST_TRIAL_REWARD_SELECTED
        });
    }

    completeUnlockApply({ result = null } = {}) {
        return this._completeExternalStep(POST_TRIAL_STEP_TYPES.UNLOCK_APPLY, {
            result,
            factType: GAME_FACT_TYPES.POST_TRIAL_UNLOCK_APPLIED
        });
    }

    completeAdvisorProgression({ result = null } = {}) {
        return this._completeExternalStep(POST_TRIAL_STEP_TYPES.ADVISOR_PROGRESSION, { result });
    }

    completeFinalRunCompletion({ result = null } = {}) {
        return this._completeExternalStep(POST_TRIAL_STEP_TYPES.FINAL_RUN_COMPLETION, { result });
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

        const automatic = this._advanceAutomaticSteps({ translate });
        if (!automatic.success) {
            return {
                ...automatic,
                transition: this.getTransition()
            };
        }

        this._tryCompleteTransition();
        return {
            success: true,
            alreadyCompleted: false,
            stageProgression: automatic.stageProgression,
            transition: this.getTransition()
        };
    }

    _resolvePolicyPayload(policy, context) {
        if (typeof policy !== "function") return null;
        return normalizePolicyPayload(policy({
            trialIndex: context.trialIndex,
            scenarioId: context.scenarioId,
            outcome: context.outcome,
            runTerminated: context.runTerminated,
            settlement: cloneData(context.settlement),
            state: context.state
        }));
    }

    _completeExternalStep(type, { result = null, factType = null } = {}) {
        const transition = this.engine.state.postTrialTransition;
        if (!transition) {
            return { success: false, reason: "POST_TRIAL_TRANSITION_NOT_FOUND" };
        }
        const step = Array.isArray(transition.steps)
            ? transition.steps.find(candidate => candidate?.type === type)
            : null;
        if (!step) {
            return { success: false, reason: "POST_TRIAL_STEP_NOT_FOUND", stepType: type };
        }
        if (step.status === POST_TRIAL_STEP_STATUS.APPLIED) {
            return {
                success: true,
                alreadyApplied: true,
                transition: this.getTransition(),
                step: cloneData(step),
                stageProgression: null
            };
        }

        const current = this._getCurrentPendingStepRef();
        if (current !== step) {
            return {
                success: false,
                reason: "POST_TRIAL_STEP_OUT_OF_ORDER",
                stepType: type,
                currentStepType: current?.type || null,
                transition: this.getTransition()
            };
        }

        step.status = POST_TRIAL_STEP_STATUS.APPLIED;
        step.result = cloneData(result);
        if (factType) {
            this._emitFact(factType, {
                transitionId: transition.transitionId,
                trialIndex: transition.trialIndex,
                payload: step.payload,
                result: step.result
            });
        }

        const automatic = this._advanceAutomaticSteps();
        if (!automatic.success) {
            return {
                ...automatic,
                step: cloneData(step),
                transition: this.getTransition()
            };
        }

        this._tryCompleteTransition();
        return {
            success: true,
            alreadyApplied: false,
            transition: this.getTransition(),
            step: cloneData(step),
            stageProgression: automatic.stageProgression
        };
    }

    _advanceAutomaticSteps({ translate = null } = {}) {
        const transition = this.engine.state.postTrialTransition;
        if (!transition?.presentationCleanupComplete) {
            return { success: true, stageProgression: null };
        }

        const current = this._getCurrentPendingStepRef();
        if (!current || current.type !== POST_TRIAL_STEP_TYPES.STAGE_ADVANCE) {
            return { success: true, stageProgression: null };
        }

        if (this._reconcileAppliedStageStep(current)) {
            this._emitStageAdvanced(current, current.result);
            return { success: true, stageProgression: current.result };
        }

        this._restoreDelegatedStagePending();
        if (!this.stageProgressionService?.getPending?.()) {
            return {
                success: false,
                reason: "POST_TRIAL_STAGE_AUTHORITY_NOT_PENDING",
                stageProgression: null
            };
        }

        const stageProgression = this.stageProgressionService.applyPending({ translate });
        if (!stageProgression?.success) {
            return {
                success: false,
                reason: stageProgression?.reason || "POST_TRIAL_STAGE_ADVANCE_FAILED",
                stageProgression
            };
        }

        current.status = POST_TRIAL_STEP_STATUS.APPLIED;
        current.result = cloneData(stageProgression);
        this._emitStageAdvanced(current, stageProgression);
        return { success: true, stageProgression };
    }

    _getCurrentPendingStepRef() {
        const steps = Array.isArray(this.engine.state.postTrialTransition?.steps)
            ? this.engine.state.postTrialTransition.steps
            : [];
        return steps.find(step => step?.status === POST_TRIAL_STEP_STATUS.PENDING) || null;
    }

    _tryCompleteTransition({ emitFact = true } = {}) {
        const transition = this.engine.state.postTrialTransition;
        if (!transition) return { completed: false, reason: "POST_TRIAL_TRANSITION_NOT_FOUND" };
        if (transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED) {
            return { completed: true, alreadyCompleted: true };
        }
        if (!transition.presentationCleanupComplete) {
            transition.status = POST_TRIAL_TRANSITION_STATUS.WAITING_FOR_PRESENTATION_CLEANUP;
            return { completed: false, reason: "POST_TRIAL_PRESENTATION_CLEANUP_PENDING" };
        }

        const hasPendingStep = Boolean(this._getCurrentPendingStepRef());
        if (hasPendingStep) {
            transition.status = POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS;
            return { completed: false, reason: "POST_TRIAL_STEPS_PENDING" };
        }

        transition.status = POST_TRIAL_TRANSITION_STATUS.COMPLETED;
        if (emitFact) {
            this._emitFact(GAME_FACT_TYPES.POST_TRIAL_COMPLETED, {
                transitionId: transition.transitionId,
                trialIndex: transition.trialIndex,
                runTerminated: transition.runTerminated
            });
        }
        return { completed: true, alreadyCompleted: false };
    }

    _normalizeRestoredStepOrder() {
        const transition = this.engine.state.postTrialTransition;
        if (!transition || !Array.isArray(transition.steps)) return;
        transition.steps = transition.steps
            .map((step, originalIndex) => ({ step, originalIndex }))
            .sort((a, b) => {
                const aOrder = STEP_ORDER_INDEX.has(a.step?.type)
                    ? STEP_ORDER_INDEX.get(a.step.type)
                    : POST_TRIAL_STEP_ORDER.length;
                const bOrder = STEP_ORDER_INDEX.has(b.step?.type)
                    ? STEP_ORDER_INDEX.get(b.step.type)
                    : POST_TRIAL_STEP_ORDER.length;
                return aOrder - bOrder || a.originalIndex - b.originalIndex;
            })
            .map(entry => entry.step);
        transition.schemaVersion = Math.max(Number(transition.schemaVersion) || 1, 4);
    }

    _reconcileRestoredTransitionStatus() {
        const transition = this.engine.state.postTrialTransition;
        if (!transition || transition.status === POST_TRIAL_TRANSITION_STATUS.COMPLETED) return;
        this._tryCompleteTransition({ emitFact: false });
    }

    _emitStageAdvanced(stageStep, result) {
        const transition = this.engine.state.postTrialTransition;
        this._emitFact(GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED, {
            transitionId: transition?.transitionId || null,
            trialIndex: transition?.trialIndex || stageStep?.payload?.trialIndex || null,
            fromStageId: stageStep?.payload?.fromStageId || null,
            toStageId: stageStep?.payload?.toStageId || null,
            result: cloneData(result)
        });
    }

    _emitFact(type, payload = {}) {
        if (!type || typeof this.gameFactHub?.emit !== "function") return null;
        return this.gameFactHub.emit(type, payload);
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
            if (transition.presentationCleanupComplete) {
                this._tryCompleteTransition({ emitFact: false });
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
