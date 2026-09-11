import { isDevelopmentMode } from "../../config/dev_mode.js";
import { TrialRestoreBoundaryService } from "../../core/trial_restore_boundary_service.js";
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
    const cellsToPlace = [];
    if (Array.isArray(scenario.routes) && scenario.routes.length > 0) {
        scenario.routes.forEach(route => {
            const cells = route.cells || route.route || [];
            cells.forEach(entry => cellsToPlace.push(entry));
        });
    } else if (Array.isArray(scenario.route)) {
        scenario.route.forEach(entry => cellsToPlace.push(entry));
    }
    cellsToPlace.forEach(entry => {
        Object.assign(grid[entry.r][entry.c], {
            placed: true,
            terrain: { ...entry.terrain },
            placementGroupId: entry.placementGroupId ?? `block_${entry.r}_${entry.c}`
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

        const engine = uiController?.engine || null;
        this.trialRestoreBoundaryService = engine?.trialRestoreBoundaryService
            || (engine ? new TrialRestoreBoundaryService(engine) : null);
        if (engine && this.trialRestoreBoundaryService) {
            engine.trialRestoreBoundaryService = this.trialRestoreBoundaryService;
        }
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

        const routes = Array.isArray(scenarioDefinition.routes) && scenarioDefinition.routes.length > 0
            ? scenarioDefinition.routes.map(r => ({
                id: r.id,
                nameKey: r.nameKey,
                isCommanderRoute: r.isCommanderRoute === true || r.commander === true,
                suppression: r.suppression,
                cells: (r.cells || r.route).map(({ r, c }) => ({ r, c }))
            }))
            : [{
                id: scenarioDefinition.routeId,
                cells: scenarioDefinition.route.map(({ r, c }) => ({ r, c }))
            }];

        const scenario = {
            id: scenarioDefinition.id,
            enemySuppression: scenarioDefinition.enemySuppression,
            availableDefense: scenarioDefinition.availableDefense,
            routes
        };
        this.session = {
            definition: scenarioDefinition,
            displayGrid: createScenarioGrid(scenarioDefinition)
        };
        this.ui.startTrialInterceptionPreview(scenario, {
            deployedDefense: scenarioDefinition.deployedDefense,
            routeId: routes[0]?.id || scenarioDefinition.routeId
        });
        this.trialRestoreBoundaryService?.begin?.(this.ui.state?.turn);
        return { success: true, scenarioId: scenarioDefinition.id };
    }

    stop() {
        if (!this.session) return false;
        this.session = null;
        this.ui.stopTrialInterceptionPreview();
        this.trialRestoreBoundaryService?.end?.();
        return true;
    }

    getDisplayGrid() {
        return this.session?.displayGrid || null;
    }
}
