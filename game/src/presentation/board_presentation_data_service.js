import { CellViewDataService } from '../services/cell_view_data_service.js';
import { getBoardPresentationProfile } from './board_presentation_profile.js';
import { emptyTrialBoardSemanticData } from './trial_board_semantic_data.js';

function sameCell(a, r, c) {
    return Boolean(a && a.r === r && a.c === c);
}

function buildRouteIndex(trialSemanticData) {
    const byCell = new Map();
    for (const route of trialSemanticData.routes || []) {
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
        trialSemanticData = null
    } = {}) {
        if (!presentationState) throw new Error('BOARD_PRESENTATION_STATE_REQUIRED');

        const profile = getBoardPresentationProfile(presentationState.contextMode);
        const trial = trialSemanticData || emptyTrialBoardSemanticData();
        const routeIndex = buildRouteIndex(trial);
        const interceptionIndex = buildMarkedCellIndex(trial.interceptionCandidates);
        const plannedIndex = buildMarkedCellIndex(trial.plannedIntercepts);
        const battleIndex = buildMarkedCellIndex(trial.battleMarkers);

        if (!state?.grid) {
            return Object.freeze({
                presentation: presentationState.snapshot(),
                profile,
                board: Object.freeze({ rows: 0, columns: 0 }),
                trial,
                cells: Object.freeze([])
            });
        }

        const cells = state.grid.map((row, r) => Object.freeze(row.map((_, c) => {
            const facts = this.cellViewDataService.getCellViewData(state, r, c);
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
                    available: trial.available,
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
                rows: state.grid.length,
                columns: state.grid.reduce((max, row) => Math.max(max, row?.length || 0), 0)
            }),
            trial,
            cells: Object.freeze(cells)
        });
    }
}

export default BoardPresentationDataService;
