import { ADVISOR_SEVERITY, ADVISOR_TOPICS } from './advisor_peace_state_resolver.js';

const SEVERITY_BY_STATE = Object.freeze({
    EMBER_WARNING: 2, EMBER_CRITICAL: 3, FOOD_WARNING: 2, FOOD_CRITICAL: 3,
    DEFENSE_WEAK: 2, DEFENSE_CRITICAL: 3
});

function policyValue(profile, topic) {
    const sourceTopic = topic === ADVISOR_TOPICS.STABILITY ? ADVISOR_TOPICS.SURVIVAL : topic;
    const value = Number(profile?.policy?.[sourceTopic]);
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(4, Math.trunc(value)));
}

// Policy is presentation-only attention. It controls whether the Advisor comments, never the game result.
// 1 = low attention, 2 = baseline, 3 = elevated, 4 = defining attention.
function attentionAllows(candidate, silenceTurns, profile, worsened = false) {
    const policy = policyValue(profile, candidate.topic);
    if (candidate.severity >= ADVISOR_SEVERITY.CRITICAL) return true;
    if (policy <= 1) return false;
    if (worsened && candidate.severity >= ADVISOR_SEVERITY.WARNING) return true;
    if (candidate.severity >= ADVISOR_SEVERITY.WARNING) {
        if (policy >= 4) return silenceTurns >= 2;
        if (policy >= 3) return silenceTurns >= 3;
        return silenceTurns >= 4;
    }
    if (policy >= 4) return silenceTurns >= 4;
    return policy >= 3 && silenceTurns >= 6;
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
        let candidates = changed.filter(candidate =>
            attentionAllows(candidate, silenceTurns, profile, isWorsened(candidate, runtime))
        );
        if (!candidates.length && silenceTurns >= 2) {
            candidates = states.filter(candidate =>
                !runtime.wasTopicRecent(candidate.topic, turn, this.recentTopicWindow)
                && attentionAllows(candidate, silenceTurns, profile, false)
            );
        }
        runtime.updateResolvedStates(states);
        if (!candidates.length) return null;
        const scored = candidates.map(candidate => ({
            ...candidate,
            score: candidate.severity * 20 + policyValue(profile, candidate.topic) * 5
                - (runtime.wasTopicRecent(candidate.topic, turn, this.recentTopicWindow) ? 5 : 0)
        }));
        const maxScore = Math.max(...scored.map(candidate => candidate.score));
        const tied = scored.filter(candidate => candidate.score === maxScore);
        return tied[Math.min(tied.length - 1, Math.floor(this.rng() * tied.length))];
    }

    evaluateMilestone(type, runtime) {
        if (type === "ZONE_COMPLETED") {
            if (!runtime.firstZoneReacted) { runtime.firstZoneReacted = true; return { id: "FIRST_ZONE_COMPLETED", topic: ADVISOR_TOPICS.DEVELOPMENT, severity: 1 }; }
            return { id: "ZONE_COMPLETED", topic: ADVISOR_TOPICS.DEVELOPMENT, severity: 1 };
        }
        if (type === "LINK_COMPLETED") {
            if (!runtime.firstLinkReacted) { runtime.firstLinkReacted = true; return { id: "FIRST_LINK_COMPLETED", topic: ADVISOR_TOPICS.CONNECTION, severity: 1 }; }
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
        const normalized = `${event?.category || ""} ${event?.eventId || event?.id || ""}`.toUpperCase();
        if (!/(PLAGUE|FAMINE|WAR|RAID|SCOUT|COLD|DROUGHT|DISASTER|SURVIVAL|MILITARY|THREAT)/.test(normalized)) return null;
        if (runtime.recentGlobalEventCategories.some(item => item.category === normalized && turn - item.turn <= 3)) return null;
        runtime.recentGlobalEventCategories.unshift({ category: normalized, turn });
        runtime.recentGlobalEventCategories = runtime.recentGlobalEventCategories.slice(0, 6);
        return { id: "GLOBAL_EVENT_SURVIVAL", topic: ADVISOR_TOPICS.SURVIVAL, severity: 2 };
    }
}
