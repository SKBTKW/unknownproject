import { BoardAwareUIController } from './board_aware_ui_controller.js';
import { TrialResultExitAdapter } from './trial_result_exit_adapter.js';
import { releaseSettledTrialPreviewSession } from '../trial/dev/settled_trial_preview_release.js';
import { TrialSessionBoundaryService } from '../trial/flow/trial_session_boundary_service.js';
import { GlobalEventChoiceRuntimeIntegration } from './global_event_choice_runtime_integration.js';

export class TrialResultUIController extends BoardAwareUIController {
    constructor(engine) {
        super(engine);
        if (this.engine && !this.engine.trialSessionBoundaryService) {
            this.engine.trialSessionBoundaryService = new TrialSessionBoundaryService(this.engine);
        }
        this.trialResultExitAdapter = new TrialResultExitAdapter({
            gameFactHub: this.trialController.gameFactHub,
            lifecycleProvider: () => this.trialController.getLifecycleReadModel(),
            onExitReady: () => this.releaseSettledTrialPresentation()
        });
        this.globalEventChoiceRuntime = new GlobalEventChoiceRuntimeIntegration(this);
    }

    render() {
        super.render();
        this.globalEventChoiceRuntime?.resumePending?.();
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
        this.render();
        return {
            success: true,
            lifecycle,
            sessionBoundaryRelease,
            developmentSessionRelease
        };
    }

    getTrialLifecycleReadModel() {
        return this.trialController?.getLifecycleReadModel?.() || null;
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
