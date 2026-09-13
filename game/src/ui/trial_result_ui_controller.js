import { BoardAwareUIController } from './board_aware_ui_controller.js';
import { TrialResultExitAdapter } from './trial_result_exit_adapter.js';
import { releaseSettledTrialPreviewSession } from '../trial/dev/settled_trial_preview_release.js';

/**
 * Browser application boundary for consuming settled Trial results.
 * Trial/Game Flow owns exit readiness; this class only projects that fact to
 * Browser layout without clearing TrialState.
 */
export class TrialResultUIController extends BoardAwareUIController {
    constructor(engine) {
        super(engine);
        this.trialResultExitAdapter = new TrialResultExitAdapter({
            gameFactHub: this.trialController.gameFactHub,
            lifecycleProvider: () => this.trialController.getLifecycleReadModel(),
            onExitReady: () => this.releaseSettledTrialPresentation()
        });
    }

    releaseSettledTrialPresentation() {
        const lifecycle = this.trialController.getLifecycleReadModel?.();
        if (!lifecycle?.canExitTrial) {
            return { success: false, reason: "TRIAL_EXIT_NOT_READY" };
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
