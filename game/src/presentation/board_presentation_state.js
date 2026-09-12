export const BOARD_VIEW_MODES = Object.freeze({
    STRATEGIC_2D: "2D",
    WORLD_2_5D: "2_5D"
});

export const BOARD_CONTEXT_MODES = Object.freeze({
    NORMAL: "NORMAL",
    TRIAL: "TRIAL"
});

function isOneOf(value, values) {
    return Object.values(values).includes(value);
}

export function isBoardViewMode(mode) {
    return isOneOf(mode, BOARD_VIEW_MODES);
}

export function isBoardContextMode(mode) {
    return isOneOf(mode, BOARD_CONTEXT_MODES);
}

export function normalizeBoardCell(cell) {
    if (!cell || !Number.isInteger(cell.r) || !Number.isInteger(cell.c)) return null;
    return Object.freeze({ r: cell.r, c: cell.c });
}

/**
 * Board-only presentation session state.
 *
 * IMPORTANT:
 * - viewMode controls renderer choice only.
 * - contextMode controls information context only.
 * - neither field means "the game is currently in Trial".
 * - no screen-space/world-space coordinates belong here.
 * - changing either axis must preserve logical board selection/focus.
 */
export class BoardPresentationState {
    constructor({
        viewMode = BOARD_VIEW_MODES.STRATEGIC_2D,
        contextMode = BOARD_CONTEXT_MODES.NORMAL,
        selectedCell = null,
        hoveredCell = null,
        focusCell = null
    } = {}) {
        if (!isBoardViewMode(viewMode)) {
            throw new Error(`INVALID_BOARD_VIEW_MODE:${viewMode}`);
        }
        if (!isBoardContextMode(contextMode)) {
            throw new Error(`INVALID_BOARD_CONTEXT_MODE:${contextMode}`);
        }

        this.viewMode = viewMode;
        this.contextMode = contextMode;
        this.selectedCell = normalizeBoardCell(selectedCell);
        this.hoveredCell = normalizeBoardCell(hoveredCell);
        this.focusCell = normalizeBoardCell(focusCell);
    }

    setViewMode(mode) {
        if (!isBoardViewMode(mode)) throw new Error(`INVALID_BOARD_VIEW_MODE:${mode}`);
        this.viewMode = mode;
        return this.snapshot();
    }

    toggleViewMode() {
        return this.setViewMode(
            this.viewMode === BOARD_VIEW_MODES.STRATEGIC_2D
                ? BOARD_VIEW_MODES.WORLD_2_5D
                : BOARD_VIEW_MODES.STRATEGIC_2D
        );
    }

    setContextMode(mode) {
        if (!isBoardContextMode(mode)) throw new Error(`INVALID_BOARD_CONTEXT_MODE:${mode}`);
        this.contextMode = mode;
        return this.snapshot();
    }

    toggleContextMode() {
        return this.setContextMode(
            this.contextMode === BOARD_CONTEXT_MODES.NORMAL
                ? BOARD_CONTEXT_MODES.TRIAL
                : BOARD_CONTEXT_MODES.NORMAL
        );
    }

    selectCell(cell) {
        this.selectedCell = normalizeBoardCell(cell);
        return this.selectedCell;
    }

    hoverCell(cell) {
        this.hoveredCell = normalizeBoardCell(cell);
        return this.hoveredCell;
    }

    focusOnCell(cell) {
        this.focusCell = normalizeBoardCell(cell);
        return this.focusCell;
    }

    clearSelection() { this.selectedCell = null; }
    clearHover() { this.hoveredCell = null; }
    clearFocus() { this.focusCell = null; }

    snapshot() {
        return Object.freeze({
            viewMode: this.viewMode,
            contextMode: this.contextMode,
            selectedCell: this.selectedCell,
            hoveredCell: this.hoveredCell,
            focusCell: this.focusCell
        });
    }
}

export default BoardPresentationState;
