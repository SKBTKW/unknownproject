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
        this.human = {
            defense: Math.max(0, Number(scenario.availableDefense) || 0),
            availableDefense: Math.max(0, Number(scenario.availableDefense) || 0),
            mystic: Math.max(0, Number(scenario.mystic) || 0)
        };
        this.environment = cloneData(scenario.environment) || {};
        this.result = null;
    }
}

export function createTrialState(scenario) {
    return new TrialState(scenario);
}
