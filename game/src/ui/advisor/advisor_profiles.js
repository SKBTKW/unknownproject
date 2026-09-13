const ADVISOR_ASSET_BASE = '../../../assets/advisor/';
const advisorAsset = (fileName, revision) => {
    const url = new URL(`${ADVISOR_ASSET_BASE}${fileName}`, import.meta.url);
    url.searchParams.set("v", revision);
    return url.href;
};

// 画像を同名で差し替えた場合も、GitHub Pagesやブラウザに旧画像を再利用させない。
const GENERAL_OLD_01_ASSET_REVISION = "b380df9";

export const ADVISOR_PROFILES = Object.freeze({
    GENERAL_OLD_01: Object.freeze({
        id: "general_old_01",
        archetype: "veteran_general",
        displayNameKey: "UI_ADVISOR_PROFILE_GENERAL_OLD",
        portrait: advisorAsset("advisor01.png", GENERAL_OLD_01_ASSET_REVISION),
        portraitExpanded: advisorAsset("advisor01.png", GENERAL_OLD_01_ASSET_REVISION),
        portraitCollapsed: advisorAsset("advisor01_small.png", GENERAL_OLD_01_ASSET_REVISION),
        personality: "stern",
        policy: Object.freeze({
            ember: 4,
            survival: 4,
            logistics: 4,
            defense: 4,
            connection: 3,
            development: 2,
            economy: 2,
            mysticism: 1
        }),
        personalityTraits: Object.freeze({
            caution: 4,
            severity: 3,
            empathy: 3,
            pragmatism: 4,
            praiseTendency: 1,
            optimism: 1,
            mysticismAffinity: 1,
            militaryDirectness: 4
        }),
        speechStyle: Object.freeze({
            tone: "military",
            verbosity: "short",
            formality: "high",
            emotionality: "low",
            assertiveness: "medium_high",
            metaphorUsage: "low",
            humor: "none"
        }),
        characterRules: Object.freeze({
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
        })
    })
});

export const DEFAULT_ADVISOR_PROFILE = ADVISOR_PROFILES.GENERAL_OLD_01;
