import { ADVISOR_SCENES } from "../../data/advisor_scene_catalog.js";
import { getAdvisorSceneResponsibility } from "../../data/advisor_dialogue_responsibility.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../../trial/presentation/post_trial_interlude_scene_contract.js";

const POST_TRIAL_ADVISOR_SCENE_MAP = Object.freeze({
    [POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT]: ADVISOR_SCENES.POST_TRIAL_ASSESSMENT,
    [POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING]: ADVISOR_SCENES.POST_TRIAL_MEANING,
    [POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE]: ADVISOR_SCENES.POST_TRIAL_STAGE_PRELUDE,
    [POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT]: ADVISOR_SCENES.POST_TRIAL_POST_STAGE_COMMENT
});

/**
 * Advisor-side adapter only.
 *
 * Post-Trial decides occurrence/order and supplies a settled public payload.
 * This adapter does not re-evaluate Trial results, authorize Stage progression,
 * infer hidden truth, or decide whether a Post-Trial scene occurs.
 */
export function resolveAdvisorPostTrialScene(scene = {}) {
    const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId : scene?.id;
    const advisorScene = POST_TRIAL_ADVISOR_SCENE_MAP[sceneId] || null;
    if (!advisorScene) return null;

    const responsibility = getAdvisorSceneResponsibility(advisorScene);
    if (!responsibility) return null;

    return Object.freeze({
        sceneId,
        advisorScene,
        channel: responsibility.channel,
        payload: scene.payload || null
    });
}

export default resolveAdvisorPostTrialScene;
