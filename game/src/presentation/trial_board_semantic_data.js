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

export function buildTrialRouteCellIndex(trialSemanticData) {
    const byCell = new Map();
    const routes = trialSemanticData?.routes || [];
    const activeRoutes = trialSemanticData?.activeRouteId != null
        ? routes.filter(route => route.routeId === trialSemanticData.activeRouteId)
        : routes.slice(0, 1);

    for (const route of activeRoutes) {
        (route.cells || []).forEach((cell, index) => {
            const next = route.cells[index + 1] || null;
            const previous = route.cells[index - 1] || null;
            const directionTarget = next || previous;
            let routeDirection = null;

            if (directionTarget) {
                const deltaR = next ? directionTarget.r - cell.r : cell.r - directionTarget.r;
                const deltaC = next ? directionTarget.c - cell.c : cell.c - directionTarget.c;
                routeDirection = Math.abs(deltaC) >= Math.abs(deltaR)
                    ? (deltaC >= 0 ? "east" : "west")
                    : (deltaR >= 0 ? "south" : "north");
            }

            byCell.set(`${cell.r}:${cell.c}`, Object.freeze({
                routeId: route.routeId,
                routeIndex: index,
                isRouteEntry: index === 0,
                isRouteEnd: index === route.cells.length - 1,
                routeDirection,
                isActiveRoute: Boolean(route.isActive)
            }));
        });
    }

    return byCell;
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
    selectedInterceptCell = null,
    hoveredInterceptCell = null,
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
        selectedInterceptCell: normalizeRouteCell(selectedInterceptCell),
        hoveredInterceptCell: normalizeRouteCell(hoveredInterceptCell),
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
