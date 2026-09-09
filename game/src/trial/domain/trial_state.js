import { TRIAL_PHASES } from "./trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export class TrialState {
    constructor(scenario = {}) {
        this.phase = TRIAL_PHASES.SETUP;
        this.scenarioId = scenario.id || null;
        this.enemy = {
            strategicSuppression: Number(scenario.enemySuppression) || 0,
            totalSuppression: 0,
            commander: cloneData(scenario.commander) || null,
            forces: cloneData(scenario.forces) || []
        };
        this.routes = cloneData(scenario.routes) || [];
        this.interceptions = [];
        this.interceptionPlan = null;
        this.planActivated = false;
        this.battleQueue = null;
        this.currentBattleIndex = null;
        this.battleResults = null;
        this.routeProgress = {};
        this.traversalResults = null;
        this.human = {
            defense: Math.max(0, Number(scenario.availableDefense) || 0),
            availableDefense: Math.max(0, Number(scenario.availableDefense) || 0),
            mystic: Math.max(0, Number(scenario.mystic) || 0)
        };
        this.environment = cloneData(scenario.environment) || {};
        this.result = null;
    }

    getCurrentBattle() {
        if (!Array.isArray(this.battleQueue) || this.currentBattleIndex === null) {
            return null;
        }
        const item = this.battleQueue[this.currentBattleIndex];
        return item ? cloneData(item) : null;
    }

    getBattleResults() {
        return this.battleResults ? cloneData(this.battleResults) : null;
    }

    getCurrentBattleResult() {
        if (!Array.isArray(this.battleResults) || this.currentBattleIndex === null) {
            return null;
        }
        const res = this.battleResults[this.currentBattleIndex];
        return res ? cloneData(res) : null;
    }

    getRouteProgress(routeId) {
        if (!this.routeProgress) return null;
        if (routeId) {
            return this.routeProgress[routeId] ? cloneData(this.routeProgress[routeId]) : null;
        }
        return cloneData(this.routeProgress);
    }

    getTraversalResults() {
        return this.traversalResults ? cloneData(this.traversalResults) : null;
    }

    getCurrentTraversalResult() {
        if (!Array.isArray(this.traversalResults) || this.currentBattleIndex === null) {
            return null;
        }
        const res = this.traversalResults[this.currentBattleIndex];
        return res ? cloneData(res) : null;
    }

    isCurrentTraversalApplied() {
        if (!Array.isArray(this.traversalResults) || this.currentBattleIndex === null) {
            return false;
        }
        return Boolean(this.traversalResults[this.currentBattleIndex]);
    }
}

export function createTrialState(scenario) {
    return new TrialState(scenario);
}
