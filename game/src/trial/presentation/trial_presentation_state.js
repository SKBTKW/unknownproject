import { TRIAL_MODIFIER_I18N_KEYS } from "../domain/trial_types.js";
import { TrialPlanningDraftService } from "../domain/trial_planning_draft_service.js";

export function normalizeDefenseAllocation(value, availableDefense, fallback = 0) {
    const normalizedAvailable = Number.isFinite(Number(availableDefense))
        ? Math.max(0, Math.floor(Number(availableDefense)))
        : 0;
    const numericValue = Number(value);
    const numericFallback = Number(fallback);
    const safeValue = Number.isNaN(numericValue)
        ? (Number.isFinite(numericFallback) ? numericFallback : 0)
        : numericValue;
    return Math.min(normalizedAvailable, Math.max(0, Math.floor(safeValue)));
}

function toCellCoordinates(cell) {
    if (!cell || !Number.isInteger(cell.r) || !Number.isInteger(cell.c)) return null;
    return { r: cell.r, c: cell.c };
}

export class TrialPresentationState {
    constructor({ mode = "2D" } = {}) {
        this.mode = mode;
        this.selectedInterceptCell = null;
        this.hoveredCell = null;
        this.selectedTactic = null;
        this.previewDefenseAllocation = 0;
        this.previewMysticSpend = 0;
        this.activeEnemyRoute = null;
        this.highlightedCells = [];
        this.currentBattleStep = null;
        this.cameraFocusCell = null;
        this.interceptionPreview = null;
        this.routePlanDrafts = new Map();
        this.planningCompletionWarningOpen = false;
        this.planningReviewRequested = false;
        this.planningWarningsAccepted = false;
        this.planningValidationErrors = [];
        this.planningWarningInfo = null;
    }

    clearPlanningReviewRequest() {
        this.planningReviewRequested = false;
        this.planningWarningsAccepted = false;
        this.planningCompletionWarningOpen = false;
        this.planningValidationErrors = [];
        this.planningWarningInfo = null;
    }

    setMode(mode) {
        if (mode !== "2D" && mode !== "2_5D") throw new Error(`INVALID_TRIAL_VIEW_MODE:${mode}`);
        this.mode = mode;
        return this.mode;
    }

    selectInterceptCell(cell) {
        this.selectedInterceptCell = toCellCoordinates(cell);
        return this.selectedInterceptCell;
    }

    clearSelectedInterceptCell() {
        this.selectedInterceptCell = null;
    }

    setHoveredCell(cell) {
        this.hoveredCell = toCellCoordinates(cell);
        return this.hoveredCell;
    }

    clearHoveredCell() {
        this.hoveredCell = null;
    }

    setPreviewDefenseAllocation(value, availableDefense, fallback = this.previewDefenseAllocation) {
        this.previewDefenseAllocation = normalizeDefenseAllocation(value, availableDefense, fallback);
        return this.previewDefenseAllocation;
    }

    setActiveEnemyRoute(routeId) {
        this.activeEnemyRoute = routeId ?? null;
        return this.activeEnemyRoute;
    }

    getEffectiveInterceptCell() {
        return this.hoveredCell || this.selectedInterceptCell || null;
    }

    clearPlanningState() {
        this.selectedInterceptCell = null;
        this.hoveredCell = null;
        this.previewDefenseAllocation = 0;
        this.activeEnemyRoute = null;
        this.interceptionPreview = null;
        this.routePlanDrafts.clear();
        this.clearPlanningReviewRequest();
    }

    resetForRestore() {
        // Preserve the player's display mode, discard every future battle draft/cache.
        Object.assign(this, new TrialPresentationState({ mode: this.mode }));
    }

    getRouteDecision(routeId) {
        return TrialPlanningDraftService.getRouteDecision(this.routePlanDrafts, routeId);
    }

    setRouteInterceptPlan(routeId, interceptCell, defenseAllocation, context = {}) {
        return TrialPlanningDraftService.setIntercept(this.routePlanDrafts, {
            routeId,
            interceptCell,
            defenseAllocation,
            ...context
        });
    }

    setRouteSkipped(routeId, routes = null) {
        return TrialPlanningDraftService.setSkip(this.routePlanDrafts, routeId, routes);
    }

    clearRouteDecision(routeId) {
        return TrialPlanningDraftService.clearDecision(this.routePlanDrafts, routeId);
    }

    getPlannedDefenseTotal() {
        return TrialPlanningDraftService.getPlannedDefenseTotal(this.routePlanDrafts);
    }

    getRemainingDefense(availableDefense) {
        return TrialPlanningDraftService.getRemainingDefense(this.routePlanDrafts, availableDefense);
    }

    getUndecidedRoutes(routes) {
        return TrialPlanningDraftService.getUndecidedRoutes(this.routePlanDrafts, routes);
    }

    isBlockPlannedByOtherRoute(routeId, blockId) {
        return TrialPlanningDraftService.isBlockPlannedByOtherRoute(this.routePlanDrafts, routeId, blockId);
    }

    getPlannedCellInfo(r, c) {
        return TrialPlanningDraftService.getPlannedCellInfo(this.routePlanDrafts, r, c);
    }

    getMaxAllocationForRoute(routeId, availableDefense = 0) {
        return TrialPlanningDraftService.getMaxAllocationForRoute(this.routePlanDrafts, routeId, availableDefense);
    }

    validatePlanning(availableDefense, routes, context = {}) {
        return TrialPlanningDraftService.validateDraft(this.routePlanDrafts, {
            routes,
            availableDefense,
            ...context
        });
    }

    getInterceptionPlanSummary(availableDefense = 0, routes = []) {
        const plans = Array.from(this.routePlanDrafts.values()).map(p => ({
            ...p,
            interceptCell: p.interceptCell ? { ...p.interceptCell } : null
        }));
        let interceptCount = 0;
        let skipCount = 0;
        for (const p of plans) {
            if (p.status === "INTERCEPT") interceptCount++;
            else if (p.status === "SKIP") skipCount++;
        }
        const undecidedRoutes = this.getUndecidedRoutes(routes);
        const validation = this.validatePlanning(availableDefense, routes);
        return {
            plannedDefenseTotal: this.getPlannedDefenseTotal(),
            remainingDefense: this.getRemainingDefense(availableDefense),
            interceptCount,
            skipCount,
            undecidedCount: Array.isArray(routes) ? undecidedRoutes.length : 0,
            isValid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            plans
        };
    }

    setInterceptionPreview({ cell, terrainNameKey, deployedDefense, result }) {
        if (!result || result.success === false) {
            this.interceptionPreview = result ? {
                canIntercept: false,
                cell: cell ? { ...cell } : null,
                terrainNameKey: terrainNameKey || null,
                deployedDefense,
                reason: result.reason || "INTERCEPTION_TERRAIN_FORBIDDEN"
            } : null;
            return this.interceptionPreview;
        }

        this.interceptionPreview = {
            canIntercept: true,
            cell: cell ? { ...cell } : null,
            terrainNameKey: terrainNameKey || null,
            deployedDefense,
            baseHumanPower: result.human.basePower,
            finalHumanPower: result.human.finalPower,
            baseEnemyPower: result.enemy.basePower,
            finalEnemyPower: result.enemy.finalPower,
            modifierRows: result.appliedModifiers.map(modifier => ({
                labelKey: TRIAL_MODIFIER_I18N_KEYS[modifier.source] || modifier.source,
                source: modifier.source,
                target: modifier.target,
                phase: modifier.phase,
                priority: modifier.priority || 0,
                before: modifier.before,
                after: modifier.after,
                interceptElevation: modifier.interceptElevation,
                approachElevation: modifier.approachElevation
            })),
            prediction: { ...result.prediction }
        };
        return this.interceptionPreview;
    }

    clearInterceptionPreview() {
        this.interceptionPreview = null;
    }
}
