import { normalizeBoardCell } from './board_presentation_state.js';

function normalizeSide(side) {
    if (side === "north" || side === "south" || side === "east" || side === "west") {
        return side;
    }
    return null;
}

function normalizeRouteCell(entry) {
    if (!entry) return null;
    const r = Number.isInteger(entry.r) ? entry.r : entry.row;
    const c = Number.isInteger(entry.c) ? entry.c : entry.column;
    return normalizeBoardCell({ r, c });
}

function freezeArray(items) {
    return Object.freeze(items);
}

/**
 * Renderer-neutral Trial facts projected onto board coordinates.
 *
 * `available=false` means no actual Trial data is currently known/provided.
 * It does NOT mean the board cannot be viewed with contextMode=TRIAL.
 *
 * Consumers may therefore legally have:
 *   contextMode = TRIAL
 *   trialSemanticData.available = false
 */
export function createTrialBoardSemanticData({
    available = false,
    activeRouteId = null,
    routes = [],
    interceptionCandidates = [],
    plannedIntercepts = [],
    battleMarkers = [],
    enemyState = null
} = {}) {
    const normalizedRoutes = routes.map(route => {
        const cells = (route?.cells || route?.path || [])
            .map(normalizeRouteCell)
            .filter(Boolean);

        const explicitEntry = normalizeRouteCell(route?.entryCell);
        const entryCell = explicitEntry || cells[0] || null;

        return Object.freeze({
            routeId: route?.routeId ?? route?.id ?? null,
            cells: freezeArray(cells),
            entryCell,
            entrySide: normalizeSide(route?.entrySide),
            isActive: (route?.routeId ?? route?.id ?? null) === activeRouteId
        });
    });

    const normalizeMarkedCell = item => {
        const cell = normalizeRouteCell(item?.cell || item);
        if (!cell) return null;
        return Object.freeze({
            ...item,
            cell
        });
    };

    return Object.freeze({
        available: Boolean(available),
        activeRouteId: activeRouteId ?? null,
        routes: freezeArray(normalizedRoutes),
        interceptionCandidates: freezeArray(
            interceptionCandidates.map(normalizeMarkedCell).filter(Boolean)
        ),
        plannedIntercepts: freezeArray(
            plannedIntercepts.map(normalizeMarkedCell).filter(Boolean)
        ),
        battleMarkers: freezeArray(
            battleMarkers.map(normalizeMarkedCell).filter(Boolean)
        ),
        enemyState: enemyState ? Object.freeze({ ...enemyState }) : null
    });
}

export function emptyTrialBoardSemanticData() {
    return createTrialBoardSemanticData();
}
