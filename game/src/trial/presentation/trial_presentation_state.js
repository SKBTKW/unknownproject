import { TRIAL_MODIFIER_I18N_KEYS } from "../domain/trial_types.js";

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
