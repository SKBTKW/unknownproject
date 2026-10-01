// Advisor-side routing only.
// Semantic Scene occurrence / first-run dedupe remain owned by FirstRun/Tutorial.
const ADVISOR_SEMANTIC_SCENE_ROUTES = Object.freeze({
    ZONE_COMPLETED: Object.freeze({
        advisorEvent: "ZONE_COMPLETED",
        topic: "development",
        legacyMilestone: "zone"
    }),
    LINK_COMPLETED: Object.freeze({
        advisorEvent: "LINK_COMPLETED",
        topic: "connection",
        legacyMilestone: "link"
    }),
    GLOBAL_EVENT_PRESENTED: Object.freeze({
        advisorEvent: "GLOBAL_EVENT_PRESENTED_BRIEF",
        topic: "survival",
        legacyMilestone: null
    }),
    FIRST_RUN_TRIAL_ROUTE: Object.freeze({
        advisorEvent: "FIRST_RUN_TRIAL_ROUTE",
        topic: "defense",
        legacyMilestone: null,
        mandatory: true
    }),
    FIRST_RUN_TRIAL_TERRAIN: Object.freeze({
        advisorEvent: "FIRST_RUN_TRIAL_TERRAIN",
        topic: "defense",
        legacyMilestone: null,
        mandatory: true
    }),
    FIRST_RUN_TRIAL_DEFENSE: Object.freeze({
        advisorEvent: "FIRST_RUN_TRIAL_DEFENSE",
        topic: "defense",
        legacyMilestone: null,
        mandatory: true
    }),
    FIRST_RUN_TRIAL_CAUSALITY: Object.freeze({
        advisorEvent: "FIRST_RUN_TRIAL_CAUSALITY",
        topic: "defense",
        legacyMilestone: null,
        mandatory: true
    })
});

export function resolveAdvisorSemanticScene(scene = {}) {
    const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId.trim() : "";
    const route = ADVISOR_SEMANTIC_SCENE_ROUTES[sceneId];
    if (!route) return null;

    const verse = Number(scene?.verse);
    const context = scene?.context && typeof scene.context === "object" && !Array.isArray(scene.context)
        ? scene.context
        : {};

    const firstRunBackground = sceneId === "GLOBAL_EVENT_PRESENTED"
        && context.firstRun === true
        && context.firstPresentation === true;

    return Object.freeze({
        sceneId,
        advisorEvent: firstRunBackground ? "GLOBAL_EVENT_PRESENTED_FIRST_RUN" : route.advisorEvent,
        topic: route.topic,
        legacyMilestone: route.legacyMilestone,
        mandatory: firstRunBackground || route.mandatory === true,
        verse: Number.isFinite(verse) && verse > 0 ? verse : null,
        context
    });
}
