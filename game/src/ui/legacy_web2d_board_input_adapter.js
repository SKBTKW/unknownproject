import {
    BOARD_INPUT_COMMANDS,
    parseBoardInputCommand
} from '../presentation/board_input_contract.js';

/**
 * Compatibility adapter for the legacy Web 2D board.
 *
 * The renderer side emits portable BoardInputCommand values. This adapter is
 * the only place that translates those commands back into the existing
 * UIController entry points while the legacy Web 2D surface is being migrated.
 *
 * No DOM event, screen coordinate, or renderer object belongs here.
 */
export class LegacyWeb2DBoardInputAdapter {
    constructor(uiController) {
        if (!uiController) throw new Error('LEGACY_WEB2D_UI_CONTROLLER_REQUIRED');
        this.ui = uiController;
    }

    dispatch(input) {
        const command = parseBoardInputCommand(input);
        const { type, payload } = command;

        switch (type) {
            case BOARD_INPUT_COMMANDS.SELECT_CELL:
                return this._selectCell(command, payload.cell);
            case BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION:
                return this._selectTrialInterception(command, payload.routeId, payload.cell);
            case BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION:
                return this._hoverTrialInterception(command, payload.routeId, payload.cell);
            case BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER:
                return this._clearTrialHover(command);
            default:
                return this._failure(command, 'LEGACY_WEB2D_INPUT_UNSUPPORTED');
        }
    }

    _selectCell(command, cell) {
        if (this.ui.isTrialInteractionActive?.()) {
            return this._failure(command, 'TRIAL_INPUT_REQUIRES_TRIAL_COMMAND');
        }
        if (typeof this.ui.onCellClick !== 'function') {
            return this._failure(command, 'LEGACY_WEB2D_SELECT_CELL_UNAVAILABLE');
        }
        const result = this.ui.onCellClick(cell.r, cell.c);
        return this._success(command, result);
    }

    _selectTrialInterception(command, routeId, cell) {
        if (!this.ui.isTrialInteractionActive?.()) {
            return this._failure(command, 'TRIAL_INTERACTION_INACTIVE');
        }
        if (!this._isActiveRoute(routeId)) {
            return this._failure(command, 'TRIAL_ROUTE_NOT_ACTIVE');
        }
        if (typeof this.ui.selectTrialInterceptionCell !== 'function') {
            return this._failure(command, 'LEGACY_WEB2D_TRIAL_SELECTION_UNAVAILABLE');
        }
        const result = this.ui.selectTrialInterceptionCell(cell.r, cell.c);
        return result === false
            ? this._failure(command, 'TRIAL_INTERCEPTION_REJECTED')
            : this._success(command, result);
    }

    _hoverTrialInterception(command, routeId, cell) {
        if (!this.ui.isTrialInteractionActive?.()) {
            return this._failure(command, 'TRIAL_INTERACTION_INACTIVE');
        }
        if (!this._isActiveRoute(routeId)) {
            return this._failure(command, 'TRIAL_ROUTE_NOT_ACTIVE');
        }
        if (typeof this.ui.updateTrialInterceptionPreview !== 'function') {
            return this._failure(command, 'LEGACY_WEB2D_TRIAL_HOVER_UNAVAILABLE');
        }
        return this._success(command, this.ui.updateTrialInterceptionPreview(cell.r, cell.c));
    }

    _clearTrialHover(command) {
        if (!this.ui.isTrialInteractionActive?.()) {
            return this._success(command, null);
        }
        this.ui.trialPresentationState?.clearHoveredCell?.();
        const result = this.ui.refreshTrialInterceptionPreview?.() ?? null;
        return this._success(command, result);
    }

    _isActiveRoute(routeId) {
        if (typeof routeId !== 'string' || routeId.length === 0) return false;
        const activeRoute = this.ui.getActiveTrialRoute?.() || null;
        const activeRouteId = activeRoute?.id ?? activeRoute?.routeId ?? null;
        return activeRouteId === routeId;
    }

    _success(command, result) {
        return Object.freeze({
            success: true,
            type: command.type,
            result: result ?? null
        });
    }

    _failure(command, reason) {
        return Object.freeze({
            success: false,
            type: command.type,
            reason
        });
    }
}

export default LegacyWeb2DBoardInputAdapter;
