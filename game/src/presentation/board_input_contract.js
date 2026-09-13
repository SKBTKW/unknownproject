import { isBoardContextMode, isBoardViewMode, normalizeBoardCell } from './board_presentation_state.js';

export const BOARD_INPUT_CONTRACT_VERSION = "board-input-v1";
export const BOARD_INPUT_COMMANDS = Object.freeze({
    SET_VIEW_MODE: "SET_VIEW_MODE",
    TOGGLE_VIEW_MODE: "TOGGLE_VIEW_MODE",
    SET_CONTEXT_MODE: "SET_CONTEXT_MODE",
    TOGGLE_CONTEXT_MODE: "TOGGLE_CONTEXT_MODE",
    SELECT_CELL: "SELECT_CELL",
    CLEAR_SELECTION: "CLEAR_SELECTION",
    HOVER_CELL: "HOVER_CELL",
    CLEAR_HOVER: "CLEAR_HOVER",
    FOCUS_CELL: "FOCUS_CELL",
    CLEAR_FOCUS: "CLEAR_FOCUS",
    SELECT_TRIAL_ROUTE: "SELECT_TRIAL_ROUTE",
    SELECT_TRIAL_INTERCEPTION: "SELECT_TRIAL_INTERCEPTION"
});
const COMMAND_SET = new Set(Object.values(BOARD_INPUT_COMMANDS));

function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function assertJsonSafe(value, path = "$") {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error(`BOARD_INPUT_NON_FINITE_NUMBER:${path}`);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
        return;
    }
    if (isPlainObject(value)) {
        for (const [key, item] of Object.entries(value)) assertJsonSafe(item, `${path}.${key}`);
        return;
    }
    throw new Error(`BOARD_INPUT_NON_SERIALIZABLE:${path}`);
}
function assertPlainObject(value, name) {
    if (!isPlainObject(value)) throw new Error(`${name}_REQUIRED`);
}
function requireCell(payload) {
    const cell = normalizeBoardCell(payload?.cell);
    if (!cell) throw new Error("INVALID_BOARD_INPUT_CELL");
    return cell;
}
function requireRouteId(payload) {
    const routeId = payload?.routeId;
    if (typeof routeId !== "string" || routeId.length === 0) throw new Error("INVALID_BOARD_INPUT_ROUTE_ID");
    return routeId;
}
export function createBoardInputCommand(type, payload = {}) {
    if (!COMMAND_SET.has(type)) throw new Error(`UNKNOWN_BOARD_INPUT_COMMAND:${type}`);
    assertPlainObject(payload, "BOARD_INPUT_PAYLOAD");
    assertJsonSafe(payload, "$.payload");
    let normalizedPayload = {};
    switch (type) {
        case BOARD_INPUT_COMMANDS.SET_VIEW_MODE:
            if (!isBoardViewMode(payload.viewMode)) throw new Error(`INVALID_BOARD_VIEW_MODE:${payload.viewMode}`);
            normalizedPayload = { viewMode: payload.viewMode }; break;
        case BOARD_INPUT_COMMANDS.SET_CONTEXT_MODE:
            if (!isBoardContextMode(payload.contextMode)) throw new Error(`INVALID_BOARD_CONTEXT_MODE:${payload.contextMode}`);
            normalizedPayload = { contextMode: payload.contextMode }; break;
        case BOARD_INPUT_COMMANDS.SELECT_CELL:
        case BOARD_INPUT_COMMANDS.HOVER_CELL:
        case BOARD_INPUT_COMMANDS.FOCUS_CELL:
            normalizedPayload = { cell: requireCell(payload) }; break;
        case BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE:
            normalizedPayload = { routeId: requireRouteId(payload) }; break;
        case BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION:
            normalizedPayload = { routeId: requireRouteId(payload), cell: requireCell(payload) }; break;
        case BOARD_INPUT_COMMANDS.TOGGLE_VIEW_MODE:
        case BOARD_INPUT_COMMANDS.TOGGLE_CONTEXT_MODE:
        case BOARD_INPUT_COMMANDS.CLEAR_SELECTION:
        case BOARD_INPUT_COMMANDS.CLEAR_HOVER:
        case BOARD_INPUT_COMMANDS.CLEAR_FOCUS:
            normalizedPayload = {}; break;
        default: throw new Error(`UNHANDLED_BOARD_INPUT_COMMAND:${type}`);
    }
    const command = { contractVersion: BOARD_INPUT_CONTRACT_VERSION, type, payload: Object.freeze(normalizedPayload) };
    assertJsonSafe(command);
    return Object.freeze(command);
}
export function parseBoardInputCommand(input) {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    assertPlainObject(parsed, "BOARD_INPUT_COMMAND");
    assertJsonSafe(parsed);
    if (parsed.contractVersion !== BOARD_INPUT_CONTRACT_VERSION) throw new Error(`UNSUPPORTED_BOARD_INPUT_CONTRACT:${parsed.contractVersion ?? "null"}`);
    return createBoardInputCommand(parsed.type, parsed.payload || {});
}
export function serializeBoardInputCommand(command) { return JSON.stringify(parseBoardInputCommand(command)); }
