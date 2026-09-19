import { POST_TRIAL_INTERLUDE_SCENES } from "./post_trial_interlude_scene_contract.js";

/**
 * Thin presentation bridge for an externally-owned Post-Trial interlude.
 *
 * It does not choose scene occurrence/order and stores no progression state.
 * The presentation owner may opt into Stage deferral, present Advisor-owned
 * scenes, then notify completion of STAGE_PRELUDE to open the existing
 * PostTrialProgression gate.
 */
export class PostTrialInterludePresentationBridge {
    constructor({ uiController, advisorPresenter = null } = {}) {
        if (!uiController) throw new TypeError("POST_TRIAL_INTERLUDE_UI_CONTROLLER_REQUIRED");
        this.uiController = uiController;
        this.advisorPresenter = advisorPresenter;
        this.enabled = false;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        this.uiController.setPostTrialStageGateDeferred?.(this.enabled);
        return this.enabled;
    }

    presentAdvisorScene(scene = {}) {
        if (!this.enabled) {
            return { success: true, spoken: false, reason: "POST_TRIAL_INTERLUDE_DISABLED" };
        }
        if (!this.advisorPresenter?.present) {
            return { success: true, spoken: false, reason: "POST_TRIAL_ADVISOR_PRESENTER_UNAVAILABLE" };
        }
        return this.advisorPresenter.present(scene);
    }

    completeScene(sceneId) {
        if (!this.enabled) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_DISABLED" };
        }
        if (sceneId !== POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE) {
            return { success: true, stageGateOpened: false };
        }

        const result = this.uiController.completePostTrialStagePrelude?.();
        if (!result) {
            return { success: false, reason: "POST_TRIAL_STAGE_GATE_UNAVAILABLE" };
        }
        if (result.success === false) return result;

        return {
            success: true,
            stageGateOpened: true,
            stageProgression: result.stageProgression || null,
            progression: result.progression || null
        };
    }
}

export default PostTrialInterludePresentationBridge;
