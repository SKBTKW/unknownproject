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
    }

    setMode(mode) {
        if (mode !== "2D" && mode !== "2_5D") throw new Error(`INVALID_TRIAL_VIEW_MODE:${mode}`);
        this.mode = mode;
        return this.mode;
    }
}

