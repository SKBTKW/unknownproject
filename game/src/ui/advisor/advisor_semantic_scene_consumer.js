import { ADVISOR_DIALOGUE_CHANNELS } from "../../data/advisor_dialogue_responsibility.js";
import { ADVISOR_SCENES } from "../../data/advisor_scene_catalog.js";
import { projectAdvisorPostTrialSceneContext } from "../../data/advisor_post_trial_scene_contract.js";

// Advisor-side routing only.
// Semantic Scene occurrence / first-run or Post-Trial dedupe remain owned by the producer.
const ADVISOR_SEMANTIC_SCENE_ROUTES = Object.freeze({
    ZONE_COMPLETED: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.ADVICE,
        advisorEvent: "ZONE_COMPLETED",
        topic: "development",
        legacyMilestone: "zone"
    }),
    LINK_COMPLETED: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.ADVICE,
        advisorEvent: "LINK_COMPLETED",
        topic: "connection",
        legacyMilestone: "link"
    }),
    [ADVISOR_SCENES.ASSESSMENT]: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.DUTY,
        advisorEvent: "ASSESSMENT",
        postTrial: true
    }),
    [ADVISOR_SCENES.TRIAL_MEANING]: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.REACTION,
        postTrial: true
    }),
    [ADVISOR_SCENES.STAGE_PRELUDE]: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.DUTY,
        advisorEvent: "STAGE_PRELUDE",
        postTrial: true
    }),
    [ADVISOR_SCENES.POST_STAGE_COMMENT]: Object.freeze({
        channel: ADVISOR_DIALOGUE_CHANNELS.REACTION,
        postTrial: true
    })
});

export function resolveAdvisorSemanticScene(scene = {}) {
    const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId.trim() : "";
    const route = ADVISOR_SEMANTIC_SCENE_ROUTES[sceneId];
    if (!route) return null;

    const verse = Number(scene?.verse);
    const rawContext = scene?.context && typeof scene.context === "object" && !Array.isArray(scene.context)
        ? scene.context
        : {};
    const context = route.postTrial
        ? projectAdvisorPostTrialSceneContext(sceneId, rawContext)
        : rawContext;

    return Object.freeze({
        sceneId,
        channel: route.channel,
        advisorEvent: route.advisorEvent || null,
        topic: route.topic || null,
        legacyMilestone: route.legacyMilestone || null,
        verse: Number.isFinite(verse) && verse > 0 ? verse : null,
        context
    });
}
