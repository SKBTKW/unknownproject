import { ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS } from './advisor_global_event_choice_reactions.js';

export const ADVISOR_GLOBAL_EVENT_PRESENTATION_MODES = Object.freeze({
    PERSONALITY: "PERSONALITY",
    NEUTRAL: "NEUTRAL"
});

export const ADVISOR_NEUTRAL_PERSONALITY = "neutral";

export const ADVISOR_GLOBAL_EVENT_NEUTRAL_REACTIONS = Object.freeze({
    EVENT_CAPTURED_SCOUT: Object.freeze({
        [ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED]: Object.freeze({
            focus: "FACT_ONLY",
            lineKey: "EVENT_CAPTURED_SCOUT_DESC",
            priority: 100
        }),
        [ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.RESOLVED]: Object.freeze({
            focus: "FACT_ONLY",
            lineKey: "EVENT_CAPTURED_SCOUT_RESULT_NEUTRAL",
            priority: 100
        })
    })
});

export function resolveNeutralGlobalEventReaction(eventId, timing) {
    const entry = ADVISOR_GLOBAL_EVENT_NEUTRAL_REACTIONS[eventId]?.[timing];
    if (!entry) return null;
    return Object.freeze({ ...entry });
}

export default ADVISOR_GLOBAL_EVENT_NEUTRAL_REACTIONS;
