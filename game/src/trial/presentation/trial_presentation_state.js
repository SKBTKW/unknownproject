import { TRIAL_MODIFIER_I18N_KEYS } from "../domain/trial_types.js";

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

    setInterceptionPreview({ cell, terrainNameKey, deployedDefense, result }) {
        this.hoveredCell = cell || null;
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
                after: modifier.after
            })),
            prediction: { ...result.prediction }
        };
        return this.interceptionPreview;
    }

    clearInterceptionPreview() {
        this.hoveredCell = null;
        this.interceptionPreview = null;
    }
}
