function cloneData(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function trialResultEvents(events) {
    return events.filter(event => event?.type === "TRIAL_RESULT");
}

/**
 * Thin immutable read model over existing historical authorities.
 *
 * Chronicle remains the owner of Run/Trial/GE history. Board battle-site history
 * remains Board-owned and is accessed only through an injected query.
 */
export class RunHistoryReadModel {
    constructor({ chronicleSystem = null, boardHistoryQuery = null } = {}) {
        this.chronicleSystem = chronicleSystem;
        this.boardHistoryQuery = boardHistoryQuery;
    }

    _events() {
        const events = this.chronicleSystem?.getAllEvents?.();
        return Array.isArray(events) ? cloneData(events, []) : [];
    }

    getTrialCount() {
        return trialResultEvents(this._events()).length;
    }

    hasSurvivedTrial() {
        return trialResultEvents(this._events()).some(event => event?.meta?.outcome === "SURVIVED");
    }

    hasEventOccurred(eventId) {
        if (typeof eventId !== "string" || eventId.length === 0) return false;
        return this._events().some(event => event?.type === "GLOBAL_EVENT" && event?.id === eventId);
    }

    damageTakenInLastTrial(minimum = 1) {
        const trials = trialResultEvents(this._events());
        const last = trials[trials.length - 1] || null;
        const damage = Number(last?.meta?.totalEmberDamage) || 0;
        return damage >= Math.max(0, Number(minimum) || 0);
    }

    hasBattleSite(query = {}) {
        return this.boardHistoryQuery?.hasBattleSite?.(cloneData(query, {})) === true;
    }

    matches(requirement = {}) {
        switch (requirement.historyType || requirement.checkType || requirement.value) {
            case "TRIAL_SURVIVED":
            case "HAS_SURVIVED_TRIAL":
                return this.hasSurvivedTrial();
            case "TRIAL_COUNT_AT_LEAST":
                return this.getTrialCount() >= Math.max(1, Math.floor(Number(requirement.count ?? requirement.minimum ?? requirement.threshold) || 1));
            case "EVENT_OCCURRED":
                return this.hasEventOccurred(requirement.eventId);
            case "DAMAGE_TAKEN_IN_LAST_TRIAL":
                return this.damageTakenInLastTrial(requirement.minimum ?? 1);
            case "HAS_BATTLE_SITE":
                return this.hasBattleSite(requirement);
            default:
                return false;
        }
    }
}

export default RunHistoryReadModel;
