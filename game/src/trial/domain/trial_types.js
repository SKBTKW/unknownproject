export const TRIAL_PHASES = Object.freeze({
    SETUP: "SETUP",
    DEPLOYMENT: "DEPLOYMENT",
    BATTLE: "BATTLE",
    RESULT: "RESULT"
});

export const MODIFIER_PHASES = Object.freeze({
    DEPLOYMENT_LIMIT: 100,
    MULTIPLIER: 200
});

export const MODIFIER_TARGETS = Object.freeze({
    HUMAN_INTERCEPTION: "HUMAN_INTERCEPTION",
    ENEMY_SUPPRESSION: "ENEMY_SUPPRESSION"
});

export const MODIFIER_OPERATIONS = Object.freeze({
    LIMIT_OVERFLOW: "LIMIT_OVERFLOW",
    MULTIPLY: "MULTIPLY"
});

export const TRIAL_TERRAIN_EFFECTS = Object.freeze({
    FOREST_DEPLOYMENT: "FOREST_DEPLOYMENT",
    DEEP_FOREST_DEPLOYMENT: "DEEP_FOREST_DEPLOYMENT",
    WETLAND_EXIT: "WETLAND_EXIT",
    DESERT_EXIT: "DESERT_EXIT",
    HIGH_GROUND: "HIGH_GROUND"
});

export const DEFAULT_TRIAL_RULES = Object.freeze({
    defenseConversionRate: 5,
    suppressionConversionRate: 5,
    highGroundMultiplier: 1.2,
    wetlandExitMultiplier: 0.8,
    desertExitMultiplier: 0.9,
    forestDeployment: Object.freeze({ threshold: 40, overflowEfficiency: 0.5 }),
    // Phase 1検証用の注入可能な仮値。確定バランス値ではない。
    deepForestDeployment: Object.freeze({ threshold: 30, overflowEfficiency: 0.35 })
});

