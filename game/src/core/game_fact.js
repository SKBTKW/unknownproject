export const GAME_FACT_TYPES = Object.freeze({
    VERSE_COMMITTED: "VERSE_COMMITTED",
    CIVILIZATION_DEVELOPMENT_CHANGED: "CIVILIZATION_DEVELOPMENT_CHANGED",
    TRIAL_THREAT_UPDATED: "TRIAL_THREAT_UPDATED",
    GLOBAL_EVENT_CHOICE_PRESENTED: "GLOBAL_EVENT_CHOICE_PRESENTED",
    GLOBAL_EVENT_CHOICE_RESOLVED: "GLOBAL_EVENT_CHOICE_RESOLVED",
    INVESTIGATION_RECORDED: "INVESTIGATION_RECORDED",
    WARNING_STATE_CHANGED: "WARNING_STATE_CHANGED",
    TRIAL_PLAN_CONFIRMED: "TRIAL_PLAN_CONFIRMED",
    TRIAL_PLAN_ACTIVATED: "TRIAL_PLAN_ACTIVATED",
    TRIAL_BATTLE_STARTED: "TRIAL_BATTLE_STARTED",
    TRIAL_BATTLE_RESOLVED: "TRIAL_BATTLE_RESOLVED",
    TRIAL_TRAVERSAL_RESOLVED: "TRIAL_TRAVERSAL_RESOLVED",
    TRIAL_BATTLE_SEQUENCE_ADVANCED: "TRIAL_BATTLE_SEQUENCE_ADVANCED",
    TRIAL_HQ_DAMAGE_RESOLVED: "TRIAL_HQ_DAMAGE_RESOLVED",
    TRIAL_COMPLETED: "TRIAL_COMPLETED",
    TRIAL_RESULT_SETTLED: "TRIAL_RESULT_SETTLED",
    TRIAL_EXIT_READY: "TRIAL_EXIT_READY",
    TRIAL_INTERCEPTION_PLANNED: "TRIAL_INTERCEPTION_PLANNED",
    TRIAL_ROUTE_SKIPPED: "TRIAL_ROUTE_SKIPPED"
});

function clonePayload(payload) {
    return payload == null ? {} : JSON.parse(JSON.stringify(payload));
}

export class GameFactHub {
    constructor() {
        this.listeners = new Set();
        this.facts = [];
    }

    emit(type, payload = {}) {
        const fact = Object.freeze({ type, payload: clonePayload(payload) });
        this.facts.push(fact);
        this.listeners.forEach(listener => listener(fact));
        return fact;
    }

    subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("GAME_FACT_LISTENER_REQUIRED");
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getFacts() {
        return [...this.facts];
    }
}
