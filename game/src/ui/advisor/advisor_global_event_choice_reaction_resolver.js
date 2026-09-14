import {
    ADVISOR_GLOBAL_EVENT_CHOICE_REACTIONS,
    ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS
} from './advisor_global_event_choice_reactions.js';

function valuesMatch(expected = {}, actual = {}) {
    return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

function includesAny(haystack = [], needles = []) {
    if (!Array.isArray(haystack) || !Array.isArray(needles) || needles.length === 0) return true;
    const set = new Set(haystack);
    return needles.some(value => set.has(value));
}

function includesAll(haystack = [], needles = []) {
    if (!Array.isArray(haystack) || !Array.isArray(needles) || needles.length === 0) return true;
    const set = new Set(haystack);
    return needles.every(value => set.has(value));
}

function matchesRule(rule, { choiceId, publicContext, publicOutcomeTags }) {
    if (rule.choiceId && rule.choiceId !== choiceId) return false;
    if (rule.when && !valuesMatch(rule.when, publicContext)) return false;
    if (rule.whenVisibleFactsAny && !includesAny(publicContext?.visibleFacts, rule.whenVisibleFactsAny)) return false;
    if (rule.whenVisibleFactsAll && !includesAll(publicContext?.visibleFacts, rule.whenVisibleFactsAll)) return false;
    if (rule.whenPublicOutcomeTagsAny && !includesAny(publicOutcomeTags, rule.whenPublicOutcomeTagsAny)) return false;
    if (rule.whenPublicOutcomeTagsAll && !includesAll(publicOutcomeTags, rule.whenPublicOutcomeTagsAll)) return false;
    return true;
}

export function resolveAdvisorGlobalEventChoiceReaction({
    eventId,
    personality,
    timing,
    choiceId = null,
    publicContext = {},
    publicOutcomeTags = []
} = {}) {
    if (!eventId || !personality || !timing) return null;
    if (!Object.values(ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS).includes(timing)) return null;

    const rules = ADVISOR_GLOBAL_EVENT_CHOICE_REACTIONS[eventId]?.[personality]?.[timing];
    if (!Array.isArray(rules) || rules.length === 0) return null;

    const matched = rules
        .filter(rule => matchesRule(rule, { choiceId, publicContext, publicOutcomeTags }))
        .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0];

    if (!matched?.lineKey) return null;

    return Object.freeze({
        event: `GLOBAL_EVENT_CHOICE_${timing}`,
        topic: "global_event_choice",
        focus: matched.focus || null,
        lineKey: matched.lineKey,
        priority: Number(matched.priority || 0),
        durationMs: 4200,
        context: Object.freeze({
            eventId,
            choiceId,
            publicContext,
            publicOutcomeTags
        })
    });
}

export default resolveAdvisorGlobalEventChoiceReaction;
