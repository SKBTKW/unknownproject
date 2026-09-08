export const ADVISOR_EVENTS = Object.freeze({
    GAME_START: "GAME_START",
    TURN_START: "TURN_START",
    TRIAL_WARNING: "TRIAL_WARNING",
    TRIAL_START: "TRIAL_START",
    TRIAL_END: "TRIAL_END",
    TRIAL_PLAN_CONFIRMED: "TRIAL_PLAN_CONFIRMED"
});

export const ADVISOR_DIALOGUES = Object.freeze([
    { event: ADVISOR_EVENTS.GAME_START, personality: "stern", priority: 20, cooldownMs: Infinity, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_GAME_START"] },
    { event: ADVISOR_EVENTS.TURN_START, personality: "stern", priority: 10, cooldownMs: 2500, durationMs: 3000, lineKeys: ["UI_ADVISOR_DIALOGUE_TURN_START"] },
    { event: ADVISOR_EVENTS.TRIAL_WARNING, personality: "stern", priority: 80, cooldownMs: Infinity, durationMs: 4800, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_WARNING"] },
    { event: ADVISOR_EVENTS.TRIAL_START, personality: "stern", priority: 100, cooldownMs: Infinity, durationMs: 5200, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_START"] },
    { event: ADVISOR_EVENTS.TRIAL_END, personality: "stern", priority: 90, cooldownMs: Infinity, durationMs: 4200, lineKeys: ["UI_ADVISOR_DIALOGUE_TRIAL_END"] },
    { event: ADVISOR_EVENTS.TRIAL_PLAN_CONFIRMED, personality: "stern", priority: 70, cooldownMs: 1000, durationMs: 3600, lineKeys: ["UI_ADVISOR_DIALOGUE_PLAN_CONFIRMED"] }
]);

export function findAdvisorDialogue(event, profile, database = ADVISOR_DIALOGUES) {
    return database.find(entry => entry.event === event && (!entry.personality || entry.personality === profile?.personality)) || null;
}
