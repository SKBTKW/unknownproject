export const BOARD_PRESENTATION_CONTRACT_VERSION = "board-presentation-v1";

function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function assertJsonSafe(value, path = "$") {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error(`BOARD_PRESENTATION_NON_FINITE_NUMBER:${path}`);
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
    throw new Error(`BOARD_PRESENTATION_NON_SERIALIZABLE:${path}`);
}
function cloneJsonSafe(value) {
    if (value === undefined) return null;
    assertJsonSafe(value);
    return JSON.parse(JSON.stringify(value));
}
function toCellRef(cell) {
    if (!cell || !Number.isInteger(cell.r) || !Number.isInteger(cell.c)) return null;
    return { r: cell.r, c: cell.c };
}
function toInteractionDto(interaction) {
    return { selected: Boolean(interaction?.selected), hovered: Boolean(interaction?.hovered), focused: Boolean(interaction?.focused) };
}
function toTrialCellDto(trial) {
    const route = trial?.route ? {
        routeId: trial.route.routeId ?? null,
        routeIndex: Number.isInteger(trial.route.routeIndex) ? trial.route.routeIndex : null,
        isRouteEntry: Boolean(trial.route.isRouteEntry),
        isRouteEnd: Boolean(trial.route.isRouteEnd),
        routeDirection: trial.route.routeDirection ?? null,
        isActiveRoute: Boolean(trial.route.isActiveRoute)
    } : null;
    return {
        available: Boolean(trial?.available),
        onRoute: Boolean(trial?.onRoute),
        route,
        interceptionCandidate: cloneJsonSafe(trial?.interceptionCandidate ?? null),
        plannedIntercept: cloneJsonSafe(trial?.plannedIntercept ?? null),
        battleMarker: cloneJsonSafe(trial?.battleMarker ?? null)
    };
}
function toCellDto(cell) {
    if (!cell) return null;
    return {
        r: cell.r,
        c: cell.c,
        placed: Boolean(cell.placed),
        isHQ: Boolean(cell.isHQ),
        terrainId: cell.terrainId ?? null,
        category: cell.category ?? null,
        nameKey: cell.nameKey ?? null,
        hasSocket: Boolean(cell.hasSocket),
        socketResource: cloneJsonSafe(cell.socketResource ?? null),
        yields: cloneJsonSafe(cell.yields ?? {}),
        baseYields: cloneJsonSafe(cell.baseYields ?? {}),
        primaryYield: cloneJsonSafe(cell.primaryYield ?? null),
        modifiers: cloneJsonSafe(cell.modifiers ?? []),
        placementGroupId: cell.placementGroupId ?? null,
        mergeGroupId: cell.mergeGroupId ?? null,
        interaction: toInteractionDto(cell.interaction),
        trial: toTrialCellDto(cell.trial)
    };
}
function toRouteDto(route) {
    return {
        routeId: route?.routeId ?? null,
        cells: Array.isArray(route?.cells) ? route.cells.map(toCellRef).filter(Boolean) : [],
        entryCell: toCellRef(route?.entryCell),
        entrySide: route?.entrySide ?? null,
        isActive: Boolean(route?.isActive)
    };
}
function toTrialDto(trial) {
    return {
        available: Boolean(trial?.available),
        activeRouteId: trial?.activeRouteId ?? null,
        routes: Array.isArray(trial?.routes) ? trial.routes.map(toRouteDto) : [],
        interceptionCandidates: cloneJsonSafe(trial?.interceptionCandidates ?? []),
        plannedIntercepts: cloneJsonSafe(trial?.plannedIntercepts ?? []),
        battleMarkers: cloneJsonSafe(trial?.battleMarkers ?? []),
        enemyState: cloneJsonSafe(trial?.enemyState ?? null)
    };
}
export function createBoardPresentationDto(readModel) {
    if (!readModel) throw new Error("BOARD_PRESENTATION_READ_MODEL_REQUIRED");
    const dto = {
        contractVersion: BOARD_PRESENTATION_CONTRACT_VERSION,
        presentation: {
            viewMode: readModel.presentation?.viewMode ?? null,
            contextMode: readModel.presentation?.contextMode ?? null,
            selectedCell: toCellRef(readModel.presentation?.selectedCell),
            hoveredCell: toCellRef(readModel.presentation?.hoveredCell),
            focusCell: toCellRef(readModel.presentation?.focusCell)
        },
        profile: cloneJsonSafe(readModel.profile ?? {}),
        board: {
            rows: Number.isInteger(readModel.board?.rows) ? readModel.board.rows : 0,
            columns: Number.isInteger(readModel.board?.columns) ? readModel.board.columns : 0
        },
        trial: toTrialDto(readModel.trial),
        cells: Array.isArray(readModel.cells) ? readModel.cells.map(row => Array.isArray(row) ? row.map(toCellDto) : []) : []
    };
    assertJsonSafe(dto);
    return Object.freeze(dto);
}
export function serializeBoardPresentationDto(readModel) { return JSON.stringify(createBoardPresentationDto(readModel)); }
export function parseBoardPresentationDto(serialized) {
    if (typeof serialized !== "string") throw new Error("BOARD_PRESENTATION_SERIALIZED_STRING_REQUIRED");
    const parsed = JSON.parse(serialized);
    assertJsonSafe(parsed);
    if (parsed?.contractVersion !== BOARD_PRESENTATION_CONTRACT_VERSION) throw new Error(`UNSUPPORTED_BOARD_PRESENTATION_CONTRACT:${parsed?.contractVersion ?? "null"}`);
    return parsed;
}
