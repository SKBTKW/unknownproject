import {
    POST_TRIAL_INTERLUDE_SCENES,
    buildPostTrialInterludeSceneSequence
} from "../presentation/post_trial_interlude_scene_contract.js";

export const POST_TRIAL_INTERLUDE_PRESENTATION_STATUS = Object.freeze({
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED"
});

const PRESENTATION_SCHEMA_VERSION = 1;

function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function getTransitionRef(state) {
    return state?.postTrialTransition || null;
}

function normalizeIndex(value, length) {
    const index = Math.floor(Number(value));
    if (!Number.isInteger(index) || index < 0) return 0;
    return Math.min(index, Math.max(0, length - 1));
}

/**
 * Persistent cursor for the Post-Trial interlude presentation.
 *
 * This service owns only presentation progress. It never mutates Trial results,
 * reward/unlock/skill effects, Stage authority, or scene occurrence rules.
 * The cursor is stored under postTrialTransition.presentation so existing
 * serializer/hydration round-trips preserve it automatically.
 */
export class PostTrialInterludeProgressService {
    constructor({
        state,
        readService,
        presentationBridge = null,
        firstRunPolicyProvider = null
    } = {}) {
        if (!state) throw new TypeError("POST_TRIAL_INTERLUDE_STATE_REQUIRED");
        if (!readService?.read) throw new TypeError("POST_TRIAL_INTERLUDE_READ_SERVICE_REQUIRED");
        this.state = state;
        this.readService = readService;
        this.presentationBridge = presentationBridge;
        this.firstRunPolicyProvider = firstRunPolicyProvider;
    }

    ensureSession() {
        const transition = getTransitionRef(this.state);
        const readModel = this.readService.read();
        if (!transition || !readModel?.available) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_TRANSITION_REQUIRED" };
        }

        const firstRunPolicy = typeof this.firstRunPolicyProvider === "function"
            ? this.firstRunPolicyProvider({ readModel, state: this.state })
            : null;
        const canonicalScenes = buildPostTrialInterludeSceneSequence(readModel, {
            firstRunPolicy
        });
        if (!canonicalScenes.length) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_SCENES_REQUIRED" };
        }

        let presentation = transition.presentation;
        const sameTransition = presentation?.transitionId === transition.transitionId;
        if (!presentation || !sameTransition) {
            presentation = {
                schemaVersion: PRESENTATION_SCHEMA_VERSION,
                transitionId: transition.transitionId,
                status: POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.ACTIVE,
                currentSceneIndex: 0,
                scenes: canonicalScenes.map(scene => cloneData(scene)),
                completedSceneIds: []
            };
            transition.presentation = presentation;
        } else {
            const scenes = Array.isArray(presentation.scenes) && presentation.scenes.length
                ? presentation.scenes
                : canonicalScenes.map(scene => cloneData(scene));
            presentation.scenes = scenes;
            presentation.currentSceneIndex = normalizeIndex(
                presentation.currentSceneIndex,
                scenes.length
            );
            presentation.completedSceneIds = Array.isArray(presentation.completedSceneIds)
                ? presentation.completedSceneIds.filter(id => typeof id === "string")
                : [];
            presentation.schemaVersion = PRESENTATION_SCHEMA_VERSION;
            if (presentation.status !== POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.COMPLETED) {
                presentation.status = POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.ACTIVE;
            }
        }

        const active = presentation.status !== POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.COMPLETED;
        this.presentationBridge?.setEnabled?.(active);
        const hasStagePrelude = presentation.scenes.some(
            scene => scene?.id === POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
        );
        const stagePreludeCompleted = presentation.completedSceneIds.includes(
            POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE
        );
        this.presentationBridge?.setStageGateDeferred?.(
            active && hasStagePrelude && !stagePreludeCompleted
        );

        return {
            success: true,
            presentation: this.getPresentation(),
            currentScene: this.getCurrentScene()
        };
    }

    getPresentation() {
        return cloneData(getTransitionRef(this.state)?.presentation);
    }

    getCurrentScene() {
        const presentation = getTransitionRef(this.state)?.presentation;
        if (!presentation || presentation.status === POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.COMPLETED) {
            return null;
        }
        const scenes = Array.isArray(presentation.scenes) ? presentation.scenes : [];
        return cloneData(scenes[presentation.currentSceneIndex] || null);
    }

    completeCurrentScene({ expectedSceneId = null } = {}) {
        const transition = getTransitionRef(this.state);
        const presentation = transition?.presentation || null;
        if (!presentation) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_SESSION_REQUIRED" };
        }
        if (presentation.status === POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.COMPLETED) {
            return {
                success: true,
                alreadyCompleted: true,
                presentation: this.getPresentation(),
                currentScene: null
            };
        }

        const current = this.getCurrentScene();
        if (!current) {
            return { success: false, reason: "POST_TRIAL_INTERLUDE_CURRENT_SCENE_REQUIRED" };
        }
        if (expectedSceneId && current.id !== expectedSceneId) {
            return {
                success: false,
                reason: "POST_TRIAL_INTERLUDE_SCENE_MISMATCH",
                expectedSceneId,
                currentSceneId: current.id
            };
        }

        const bridgeResult = this.presentationBridge?.completeScene?.(current.id) || {
            success: true,
            stageGateOpened: false
        };
        if (bridgeResult.success === false) return bridgeResult;

        if (!presentation.completedSceneIds.includes(current.id)) {
            presentation.completedSceneIds.push(current.id);
        }

        const nextIndex = presentation.currentSceneIndex + 1;
        if (current.id === POST_TRIAL_INTERLUDE_SCENES.CLOSE
            || nextIndex >= presentation.scenes.length) {
            presentation.currentSceneIndex = Math.min(nextIndex, presentation.scenes.length);
            presentation.status = POST_TRIAL_INTERLUDE_PRESENTATION_STATUS.COMPLETED;
            this.presentationBridge?.setStageGateDeferred?.(false);
            this.presentationBridge?.setEnabled?.(false);
            return {
                success: true,
                completed: true,
                completedScene: current,
                bridgeResult: cloneData(bridgeResult),
                presentation: this.getPresentation(),
                currentScene: null
            };
        }

        presentation.currentSceneIndex = nextIndex;
        return {
            success: true,
            completed: false,
            completedScene: current,
            bridgeResult: cloneData(bridgeResult),
            presentation: this.getPresentation(),
            currentScene: this.getCurrentScene()
        };
    }
}

export default PostTrialInterludeProgressService;
