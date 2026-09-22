import { CellViewDataService } from '../services/cell_view_data_service.js';
import { getBoardPresentationProfile } from './board_presentation_profile.js';
import { buildTrialRouteCellIndex, emptyTrialBoardSemanticData } from './trial_board_semantic_data.js';
import { BoardPresentationSemanticService } from './board_presentation_semantic_service.js';

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

function buildMarkedCellIndex(items) {
    const map = new Map();
    for (const item of items || []) {
        if (!item?.cell) continue;
        map.set(`${item.cell.r}:${item.cell.c}`, item);
    }
    return map;
}

function buildMarkedCellListIndex(items) {
    const map = new Map();
    for (const item of items || []) {
        if (!item?.cell) continue;
        const key = `${item.cell.r}:${item.cell.c}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }
    return map;
}

function projectDefenseAllocation(item, disclose) {
    if (!item) return item;
    if (disclose) return item;
    const { defenseAllocation: _hiddenDefenseAllocation, ...visible } = item;
    return Object.freeze(visible);
}

function projectDefenseAllocations(items, disclose) {
    return (items || []).map(item => projectDefenseAllocation(item, disclose));
}

export class BoardPresentationDataService {
    constructor({ cellViewDataService = null, semanticService = null } = {}) {
        this.cellViewDataService = cellViewDataService || new CellViewDataService();
        this.semanticService = semanticService || new BoardPresentationSemanticService({
            cellViewDataService: this.cellViewDataService
        });
    }

    getBoard(state, {
        presentationState,
        trialSemanticData = null,
        gridOverride = null,
        interactionQuery = null
    } = {}) {
        if (!presentationState) throw new Error('BOARD_PRESENTATION_STATE_REQUIRED');

        const sourceState = createStateGridView(state, gridOverride);
        const grid = sourceState?.grid;
        const profile = getBoardPresentationProfile(
            presentationState.contextMode,
            presentationState.viewPreset
        );
        const trial = trialSemanticData || emptyTrialBoardSemanticData();
        const showRoutes = profile.trialRoutes !== "HIDDEN";
        const showInterception = profile.interception !== "HIDDEN";
        const showDefenseAllocation = profile.defenseAllocation !== "HIDDEN";
        const showBattleMarkers = profile.battleMarkers !== "HIDDEN";
        const showTacticalEffects = profile.tacticalEffects !== "HIDDEN";
        const showTrialOperationalData = showRoutes || showInterception || showBattleMarkers || showTacticalEffects;

        const visibleTrial = Object.freeze({
            available: Boolean(trial.available && showTrialOperationalData),
            activeRouteId: showRoutes ? trial.activeRouteId : null,
            routeSelectionEnabled: Boolean(showRoutes && trial.routeSelectionEnabled),
            selectedInterceptCell: showInterception ? trial.selectedInterceptCell : null,
            hoveredInterceptCell: showInterception ? trial.hoveredInterceptCell : null,
            routes: Object.freeze(showRoutes ? [...(trial.routes || [])] : []),
            interceptionCandidates: Object.freeze(
                showInterception ? [...(trial.interceptionCandidates || [])] : []
            ),
            plannedIntercepts: Object.freeze(
                showInterception
                    ? projectDefenseAllocations(trial.plannedIntercepts, showDefenseAllocation)
                    : []
            ),
            battleMarkers: Object.freeze(
                showBattleMarkers
                    ? projectDefenseAllocations(trial.battleMarkers, showDefenseAllocation)
                    : []
            ),
            tacticalEffects: Object.freeze(
                showTacticalEffects ? [...(trial.tacticalEffects || [])] : []
            ),
            enemyState: showTrialOperationalData ? trial.enemyState : null
        });

        const routeIndex = showRoutes ? buildTrialRouteCellIndex(visibleTrial) : new Map();
        const interceptionIndex = showInterception
            ? buildMarkedCellIndex(visibleTrial.interceptionCandidates)
            : new Map();
        const plannedIndex = showInterception
            ? buildMarkedCellIndex(visibleTrial.plannedIntercepts)
            : new Map();
        const battleIndex = showBattleMarkers
            ? buildMarkedCellIndex(visibleTrial.battleMarkers)
            : new Map();
        const tacticalEffectIndex = showTacticalEffects
            ? buildMarkedCellListIndex(visibleTrial.tacticalEffects)
            : new Map();
        const linkIndex = this.semanticService.buildLinkIndex(sourceState);

        if (!grid) {
            return Object.freeze({
                presentation: presentationState.snapshot(),
                profile,
                board: Object.freeze({ rows: 0, columns: 0 }),
                trial: visibleTrial,
                cells: Object.freeze([])
            });
        }

        const cells = grid.map((row, r) => Object.freeze(row.map((sourceCell, c) => {
            const facts = this.cellViewDataService.getCellViewData(sourceState, r, c);
            if (!facts) return null;

            const key = `${r}:${c}`;
            const route = routeIndex.get(key) || null;
            const interception = interceptionIndex.get(key) || null;
            const planned = plannedIndex.get(key) || null;
            const battle = battleIndex.get(key) || null;
            const tacticalEffects = tacticalEffectIndex.get(key) || [];
            const semantic = this.semanticService.getCellSemantic(sourceState, facts, linkIndex);
            const display = Object.freeze({
                ...(semantic.display || {}),
                searched: Boolean(sourceCell?.searched)
            });

            return Object.freeze({
                ...facts,
                ...semantic,
                display,
                interaction: Object.freeze({
                    selected: sameCell(presentationState.selectedCell, r, c),
                    hovered: sameCell(presentationState.hoveredCell, r, c),
                    focused: sameCell(presentationState.focusCell, r, c),
                    placedThisTurn: Boolean(interactionQuery?.isCellPlacedThisTurn?.(r, c))
                }),
                trial: Object.freeze({
                    available: visibleTrial.available,
                    onRoute: Boolean(route),
                    route,
                    interceptionCandidate: interception,
                    interceptionSelected: sameCell(visibleTrial.selectedInterceptCell, r, c),
                    interceptionHovered: sameCell(visibleTrial.hoveredInterceptCell, r, c),
                    plannedIntercept: planned,
                    battleMarker: battle,
                    tacticalEffects: Object.freeze([...tacticalEffects])
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
