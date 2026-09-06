import { isDevelopmentMode } from "../../config/dev_mode.js";
import { getTrialPreviewScenario } from "./trial_preview_scenarios.js";

function createCell(r, c) {
    return {
        r,
        c,
        placed: false,
        isHQ: false,
        hasSocket: false,
        terrain: null,
        socketResource: null,
        mergeGroupId: null,
        placementGroupId: null,
        merged: false
    };
}

function createScenarioGrid(scenario) {
    const size = scenario.stage === 1 ? 5 : 5;
    const grid = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => createCell(r, c))
    );
    scenario.route.forEach(entry => {
        Object.assign(grid[entry.r][entry.c], {
            placed: true,
            terrain: { ...entry.terrain }
        });
    });
    Object.assign(grid[size - 1][size - 1], { placed: true, isHQ: true });
    return grid;
}

export class DevelopmentTrialPreviewHarness {
    constructor(uiController, { devModeResolver = isDevelopmentMode } = {}) {
        this.ui = uiController;
        this.devModeResolver = devModeResolver;
        this.session = null;
    }

    isAvailable() {
        return this.devModeResolver() === true;
    }

    isActive() {
        return this.session !== null;
    }

    start(scenarioId = "TERRAIN_COMPARE_BASIC") {
        if (!this.isAvailable()) return { success: false, reason: "DEV_MODE_REQUIRED" };
        const scenarioDefinition = getTrialPreviewScenario(scenarioId);
        if (!scenarioDefinition) return { success: false, reason: "DEV_TRIAL_SCENARIO_NOT_FOUND" };

        const scenario = {
            id: scenarioDefinition.id,
            enemySuppression: scenarioDefinition.enemySuppression,
            availableDefense: scenarioDefinition.availableDefense,
            routes: [{
                id: scenarioDefinition.routeId,
                cells: scenarioDefinition.route.map(({ r, c }) => ({ r, c }))
            }]
        };
        this.session = {
            definition: scenarioDefinition,
            displayGrid: createScenarioGrid(scenarioDefinition)
        };
        this.ui.startTrialInterceptionPreview(scenario, {
            deployedDefense: scenarioDefinition.deployedDefense,
            routeId: scenarioDefinition.routeId
        });
        return { success: true, scenarioId: scenarioDefinition.id };
    }

    stop() {
        if (!this.session) return false;
        this.session = null;
        this.ui.stopTrialInterceptionPreview();
        return true;
    }

    getDisplayGrid() {
        return this.session?.displayGrid || null;
    }
}
