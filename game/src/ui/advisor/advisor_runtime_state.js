export class AdvisorRuntimeState {
    constructor(snapshot = {}) {
        this.lastSpokenTurn = Number.isFinite(snapshot.lastSpokenTurn) ? snapshot.lastSpokenTurn : null;
        this.silenceTurns = Number.isFinite(snapshot.silenceTurns) ? snapshot.silenceTurns : 0;
        this.recentTopics = Array.isArray(snapshot.recentTopics) ? [...snapshot.recentTopics] : [];
        this.recentGlobalEventCategories = Array.isArray(snapshot.recentGlobalEventCategories) ? [...snapshot.recentGlobalEventCategories] : [];
        this.reactedActionTypes = new Set(snapshot.reactedActionTypes || []);
        this.firstZoneReacted = Boolean(snapshot.firstZoneReacted);
        this.firstLinkReacted = Boolean(snapshot.firstLinkReacted);
        this.previousResolvedStates = new Map(snapshot.previousResolvedStates || []);
    }

    getSilenceTurns(turn) {
        if (this.lastSpokenTurn === null) return Number.POSITIVE_INFINITY;
        return Math.max(0, Number(turn || 0) - this.lastSpokenTurn);
    }

    wasTopicRecent(topic, turn, windowTurns = 3) {
        return this.recentTopics.some(item => item.topic === topic && Number(turn) - item.turn <= windowTurns);
    }

    recordSpeech(topic, turn) {
        this.lastSpokenTurn = Number(turn || 0);
        this.silenceTurns = 0;
        this.recentTopics.unshift({ topic, turn: this.lastSpokenTurn });
        this.recentTopics = this.recentTopics.slice(0, 8);
    }

    advanceTurn(turn) {
        this.silenceTurns = this.getSilenceTurns(turn);
    }

    updateResolvedStates(states = []) {
        this.previousResolvedStates = new Map(states.map(state => [state.topic, state.id]));
    }

    toPersistentState() {
        return { lastSpokenTurn: this.lastSpokenTurn, silenceTurns: this.silenceTurns };
    }
}
