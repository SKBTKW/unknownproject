export const ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS = Object.freeze({
    PRESENTED: "PRESENTED",
    RESOLVED: "RESOLVED"
});

export const ADVISOR_GLOBAL_EVENT_CHOICE_REACTIONS = Object.freeze({
    EVENT_CAPTURED_SCOUT: Object.freeze({
        stern: Object.freeze({
            PRESENTED: Object.freeze([
                Object.freeze({
                    priority: 110,
                    focus: "INTERROGATION_VALUE",
                    whenVisibleFactsAny: Object.freeze(["MAP_FRAGMENT_FOUND", "EXPERIENCED_SCOUT"]),
                    lineKey: "UI_ADVISOR_DIALOGUE_MILITARY_2"
                }),
                Object.freeze({
                    priority: 100,
                    focus: "INFORMATION_LEAK",
                    when: Object.freeze({ captureZone: "INNER" }),
                    lineKey: "UI_ADVISOR_DIALOGUE_GLOBAL_SURVIVAL_2"
                }),
                Object.freeze({
                    priority: 80,
                    focus: "CIVILIAN_PRESSURE",
                    when: Object.freeze({ civilianMood: "ANGRY" }),
                    lineKey: "UI_ADVISOR_DIALOGUE_AMBIENT_2"
                }),
                Object.freeze({
                    priority: 10,
                    focus: "BALANCED_CAUTION",
                    lineKey: "UI_ADVISOR_DIALOGUE_AMBIENT_1"
                })
            ]),
            RESOLVED: Object.freeze([
                Object.freeze({
                    priority: 100,
                    focus: "RETALIATION_RISK",
                    choiceId: "EXECUTE",
                    whenPublicOutcomeTagsAny: Object.freeze(["RETALIATION_RISK"]),
                    lineKey: "UI_ADVISOR_DIALOGUE_GLOBAL_SURVIVAL_2"
                }),
                Object.freeze({
                    priority: 100,
                    focus: "INTEL_OPPORTUNITY",
                    choiceId: "INTERROGATE",
                    whenPublicOutcomeTagsAny: Object.freeze(["INTEL_OPPORTUNITY"]),
                    lineKey: "UI_ADVISOR_DIALOGUE_MILITARY_2"
                }),
                Object.freeze({
                    priority: 100,
                    focus: "INFORMATION_LEAK_RISK",
                    choiceId: "RELEASE",
                    whenPublicOutcomeTagsAny: Object.freeze(["INFORMATION_LEAK_RISK"]),
                    lineKey: "UI_ADVISOR_DIALOGUE_AMBIENT_2"
                })
            ])
        })
    })
});

export default ADVISOR_GLOBAL_EVENT_CHOICE_REACTIONS;
