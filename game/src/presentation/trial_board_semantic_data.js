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

export const TRIAL_BATTLE_PRESENTATION_STATUSES = Object.freeze({
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    RESOLVED: 'RESOLVED'
});

export function resolveTrialBattleMarkerState(marker) {
    if (!marker) return null;

    const candidateStatus = String(
        marker.status || TRIAL_BATTLE_PRESENTATION_STATUSES.PENDING
    ).toUpperCase();
    const status = Object.values(TRIAL_BATTLE_PRESENTATION_STATUSES).includes(candidateStatus)
        ? candidateStatus
        : TRIAL_BATTLE_PRESENTATION_STATUSES.PENDING;
    const isCurrent = Boolean(marker.isCurrent);

    return Object.freeze({
        status,
        isCurrent,
        isPending: status === TRIAL_BATTLE_PRESENTATION_STATUSES.PENDING,
        isActive: status === TRIAL_BATTLE_PRESENTATION_STATUSES.ACTIVE,
        isResolved: status === TRIAL_BATTLE_PRESENTATION_STATUSES.RESOLVED
    });
}

function buildRouteCellVisualState(route, cells, index, singletonDirectionFallback = null) {
    const cell = cells[index];
    if (!cell) return null;

    const next = cells[index + 1] || null;
    const previous = cells[index - 1] || null;
    const directionTarget = next || previous;
    let routeDirection = singletonDirectionFallback;

    if (directionTarget) {
        const deltaR = next ? directionTarget.r - cell.r : cell.r - directionTarget.r;
        const deltaC = next ? directionTarget.c - cell.c : cell.c - directionTarget.c;
        routeDirection = Math.abs(deltaC) >= Math.abs(deltaR)
            ? (deltaC >= 0 ? "east" : "west")
            : (deltaR >= 0 ? "south" : "north");
    }

    return Object.freeze({
        routeId: route?.routeId ?? route?.id ?? null,
        routeIndex: index,
        isRouteEntry: index === 0,
        isRouteEnd: index === cells.length - 1,
        routeDirection,
        isActiveRoute: Boolean(route?.isActive)
    });
}

export function getTrialRouteCellVisualState(route, r, c, {
    singletonDirectionFallback = null
} = {}) {
    const cells = (route?.cells || route?.path || [])
        .map(normalizeRouteCell)
        .filter(Boolean);
    const index = cells.findIndex(cell => cell.r === r && cell.c === c);
    if (index < 0) return null;
    return buildRouteCellVisualState(route, cells, index, singletonDirectionFallback);
}

export function buildTrialRouteCellIndex(trialSemanticData) {
    const byCell = new Map();
    const routes = trialSemanticData?.routes || [];
    const activeRoutes = trialSemanticData?.activeRouteId != null
        ? routes.filter(route => route.routeId === trialSemanticData.activeRouteId)
        : routes.slice(0, 1);

    for (const route of activeRoutes) {
        const cells = (route.cells || [])
            .map(normalizeRouteCell)
            .filter(Boolean);

        cells.forEach((cell, index) => {
            byCell.set(
                `${cell.r}:${cell.c}`,
                buildRouteCellVisualState(route, cells, index)
            );
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
    routeSelectionEnabled = null,
    selectedInterceptCell = null,
    hoveredInterceptCell = null,
    routes = [],
    interceptionCandidates = [],
    plannedIntercepts = [],
    battleMarkers = [],
    tacticalEffects = [],
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
        routeSelectionEnabled: routeSelectionEnabled === null
            ? Boolean(available)
            : Boolean(routeSelectionEnabled),
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
        tacticalEffects: freezeArray(
            tacticalEffects.map(normalizeMarkedCell).filter(Boolean)
        ),
        enemyState: enemyState ? Object.freeze({ ...enemyState }) : null
    });
}

export function emptyTrialBoardSemanticData() {
    return createTrialBoardSemanticData();
}
