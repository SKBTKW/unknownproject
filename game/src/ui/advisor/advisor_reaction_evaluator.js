import { ADVISOR_SEVERITY, ADVISOR_TOPICS } from './advisor_peace_state_resolver.js';

const SEVERITY_BY_STATE = Object.freeze({
    EMBER_WARNING: 2, EMBER_CRITICAL: 3, FOOD_WARNING: 2, FOOD_CRITICAL: 3,
    DEFENSE_WEAK: 2, DEFENSE_CRITICAL: 3
});

function policyValue(profile, topic) { return Number(profile?.policy?.[topic] || 0); }

function silenceAllows(candidate, silenceTurns, profile) {
    if (silenceTurns <= 1) return candidate.severity >= ADVISOR_SEVERITY.CRITICAL;
    if (silenceTurns <= 3) return candidate.severity >= ADVISOR_SEVERITY.WARNING;
    if (silenceTurns <= 5) return candidate.severity >= ADVISOR_SEVERITY.WARNING || policyValue(profile, candidate.topic) >= 4;
    return candidate.severity >= ADVISOR_SEVERITY.WARNING || policyValue(profile, candidate.topic) >= 3 || candidate.topic === ADVISOR_TOPICS.STABILITY;
}

function isWorsened(candidate, runtime) {
    const previousId = runtime.previousResolvedStates.get(candidate.topic);
    return Boolean(previousId && previousId !== candidate.id && candidate.severity > (SEVERITY_BY_STATE[previousId] || 1));
}

export class AdvisorReactionEvaluator {
    constructor({ recentTopicWindow = 3, rng = Math.random } = {}) { this.recentTopicWindow = recentTopicWindow; this.rng = rng; }

    evaluateTurn({ states = [], runtime, profile, turn, peaceActive = true } = {}) {
        if (!peaceActive || !runtime) return null;
        runtime.advanceTurn(turn);
        const silenceTurns = runtime.getSilenceTurns(turn);
        const changed = states.filter(state => runtime.previousResolvedStates.get(state.topic) !== state.id);
        const emberState = states.find(state => state.topic === ADVISOR_TOPICS.EMBER);
        const emberChanged = changed.find(state => state.topic === ADVISOR_TOPICS.EMBER);
        let candidates = emberState ? (emberChanged || silenceTurns >= 6 ? [emberState] : []) : changed;
        candidates = candidates.filter(candidate => isWorsened(candidate, runtime) || silenceAllows(candidate, silenceTurns, profile));
        if (!candidates.length && silenceTurns >= 6) {
            candidates = states.filter(candidate => policyValue(profile, candidate.topic) >= 3 || candidate.topic === ADVISOR_TOPICS.STABILITY);
        }
        runtime.updateResolvedStates(states);
        if (!candidates.length) return null;
        const scored = candidates.map(candidate => ({
            ...candidate,
            score: (candidate.topic === ADVISOR_TOPICS.EMBER ? 100 : policyValue(profile, candidate.topic) * 10)
                - (runtime.wasTopicRecent(candidate.topic, turn, this.recentTopicWindow) ? 5 : 0) + candidate.severity
        }));
        const maxScore = Math.max(...scored.map(candidate => candidate.score));
        const tied = scored.filter(candidate => candidate.score === maxScore);
        return tied[Math.min(tied.length - 1, Math.floor(this.rng() * tied.length))];
    }

    evaluateMilestone(type, runtime) {
        if (type === "ZONE_COMPLETED") {
            if (!runtime.firstZoneReacted) { runtime.firstZoneReacted = true; return { id: "FIRST_ZONE_COMPLETED", topic: ADVISOR_TOPICS.DEVELOPMENT, severity: 1, mandatory: true }; }
            return { id: "ZONE_COMPLETED", topic: ADVISOR_TOPICS.DEVELOPMENT, severity: 1 };
        }
        if (type === "LINK_COMPLETED") {
            if (!runtime.firstLinkReacted) { runtime.firstLinkReacted = true; return { id: "FIRST_LINK_COMPLETED", topic: ADVISOR_TOPICS.CONNECTION, severity: 1, mandatory: true }; }
            return { id: "LINK_COMPLETED", topic: ADVISOR_TOPICS.CONNECTION, severity: 1 };
        }
        return null;
    }

    evaluateMilitaryAction(actionType, runtime) {
        if (!actionType || runtime.reactedActionTypes.has(actionType)) return null;
        runtime.reactedActionTypes.add(actionType);
        return { id: "MILITARY_ACTION", topic: ADVISOR_TOPICS.DEFENSE, severity: 1, context: { actionType } };
    }

    evaluateGlobalEvent(event, runtime, turn) {
        const normalized = String(event?.category || event?.id || "").toUpperCase();
        if (!/(PLAGUE|FAMINE|WAR|RAID|SCOUT|COLD|DROUGHT|DISASTER|SURVIVAL|MILITARY|THREAT)/.test(normalized)) return null;
        if (runtime.recentGlobalEventCategories.some(item => item.category === normalized && turn - item.turn <= 3)) return null;
        runtime.recentGlobalEventCategories.unshift({ category: normalized, turn });
        runtime.recentGlobalEventCategories = runtime.recentGlobalEventCategories.slice(0, 6);
        return { id: "GLOBAL_EVENT_SURVIVAL", topic: ADVISOR_TOPICS.SURVIVAL, severity: 2 };
    }
}
