export const ADVISOR_PROFILES = Object.freeze({
    GENERAL_OLD_01: Object.freeze({
        id: "general_old_01",
        archetype: "veteran_general",
        displayNameKey: "UI_ADVISOR_PROFILE_GENERAL_OLD",
        portrait: null,
        personality: "stern",
        policy: Object.freeze({ ember: 4, survival: 4, logistics: 4, defense: 4, connection: 3, development: 2, economy: 2, mysticism: 1 }),
        speechStyle: Object.freeze({ tone: "military", verbosity: "short", formality: "high", emotionality: "low" })
    })
});

export const DEFAULT_ADVISOR_PROFILE = ADVISOR_PROFILES.GENERAL_OLD_01;
