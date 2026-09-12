import { BOARD_INPUT_COMMANDS, parseBoardInputCommand } from './board_input_contract.js';

export class BoardInputDispatcher {
    constructor({ presentationState, handlers = {} } = {}) {
        if (!presentationState) throw new Error("BOARD_PRESENTATION_STATE_REQUIRED");
        this.presentationState = presentationState;
        this.handlers = { ...handlers };
    }
    setHandler(name, handler) {
        if (handler != null && typeof handler !== "function") throw new Error(`INVALID_BOARD_INPUT_HANDLER:${name}`);
        if (handler == null) delete this.handlers[name]; else this.handlers[name] = handler;
    }
    dispatch(input) {
        const command = parseBoardInputCommand(input);
        const { type, payload } = command;
        switch (type) {
            case BOARD_INPUT_COMMANDS.SET_VIEW_MODE: return this._ok(command, this.presentationState.setViewMode(payload.viewMode));
            case BOARD_INPUT_COMMANDS.TOGGLE_VIEW_MODE: return this._ok(command, this.presentationState.toggleViewMode());
            case BOARD_INPUT_COMMANDS.SET_CONTEXT_MODE: return this._ok(command, this.presentationState.setContextMode(payload.contextMode));
            case BOARD_INPUT_COMMANDS.TOGGLE_CONTEXT_MODE: return this._ok(command, this.presentationState.toggleContextMode());
            case BOARD_INPUT_COMMANDS.SELECT_CELL: return this._ok(command, this.presentationState.selectCell(payload.cell));
            case BOARD_INPUT_COMMANDS.CLEAR_SELECTION: this.presentationState.clearSelection(); return this._ok(command, this.presentationState.snapshot());
            case BOARD_INPUT_COMMANDS.HOVER_CELL: return this._ok(command, this.presentationState.hoverCell(payload.cell));
            case BOARD_INPUT_COMMANDS.CLEAR_HOVER: this.presentationState.clearHover(); return this._ok(command, this.presentationState.snapshot());
            case BOARD_INPUT_COMMANDS.FOCUS_CELL: return this._ok(command, this.presentationState.focusOnCell(payload.cell));
            case BOARD_INPUT_COMMANDS.CLEAR_FOCUS: this.presentationState.clearFocus(); return this._ok(command, this.presentationState.snapshot());
            case BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE: return this._delegate("selectTrialRoute", command);
            case BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION: return this._delegate("selectTrialInterception", command);
            default: return { success: false, type, reason: "UNHANDLED_BOARD_INPUT_COMMAND" };
        }
    }
    _delegate(handlerName, command) {
        const handler = this.handlers[handlerName];
        if (typeof handler !== "function") return Object.freeze({ success: false, type: command.type, reason: "BOARD_INPUT_HANDLER_UNAVAILABLE" });
        const result = handler(command.payload, command);
        if (result && typeof result === "object") return Object.freeze({ type: command.type, ...result });
        return Object.freeze({ success: result !== false, type: command.type, result: result ?? null });
    }
    _ok(command, result) { return Object.freeze({ success: true, type: command.type, result }); }
}

export default BoardInputDispatcher;
