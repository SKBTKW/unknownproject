export const ADVISOR_EVENTS = Object.freeze({
    GAME_START: "GAME_START",
    TURN_START: "TURN_START",
    TRIAL_WARNING: "TRIAL_WARNING",
    TRIAL_START: "TRIAL_START",
    TRIAL_END: "TRIAL_END",
    TRIAL_PLAN_CONFIRMED: "TRIAL_PLAN_CONFIRMED",
    EMBER_WARNING: "EMBER_WARNING", EMBER_CRITICAL: "EMBER_CRITICAL", EMBER_RECOVERED: "EMBER_RECOVERED",
    FOOD_WARNING: "FOOD_WARNING", FOOD_CRITICAL: "FOOD_CRITICAL", FOOD_RECOVERED: "FOOD_RECOVERED",
    DEFENSE_WEAK: "DEFENSE_WEAK", DEFENSE_CRITICAL: "DEFENSE_CRITICAL", DEFENSE_HEALTHY: "DEFENSE_HEALTHY",
    FIRST_ZONE_COMPLETED: "FIRST_ZONE_COMPLETED", ZONE_COMPLETED: "ZONE_COMPLETED",
    FIRST_LINK_COMPLETED: "FIRST_LINK_COMPLETED", LINK_COMPLETED: "LINK_COMPLETED",
    BOARD_FRAGMENTED: "BOARD_FRAGMENTED", CONNECTION_HEALTHY: "CONNECTION_HEALTHY",
    MAJOR_DEVELOPMENT: "MAJOR_DEVELOPMENT", STABLE_OVERALL: "STABLE_OVERALL", GENERAL_AMBIENT: "GENERAL_AMBIENT",
    MILITARY_ACTION: "MILITARY_ACTION", GLOBAL_EVENT_SURVIVAL: "GLOBAL_EVENT_SURVIVAL"
});

// Character lines describe the lived condition represented by Ember; they never speak its internal narrative name.
export const ADVISOR_DIALOGUES = Object.freeze([
    { event: ADVISOR_EVENTS.GAME_START, personality: "stern", priority: 20, cooldownMs: Infinity, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_GAME_START"] },
    { event: ADVISOR_EVENTS.TRIAL_WARNING, personality: "stern", priority: 80, cooldownMs: Infinity, durationMs: 4800, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_WARNING"] },
    { event: ADVISOR_EVENTS.TRIAL_START, personality: "stern", priority: 100, cooldownMs: Infinity, durationMs: 5200, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_START"] },
    { event: ADVISOR_EVENTS.TRIAL_END, personality: "stern", priority: 90, cooldownMs: Infinity, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_END"] },
    { event: ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED, personality: "stern", priority: 70, cooldownMs: 1000, durationMs: 3600, lineKeys: ["UI_ADVISOR_DIALOGUE_PLAN_CONFIRMED"] },
    { event: ADVISOR_EVENTS.EMBER_WARNING, personality: "stern", priority: 90, cooldownMs: 0, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_EMBER_WARNING_1", "UI_ADVISOR_DIALOGUE_EMBER_WARNING_2"] },
    { event: ADVISOR_EVENTS.EMBER_CRITICAL, personality: "stern", priority: 100, cooldownMs: 0, durationMs: 4600, lineKeys: ["UI_ADVISOR_DIALOGUE_EMBER_CRITICAL_1", "UI_ADVISOR_DIALOGUE_EMBER_CRITICAL_2"] },
    { event: ADVISOR_EVENTS.EMBER_RECOVERED, personality: "stern", priority: 55, cooldownMs: 0, durationMs: 3600, lineKeys: ["UI_ADVISOR_DIALOGUE_EMBER_RECOVERED_1", "UI_ADVISOR_DIALOGUE_EMBER_RECOVERED_2"] },
    { event: ADVISOR_EVENTS.FOOD_WARNING, personality: "stern", priority: 70, cooldownMs: 0, durationMs: 3900, lineKeys: ["UI_ADVISOR_DIALOGUE_FOOD_WARNING_1", "UI_ADVISOR_DIALOGUE_FOOD_WARNING_2"] },
    { event: ADVISOR_EVENTS.FOOD_CRITICAL, personality: "stern", priority: 95, cooldownMs: 0, durationMs: 4400, lineKeys: ["UI_ADVISOR_DIALOGUE_FOOD_CRITICAL_1", "UI_ADVISOR_DIALOGUE_FOOD_CRITICAL_2"] },
    { event: ADVISOR_EVENTS.FOOD_RECOVERED, personality: "stern", priority: 50, cooldownMs: 0, durationMs: 3500, lineKeys: ["UI_ADVISOR_DIALOGUE_FOOD_RECOVERED_1", "UI_ADVISOR_DIALOGUE_FOOD_RECOVERED_2"] },
    { event: ADVISOR_EVENTS.DEFENSE_WEAK, personality: "stern", priority: 70, cooldownMs: 0, durationMs: 3900, lineKeys: ["UI_ADVISOR_DIALOGUE_DEFENSE_WEAK_1", "UI_ADVISOR_DIALOGUE_DEFENSE_WEAK_2"] },
    { event: ADVISOR_EVENTS.DEFENSE_CRITICAL, personality: "stern", priority: 95, cooldownMs: 0, durationMs: 4400, lineKeys: ["UI_ADVISOR_DIALOGUE_DEFENSE_CRITICAL_1", "UI_ADVISOR_DIALOGUE_DEFENSE_CRITICAL_2"] },
    { event: ADVISOR_EVENTS.DEFENSE_HEALTHY, personality: "stern", priority: 35, cooldownMs: 0, durationMs: 3400, lineKeys: ["UI_ADVISOR_DIALOGUE_DEFENSE_HEALTHY_1", "UI_ADVISOR_DIALOGUE_DEFENSE_HEALTHY_2"] },
    { event: ADVISOR_EVENTS.FIRST_ZONE_COMPLETED, personality: "stern", priority: 75, cooldownMs: Infinity, durationMs: 4000, lineKeys: ["UI_ADVISOR_DIALOGUE_FIRST_ZONE_1", "UI_ADVISOR_DIALOGUE_FIRST_ZONE_2"] },
    { event: ADVISOR_EVENTS.ZONE_COMPLETED, personality: "stern", priority: 25, cooldownMs: 0, durationMs: 3300, lineKeys: ["UI_ADVISOR_DIALOGUE_ZONE_1", "UI_ADVISOR_DIALOGUE_ZONE_2"] },
    { event: ADVISOR_EVENTS.FIRST_LINK_COMPLETED, personality: "stern", priority: 80, cooldownMs: Infinity, durationMs: 4000, lineKeys: ["UI_ADVISOR_DIALOGUE_FIRST_LINK_1", "UI_ADVISOR_DIALOGUE_FIRST_LINK_2"] },
    { event: ADVISOR_EVENTS.LINK_COMPLETED, personality: "stern", priority: 50, cooldownMs: 0, durationMs: 3500, lineKeys: ["UI_ADVISOR_DIALOGUE_LINK_1", "UI_ADVISOR_DIALOGUE_LINK_2"] },
    { event: ADVISOR_EVENTS.BOARD_FRAGMENTED, personality: "stern", priority: 65, cooldownMs: 0, durationMs: 3900, lineKeys: ["UI_ADVISOR_DIALOGUE_BOARD_FRAGMENTED_1", "UI_ADVISOR_DIALOGUE_BOARD_FRAGMENTED_2"] },
    { event: ADVISOR_EVENTS.CONNECTION_HEALTHY, personality: "stern", priority: 35, cooldownMs: 0, durationMs: 3400, lineKeys: ["UI_ADVISOR_DIALOGUE_CONNECTION_HEALTHY_1", "UI_ADVISOR_DIALOGUE_CONNECTION_HEALTHY_2"] },
    { event: ADVISOR_EVENTS.MAJOR_DEVELOPMENT, personality: "stern", priority: 30, cooldownMs: 0, durationMs: 3400, lineKeys: ["UI_ADVISOR_DIALOGUE_MAJOR_DEVELOPMENT_1", "UI_ADVISOR_DIALOGUE_MAJOR_DEVELOPMENT_2"] },
    { event: ADVISOR_EVENTS.STABLE_OVERALL, personality: "stern", priority: 15, cooldownMs: 0, durationMs: 3200, lineKeys: ["UI_ADVISOR_DIALOGUE_STABLE_1", "UI_ADVISOR_DIALOGUE_STABLE_2"] },
    { event: ADVISOR_EVENTS.GENERAL_AMBIENT, personality: "stern", priority: 10, cooldownMs: 0, durationMs: 3200, lineKeys: ["UI_ADVISOR_DIALOGUE_AMBIENT_1", "UI_ADVISOR_DIALOGUE_AMBIENT_2"] },
    { event: ADVISOR_EVENTS.MILITARY_ACTION, personality: "stern", priority: 75, cooldownMs: 0, durationMs: 3800, lineKeys: ["UI_ADVISOR_DIALOGUE_MILITARY_1", "UI_ADVISOR_DIALOGUE_MILITARY_2"] },
    { event: ADVISOR_EVENTS.GLOBAL_EVENT_SURVIVAL, personality: "stern", priority: 85, cooldownMs: 0, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_GLOBAL_SURVIVAL_1", "UI_ADVISOR_DIALOGUE_GLOBAL_SURVIVAL_2"] }
]);

export function findAdvisorDialogue(event, profile, database = ADVISOR_DIALOGUES) {
    return database.find(entry => entry.event === event && (!entry.personality || entry.personality === profile?.personality)) || null;
}
