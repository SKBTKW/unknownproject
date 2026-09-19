import { BoardAwareUIController } from './board_aware_ui_controller.js';
import { TrialResultExitAdapter } from './trial_result_exit_adapter.js';
import { releaseSettledTrialPreviewSession } from '../trial/dev/settled_trial_preview_release.js';
import { TrialSessionBoundaryService } from '../trial/flow/trial_session_boundary_service.js';
import { GlobalEventChoiceRuntimeIntegration } from './global_event_choice_runtime_integration.js';
import { AdvisorPostTrialScenePresenter } from './advisor/advisor_post_trial_scene_presenter.js';
import { PostTrialInterludeComponent } from './post_trial_interlude_component.js';
import { PostTrialInterludePresentationBridge } from '../trial/presentation/post_trial_interlude_presentation_bridge.js';
import { PostTrialInterludeProgressService } from '../trial/systems/post_trial_interlude_progress_service.js';

export class TrialResultUIController extends BoardAwareUIController {
    constructor(engine) {
        super(engine);
        if (this.engine && !this.engine.trialSessionBoundaryService) {
            this.engine.trialSessionBoundaryService = new TrialSessionBoundaryService(this.engine);
        }

        // Migration boundary: the legacy UI-owned TrialController still owns a
        // local fact hub because base UI construction predates the live engine
        // hub. Forward its facts into the engine SSOT so Trial settlement can
        // advance timing authority without breaking existing UI/Advisor listeners.
        const trialFactHub = this.trialController?.gameFactHub || null;
        const runtimeFactHub = this.engine?.gameFactHub || null;
        this.unsubscribeTrialFactForwarder = null;
        if (trialFactHub && runtimeFactHub && trialFactHub !== runtimeFactHub
            && typeof trialFactHub.subscribe === 'function'
            && typeof runtimeFactHub.emit === 'function') {
            this.unsubscribeTrialFactForwarder = trialFactHub.subscribe(fact => {
                if (!fact?.type) return;
                runtimeFactHub.emit(fact.type, fact.payload || {});
            });
        }

        this.trialResultExitAdapter = new TrialResultExitAdapter({
            gameFactHub: this.trialController.gameFactHub,
            lifecycleProvider: () => this.trialController.getLifecycleReadModel(),
            onExitReady: () => this.handleSettledTrialExitReady()
        });
        this.globalEventChoiceRuntime = new GlobalEventChoiceRuntimeIntegration(this);
        this.postTrialStageGateDeferred = false;
        this.postTrialAdvisorPresenter = null;
        this.postTrialInterludePresentationBridge = null;
        this.postTrialInterludeProgressService = null;
        this.postTrialInterludeComponent = null;
        this.configurePostTrialInterlude();
    }

    render() {
        super.render();
        this.globalEventChoiceRuntime?.resumePending?.();
        this.resumePostTrialInterludeIfNeeded();
    }

    configurePostTrialInterlude() {
        const readService = this.engine?.postTrialProgressionReadService || null;
        if (!readService?.read || !this.state) return false;

        const advisorDock = this.advisorDockComponent || null;
        if (advisorDock?.dialogueSystem) {
            this.postTrialAdvisorPresenter = new AdvisorPostTrialScenePresenter({
                dialogueSystem: advisorDock.dialogueSystem,
                profile: advisorDock.profile,
                enabledProvider: () => advisorDock.isEnabled?.() === true
            });
        }

        this.postTrialInterludePresentationBridge = new PostTrialInterludePresentationBridge({
            uiController: this,
            advisorPresenter: this.postTrialAdvisorPresenter
        });
        this.postTrialInterludeProgressService = new PostTrialInterludeProgressService({
            state: this.state,
            readService,
            presentationBridge: this.postTrialInterludePresentationBridge
        });

        if (typeof document !== "undefined") {
            this.postTrialInterludeComponent = new PostTrialInterludeComponent({
                progressService: this.postTrialInterludeProgressService,
                readService,
                presentationBridge: this.postTrialInterludePresentationBridge,
                stateProvider: () => this.state,
                advisorEnabledProvider: () => advisorDock?.isEnabled?.() === true,
                translate: (key, params, fallback) => this.engine?.i18n?.t?.(key, params) || fallback,
                onRefresh: () => this.render()
            });
        }
        return true;
    }

    preparePostTrialInterlude() {
        if (!this.postTrialInterludeProgressService) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_RUNTIME_UNAVAILABLE" };
        }
        return this.postTrialInterludeProgressService.ensureSession();
    }

    handleSettledTrialExitReady() {
        const prepared = this.preparePostTrialInterlude();
        const released = this.releaseSettledTrialPresentation();
        if (released?.success && prepared?.success) {
            this.postTrialInterludeComponent?.open?.();
        }
        return released;
    }

    resumePostTrialInterludeIfNeeded() {
        if (this.trialPreviewConfig && this.trialController?.state) return false;
        const transition = this.state?.postTrialTransition || null;
        if (!transition) {
            this.postTrialInterludeComponent?.close?.();
            return false;
        }
        if (transition.presentation?.status === "COMPLETED") {
            this.postTrialInterludeComponent?.close?.();
            return false;
        }

        const prepared = this.preparePostTrialInterlude();
        if (!prepared?.success) return false;
        this.postTrialInterludeComponent?.open?.();
        return true;
    }

    startTrialSession(scenario, options = {}) {
        const state = super.startTrialSession(scenario, options);
        this.engine?.trialSessionBoundaryService?.beginTrial?.({
            startVerse: this.state?.turn
        });
        return state;
    }

    /** @deprecated Use startTrialSession(). */
    startTrialInterceptionPreview(scenario, options = {}) {
        return this.startTrialSession(scenario, options);
    }

    stopTrialSession() {
        this.engine?.trialSessionBoundaryService?.abortTrial?.();
        return super.stopTrialSession();
    }

    /** @deprecated Use stopTrialSession(). */
    stopTrialInterceptionPreview() {
        return this.stopTrialSession();
    }

    releaseSettledTrialPresentation() {
        const lifecycle = this.trialController.getLifecycleReadModel?.();
        if (!lifecycle?.canExitTrial) {
            return { success: false, reason: "TRIAL_EXIT_NOT_READY" };
        }

        const sessionBoundaryRelease = this.engine?.trialSessionBoundaryService
            ?.releaseAfterSettlement?.(lifecycle) || null;
        if (sessionBoundaryRelease && sessionBoundaryRelease.success === false) {
            return sessionBoundaryRelease;
        }

        const developmentSessionRelease = releaseSettledTrialPreviewSession(
            this.developmentTrialPreviewHarness
        );

        if (this.preTrialBoardContextMode) {
            this.boardPresentationState.setContextMode(this.preTrialBoardContextMode);
        }
        this.preTrialBoardContextMode = null;
        this.trialPreviewConfig = null;
        this.trialPresentationState.clearPlanningState();
        this.hideCellTooltip();
        this.layoutStateManager.exitTrial();

        const shouldDeferStageGate = Boolean(this.postTrialStageGateDeferred);
        const postTrialProgression = shouldDeferStageGate
            ? {
                success: true,
                deferred: true,
                transition: this.getPostTrialProgressionReadModel()
            }
            : (this.engine?.postTrialProgressionService
                ?.completeAfterPresentationCleanup?.({
                    translate: (key, params, fallback) => this.engine?.i18n?.t?.(key, params) || fallback
                }) || null);
        if (postTrialProgression && postTrialProgression.success === false) {
            return postTrialProgression;
        }

        this.render();
        return {
            success: true,
            lifecycle,
            sessionBoundaryRelease,
            developmentSessionRelease,
            postTrialProgression,
            // Compatibility result shape for callers that still inspect Stage progress.
            stageProgression: postTrialProgression?.stageProgression || null
        };
    }

    setPostTrialStageGateDeferred(enabled) {
        this.postTrialStageGateDeferred = Boolean(enabled);
        return this.postTrialStageGateDeferred;
    }

    completePostTrialStagePrelude({ render = true } = {}) {
        const before = this.getPostTrialProgressionReadModel();
        const stageAdvance = before?.stageAdvance || null;
        const stageAlreadyApplied = stageAdvance?.status === "APPLIED";
        const stageIsCurrent = before?.currentStep?.type === "STAGE_ADVANCE";
        if (!stageAlreadyApplied && !stageIsCurrent) {
            return {
                success: false,
                reason: "POST_TRIAL_STAGE_PRELUDE_NOT_READY",
                currentStepType: before?.currentStep?.type || null
            };
        }

        const progression = stageAlreadyApplied
            ? {
                success: true,
                alreadyApplied: true,
                stageProgression: stageAdvance?.payload || null,
                transition: before
            }
            : (this.engine?.postTrialProgressionService
            ?.completeAfterPresentationCleanup?.({
                translate: (key, params, fallback) => this.engine?.i18n?.t?.(key, params) || fallback
            }) || null);

        if (progression && progression.success === false) {
            return progression;
        }

        const after = this.getPostTrialProgressionReadModel();
        if (!stageAlreadyApplied && after?.stageAdvance?.status !== "APPLIED") {
            return {
                success: false,
                reason: "POST_TRIAL_STAGE_PRELUDE_STAGE_NOT_APPLIED",
                progression
            };
        }

        this.postTrialStageGateDeferred = false;
        if (render) this.render();
        return {
            success: true,
            progression,
            stageProgression: progression?.stageProgression || null
        };
    }

    getTrialLifecycleReadModel() {
        return this.trialController?.getLifecycleReadModel?.() || null;
    }

    getPostTrialProgressionReadModel() {
        return this.engine?.postTrialProgressionReadService?.read?.() || null;
    }

    settleCurrentTrialResult() {
        if (!this.trialPreviewConfig || !this.trialController?.state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        const result = this.trialController.settleTrialResult();
        if (!result.success) {
            this.trialPresentationState.planningValidationErrors = result.errors || [];
            this.render();
            return result;
        }
        this.trialPresentationState.planningValidationErrors = [];
        return result;
    }
}

export default TrialResultUIController;
