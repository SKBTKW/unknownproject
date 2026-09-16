/* =============================================================
   game/src/data/global_event_choices.js
   選択型Global Eventの宣言的データ。
   Advisor個性・Trial hidden truth・Presentationは保持しない。
   ============================================================= */

export const GLOBAL_EVENT_CHOICE_IDS = Object.freeze({
    CAPTURED_SCOUT: "EVENT_CAPTURED_SCOUT"
});

export const GLOBAL_EVENT_CAPTURE_ZONES = Object.freeze({
    OUTER: "OUTER",
    MID: "MID",
    INNER: "INNER"
});

export const GLOBAL_EVENT_CIVILIAN_MOODS = Object.freeze({
    CALM: "CALM",
    UNEASY: "UNEASY",
    ANGRY: "ANGRY"
});

export const GLOBAL_EVENT_VISIBLE_FACTS = Object.freeze({
    NEAR_MAIN_ROAD: "NEAR_MAIN_ROAD",
    WATCHTOWER_SEEN: "WATCHTOWER_SEEN",
    EXPERIENCED_SCOUT: "EXPERIENCED_SCOUT",
    MAP_FRAGMENT_FOUND: "MAP_FRAGMENT_FOUND",
    LIGHTLY_EQUIPPED: "LIGHTLY_EQUIPPED",
    WOUNDED: "WOUNDED"
});

export const GLOBAL_EVENT_CHOICE_MASTER = Object.freeze([
    Object.freeze({
        id: GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT,
        category: "JUDGMENT",
        importance: "MAJOR",
        nameKey: "EVENT_CAPTURED_SCOUT_NAME",
        descKey: "EVENT_CAPTURED_SCOUT_DESC",
        contextSchema: Object.freeze({
            captureZone: Object.freeze(Object.values(GLOBAL_EVENT_CAPTURE_ZONES)),
            visibleFacts: "STRING_ARRAY",
            civilianMood: Object.freeze(Object.values(GLOBAL_EVENT_CIVILIAN_MOODS)),
            publicEnemyTraits: "STRING_ARRAY_OPTIONAL",
            alertState: "STRING_OPTIONAL"
        }),
        choices: Object.freeze([
            Object.freeze({
                id: "EXECUTE",
                labelKey: "EVENT_CAPTURED_SCOUT_CHOICE_EXECUTE",
                resultKey: "EVENT_CAPTURED_SCOUT_RESULT_EXECUTE",
                publicOutcomeTags: Object.freeze([
                    "INFORMATION_LEAK_PREVENTED",
                    "RETALIATION_RISK"
                ])
            }),
            Object.freeze({
                id: "INTERROGATE",
                labelKey: "EVENT_CAPTURED_SCOUT_CHOICE_INTERROGATE",
                resultKey: "EVENT_CAPTURED_SCOUT_RESULT_INTERROGATE",
                publicOutcomeTags: Object.freeze([
                    "INTEL_OPPORTUNITY",
                    "CAPTIVE_REMAINS"
                ])
            }),
            Object.freeze({
                id: "RELEASE",
                labelKey: "EVENT_CAPTURED_SCOUT_CHOICE_RELEASE",
                resultKey: "EVENT_CAPTURED_SCOUT_RESULT_RELEASE",
                publicOutcomeTags: Object.freeze([
                    "DEESCALATION_POSSIBLE",
                    "INFORMATION_LEAK_RISK"
                ])
            })
        ])
    })
]);

export function findGlobalEventChoiceDefinition(eventId) {
    return GLOBAL_EVENT_CHOICE_MASTER.find(def => def.id === eventId) || null;
}

export default GLOBAL_EVENT_CHOICE_MASTER;
