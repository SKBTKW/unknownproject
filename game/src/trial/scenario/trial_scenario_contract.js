export const TRIAL_SCENARIO_BUILD_REASONS = Object.freeze({
    TRIAL_INDEX_REQUIRED: "TRIAL_INDEX_REQUIRED",
    INVALID_TRIAL_INDEX: "INVALID_TRIAL_INDEX",
    GAME_STATE_REQUIRED: "GAME_STATE_REQUIRED",
    THREAT_UNRESOLVED: "THREAT_UNRESOLVED",
    INGRESS_RESOLVER_REQUIRED: "INGRESS_RESOLVER_REQUIRED",
    INGRESS_UNRESOLVED: "INGRESS_UNRESOLVED",
    ROUTE_GENERATOR_REQUIRED: "ROUTE_GENERATOR_REQUIRED",
    ROUTES_UNRESOLVED: "ROUTES_UNRESOLVED",
    HUMAN_STATE_UNRESOLVED: "HUMAN_STATE_UNRESOLVED"
});

export function validateTrialScenarioBuildInput({ trialIndex, gameState } = {}) {
    const errors = [];

    if (trialIndex === undefined || trialIndex === null) {
        errors.push(TRIAL_SCENARIO_BUILD_REASONS.TRIAL_INDEX_REQUIRED);
    } else if (!Number.isInteger(trialIndex) || trialIndex < 1 || trialIndex > 3) {
        errors.push(TRIAL_SCENARIO_BUILD_REASONS.INVALID_TRIAL_INDEX);
    }

    if (!gameState || typeof gameState !== "object") {
        errors.push(TRIAL_SCENARIO_BUILD_REASONS.GAME_STATE_REQUIRED);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
