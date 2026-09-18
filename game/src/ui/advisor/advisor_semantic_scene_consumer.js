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

    return Object.freeze({
        sceneId,
        advisorEvent: route.advisorEvent,
        topic: route.topic,
        legacyMilestone: route.legacyMilestone,
        verse: Number.isFinite(verse) && verse > 0 ? verse : null,
        context
    });
}
