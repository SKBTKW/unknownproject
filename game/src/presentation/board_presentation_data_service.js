import { CellViewDataService } from '../services/cell_view_data_service.js';
import { getBoardPresentationProfile } from './board_presentation_profile.js';
import { emptyTrialBoardSemanticData } from './trial_board_semantic_data.js';

function sameCell(a, r, c) {
    return Boolean(a && a.r === r && a.c === c);
}

function createStateGridView(state, gridOverride) {
    if (!state || !gridOverride || gridOverride === state.grid) return state;
    const stateView = Object.create(state);
    Object.defineProperty(stateView, "grid", {
        value: gridOverride,
        enumerable: true,
        configurable: false,
        writable: false
    });
    return stateView;
}

function buildRouteIndex(trialSemanticData) {
    const byCell = new Map();
    const routes = trialSemanticData.routes || [];
    const activeRoutes = trialSemanticData.activeRouteId != null
        ? routes.filter(route => route.routeId === trialSemanticData.activeRouteId)
        : routes.slice(0, 1);
    for (const route of activeRoutes) {
        route.cells.forEach((cell, index) => {
            const next = route.cells[index + 1] || null;
            const previous = route.cells[index - 1] || null;
            const directionTarget = next || previous;
            let direction = null;
            if (directionTarget) {
                const deltaR = next ? directionTarget.r - cell.r : cell.r - directionTarget.r;
                const deltaC = next ? directionTarget.c - cell.c : cell.c - directionTarget.c;
                direction = Math.abs(deltaC) >= Math.abs(deltaR)
                    ? (deltaC >= 0 ? "east" : "west")
                    : (deltaR >= 0 ? "south" : "north");
            }

            byCell.set(`${cell.r}:${cell.c}`, Object.freeze({
                routeId: route.routeId,
                routeIndex: index,
                isRouteEntry: index === 0,
                isRouteEnd: index === route.cells.length - 1,
                routeDirection: direction,
                isActiveRoute: Boolean(route.isActive)
            }));
        });
    }
    return byCell;
}

function buildMarkedCellIndex(items) {
    const map = new Map();
    for (const item of items || []) {
        if (!item?.cell) continue;
        map.set(`${item.cell.r}:${item.cell.c}`, item);
    }
    return map;
}

/**
 * Shared semantic read model for Browser 2D / Web 2.5D / Unity renderers.
 *
 * It consumes facts and presentation state. It never starts/stops a Trial,
 * changes LayoutState, chooses PlayerTray content, or emits screen geometry.
 */
export class BoardPresentationDataService {
    constructor({ cellViewDataService = null } = {}) {
        this.cellViewDataService = cellViewDataService || new CellViewDataService();
    }

    getBoard(state, {
        presentationState,
        trialSemanticData = null,
        gridOverride = null
    } = {}) {
        if (!presentationState) throw new Error('BOARD_PRESENTATION_STATE_REQUIRED');

        const sourceState = createStateGridView(state, gridOverride);
        const grid = sourceState?.grid;
        const profile = getBoardPresentationProfile(presentationState.contextMode);
        const trial = trialSemanticData || emptyTrialBoardSemanticData();
        const showRoutes = profile.trialRoutes !== "HIDDEN";
        const showInterception = profile.interception !== "HIDDEN";
        const showBattleMarkers = profile.battleMarkers !== "HIDDEN";
        const showTrialOperationalData = showRoutes || showInterception || showBattleMarkers;

        const visibleTrial = Object.freeze({
            available: Boolean(trial.available && showTrialOperationalData),
            activeRouteId: showRoutes ? trial.activeRouteId : null,
            routes: Object.freeze(showRoutes ? [...(trial.routes || [])] : []),
            interceptionCandidates: Object.freeze(
                showInterception ? [...(trial.interceptionCandidates || [])] : []
            ),
            plannedIntercepts: Object.freeze(
                showInterception ? [...(trial.plannedIntercepts || [])] : []
            ),
            battleMarkers: Object.freeze(
                showBattleMarkers ? [...(trial.battleMarkers || [])] : []
            ),
            enemyState: showTrialOperationalData ? trial.enemyState : null
        });

        const routeIndex = showRoutes ? buildRouteIndex(visibleTrial) : new Map();
        const interceptionIndex = showInterception
            ? buildMarkedCellIndex(visibleTrial.interceptionCandidates)
            : new Map();
        const plannedIndex = showInterception
            ? buildMarkedCellIndex(visibleTrial.plannedIntercepts)
            : new Map();
        const battleIndex = showBattleMarkers
            ? buildMarkedCellIndex(visibleTrial.battleMarkers)
            : new Map();

        if (!grid) {
            return Object.freeze({
                presentation: presentationState.snapshot(),
                profile,
                board: Object.freeze({ rows: 0, columns: 0 }),
                trial: visibleTrial,
                cells: Object.freeze([])
            });
        }

        const cells = grid.map((row, r) => Object.freeze(row.map((_, c) => {
            const facts = this.cellViewDataService.getCellViewData(sourceState, r, c);
            if (!facts) return null;

            const key = `${r}:${c}`;
            const route = routeIndex.get(key) || null;
            const interception = interceptionIndex.get(key) || null;
            const planned = plannedIndex.get(key) || null;
            const battle = battleIndex.get(key) || null;

            return Object.freeze({
                ...facts,
                interaction: Object.freeze({
                    selected: sameCell(presentationState.selectedCell, r, c),
                    hovered: sameCell(presentationState.hoveredCell, r, c),
                    focused: sameCell(presentationState.focusCell, r, c)
                }),
                trial: Object.freeze({
                    available: visibleTrial.available,
                    onRoute: Boolean(route),
                    route,
                    interceptionCandidate: interception,
                    plannedIntercept: planned,
                    battleMarker: battle
                })
            });
        })));

        return Object.freeze({
            presentation: presentationState.snapshot(),
            profile,
            board: Object.freeze({
                rows: grid.length,
                columns: grid.reduce((max, row) => Math.max(max, row?.length || 0), 0)
            }),
            trial: visibleTrial,
            cells: Object.freeze(cells)
        });
    }
}

export default BoardPresentationDataService;
