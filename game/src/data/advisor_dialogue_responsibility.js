import { ADVISOR_SCENES } from "./advisor_scene_catalog.js";

// Presentation-only ownership for Advisor speech.
// This classifies who may speak about an already-established fact.
// It must never alter GameState, rules, information unlocks, RNG, rewards, or available actions.
export const ADVISOR_DIALOGUE_CHANNELS = Object.freeze({
    ADVICE: "ADVICE",
    REACTION: "REACTION",
    DUTY: "DUTY",
    AMBIENT: "AMBIENT",
    SILENT: "SILENT"
});

export const ADVISOR_POLICY_KEYS = Object.freeze([
    "defense",
    "survival",
    "logistics",
    "ember",
    "connection",
    "development",
    "economy",
    "mysticism"
]);

const advice = policyKey => Object.freeze({ channel: ADVISOR_DIALOGUE_CHANNELS.ADVICE, policyKey });
const reaction = fallbackChannel => Object.freeze({
    channel: ADVISOR_DIALOGUE_CHANNELS.REACTION,
    fallbackChannel: fallbackChannel || null
});
const duty = () => Object.freeze({ channel: ADVISOR_DIALOGUE_CHANNELS.DUTY, policyKey: null });
const ambient = () => Object.freeze({ channel: ADVISOR_DIALOGUE_CHANNELS.AMBIENT, policyKey: null });
const silent = () => Object.freeze({ channel: ADVISOR_DIALOGUE_CHANNELS.SILENT, policyKey: null });

// Semantic Advisor event ownership. Reaction-owned events may retain a Duty fallback
// for characters without a character-specific reaction line.
export const ADVISOR_EVENT_RESPONSIBILITY = Object.freeze({
    GAME_START: ambient(),
    TURN_START: silent(),
    TRIAL_WARNING: reaction(ADVISOR_DIALOGUE_CHANNELS.DUTY),
    TRIAL_START: duty(),
    TRIAL_END: duty(),
    TRIAL_PLAN_CONFIRMED: reaction(ADVISOR_DIALOGUE_CHANNELS.DUTY),
    ASSESSMENT: duty(),
    STAGE_PRELUDE: duty(),

    EMBER_WARNING: advice("ember"),
    EMBER_CRITICAL: advice("ember"),
    EMBER_RECOVERED: advice("ember"),

    FOOD_WARNING: advice("logistics"),
    FOOD_CRITICAL: advice("logistics"),
    FOOD_RECOVERED: advice("logistics"),

    DEFENSE_WEAK: advice("defense"),
    DEFENSE_CRITICAL: advice("defense"),
    DEFENSE_HEALTHY: advice("defense"),

    FIRST_ZONE_COMPLETED: advice("development"),
    ZONE_COMPLETED: advice("development"),
    FIRST_LINK_COMPLETED: advice("connection"),
    LINK_COMPLETED: advice("connection"),
    BOARD_FRAGMENTED: advice("connection"),
    CONNECTION_HEALTHY: advice("connection"),
    MAJOR_DEVELOPMENT: advice("development"),

    STABLE_OVERALL: advice("survival"),
    GENERAL_AMBIENT: ambient(),
    MILITARY_ACTION: advice("defense"),
    GLOBAL_EVENT_SURVIVAL: advice("survival")
});

// Scene ownership is separate from Advice depth. Missing Reaction data means intentional silence.
export const ADVISOR_SCENE_RESPONSIBILITY = Object.freeze({
    [ADVISOR_SCENES.SEVERAL_LANDS_PLACED]: silent(),
    [ADVISOR_SCENES.LARGE_EXPANSION]: reaction(),
    [ADVISOR_SCENES.FOOD_CRITICAL]: advice("logistics"),
    [ADVISOR_SCENES.REFUGEES_FOUND]: reaction(),
    [ADVISOR_SCENES.CIVILIANS_LOST]: reaction(),
    [ADVISOR_SCENES.TRIAL_WARNING]: reaction(),
    [ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED]: reaction(),
    [ADVISOR_SCENES.TRIAL_REGION_ABANDONED]: reaction(),
    [ADVISOR_SCENES.TRIAL_PREPARED_DEFENSE_SUCCESS]: reaction(),
    [ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED]: reaction(),
    [ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED]: reaction(),
    [ADVISOR_SCENES.TRIAL_PYRRHIC_VICTORY]: reaction(),
    [ADVISOR_SCENES.TRIAL_VICTORY_WITH_CIVILIAN_LOSS]: reaction(),
    [ADVISOR_SCENES.TRIAL_DESPERATE_STAND_SUCCESS]: reaction(),
    [ADVISOR_SCENES.TRIAL_COMPLETED]: reaction(),
    // Post-Trial interlude: immediate survival Reaction has already happened.
    // These scenes advance from factual report -> interpretation -> transition -> new-state Reaction.
    [ADVISOR_SCENES.ASSESSMENT]: duty(),
    [ADVISOR_SCENES.TRIAL_MEANING]: reaction(),
    [ADVISOR_SCENES.STAGE_PRELUDE]: duty(),
    [ADVISOR_SCENES.POST_STAGE_COMMENT]: reaction(),
    [ADVISOR_SCENES.THIRD_TRIAL_VICTORY]: reaction(),
    [ADVISOR_SCENES.RUN_CLEAR]: reaction(),
    [ADVISOR_SCENES.GAME_OVER]: reaction()
});

export function getAdvisorEventResponsibility(event) {
    return ADVISOR_EVENT_RESPONSIBILITY[event] || null;
}

export function getAdvisorSceneResponsibility(scene) {
    return ADVISOR_SCENE_RESPONSIBILITY[scene] || null;
}
