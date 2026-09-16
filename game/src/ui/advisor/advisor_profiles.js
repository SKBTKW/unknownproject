import { STAFF_OFFICER_REACTIONS } from '../../data/advisor_staff_officer_reactions.js';
import { STAFF_OFFICER_DIALOGUES } from '../../data/advisor_staff_officer_dialogues.js';
import { createAdvisorCharacterDefinition } from './advisor_character_contract.js';

const ADVISOR_ASSET_BASE = '../../../assets/advisor/';
const advisorAsset = (fileName, revision) => {
    const url = new URL(`${ADVISOR_ASSET_BASE}${fileName}`, import.meta.url);
    url.searchParams.set("v", revision);
    return url.href;
};

// Keep asset revisions explicit so browser/GitHub Pages caches do not retain replaced portraits.
const GENERAL_OLD_01_ASSET_REVISION = "b380df9";

const GENERAL_OLD_01 = createAdvisorCharacterDefinition({
    id: "general_old_01",
    archetype: "veteran_general",
    displayNameKey: "UI_ADVISOR_PROFILE_GENERAL_OLD",
    portraits: {
        normal: advisorAsset("advisor01.png", GENERAL_OLD_01_ASSET_REVISION),
        expanded: advisorAsset("advisor01.png", GENERAL_OLD_01_ASSET_REVISION),
        collapsed: advisorAsset("advisor01_small.png", GENERAL_OLD_01_ASSET_REVISION)
    },
    personality: "stern",
    policy: {
        ember: 4,
        survival: 4,
        logistics: 4,
        defense: 4,
        connection: 3,
        development: 2,
        economy: 2,
        mysticism: 1
    },
    personalityTraits: {
        caution: 4,
        severity: 3,
        empathy: 3,
        pragmatism: 4,
        praiseTendency: 1,
        optimism: 1,
        mysticismAffinity: 1,
        militaryDirectness: 4
    },
    speechStyle: {
        tone: "military",
        verbosity: "short",
        formality: "high",
        emotionality: "low",
        assertiveness: "medium_high",
        metaphorUsage: "low",
        humor: "none"
    },
    characterRules: {
        respectsPlayerAuthority: true,
        avoidsScolding: true,
        avoidsOverpraise: true,
        avoidsOptimalPlayCommands: true,
        crisisBecomesMoreDirect: true,
        speaksFromObservedConditions: true,
        usesSystemTermsSparingly: true,
        neverSaysEmberNarrativeName: true,
        preferredFrames: Object.freeze([
            "survival",
            "preparation",
            "sustainability",
            "logistics",
            "defense"
        ]),
        dislikedFrames: Object.freeze([
            "reckless_optimism",
            "glory_for_glory",
            "mystical_certainty"
        ]),
        lexicalPreferences: Object.freeze([
            "備え",
            "持つ",
            "余裕",
            "立て直す",
            "今のうちに",
            "ひとまず"
        ]),
        lexicalAvoid: Object.freeze([
            "素晴らしい",
            "完璧",
            "絶対",
            "奇跡",
            "運命"
        ])
    },
    reactions: {},
    adviceDialogue: {},
    dutyDialogue: {},
    initialSkills: []
});

const STAFF_OFFICER_FEMALE_01 = createAdvisorCharacterDefinition({
    id: "staff_officer_female_01",
    archetype: "staff_officer",
    // Reuse the existing generic military-advisor label until character-specific naming is introduced in i18n.
    displayNameKey: "UI_ADVISOR_PROFILE_GENERAL_OLD",
    portraits: {},
    // Current legacy dialogue is keyed by personality. Keeping the shared military personality here
    // allows both characters to use the same mandatory/legacy dialogue path while character reactions differ by data.
    personality: "stern",
    policy: {
        ember: 4,
        survival: 4,
        logistics: 4,
        defense: 4,
        connection: 3,
        development: 2,
        economy: 2,
        mysticism: 1
    },
    personalityTraits: {
        caution: 4,
        severity: 4,
        empathy: 4,
        pragmatism: 4,
        praiseTendency: 1,
        optimism: 1,
        mysticismAffinity: 1,
        militaryDirectness: 3
    },
    speechStyle: {
        tone: "military",
        verbosity: "short",
        formality: "high",
        emotionality: "low",
        assertiveness: "medium",
        metaphorUsage: "low",
        humor: "none"
    },
    characterRules: {
        respectsPlayerAuthority: true,
        avoidsScolding: true,
        avoidsOverpraise: true,
        avoidsOptimalPlayCommands: true,
        crisisBecomesMoreDirect: true,
        speaksFromObservedConditions: true,
        usesSystemTermsSparingly: true,
        neverSaysEmberNarrativeName: true,
        preferredFrames: Object.freeze([
            "logistics",
            "discipline",
            "civilian_safety",
            "preparation",
            "defense"
        ]),
        dislikedFrames: Object.freeze([
            "reckless_optimism",
            "glory_for_glory",
            "mystical_certainty"
        ]),
        lexicalPreferences: Object.freeze([
            "報告",
            "確認",
            "備蓄",
            "損耗",
            "維持",
            "撤収",
            "配置",
            "必要"
        ]),
        lexicalAvoid: Object.freeze([
            "素晴らしい",
            "完璧",
            "絶対",
            "奇跡",
            "運命",
            "栄光"
        ])
    },
    reactions: STAFF_OFFICER_REACTIONS.reactions,
    adviceDialogue: STAFF_OFFICER_DIALOGUES,
    dutyDialogue: {},
    initialSkills: []
});

export const ADVISOR_CHARACTERS = Object.freeze({
    GENERAL_OLD_01,
    STAFF_OFFICER_FEMALE_01
});

export const DEFAULT_ADVISOR_CHARACTER = ADVISOR_CHARACTERS.GENERAL_OLD_01;

// Backward-compatible aliases. Existing consumers can migrate from profile to character terminology incrementally.
export const ADVISOR_PROFILES = ADVISOR_CHARACTERS;
export const DEFAULT_ADVISOR_PROFILE = DEFAULT_ADVISOR_CHARACTER;
