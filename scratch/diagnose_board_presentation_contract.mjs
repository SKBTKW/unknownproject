import {
    BoardPresentationState,
    BOARD_VIEW_MODES,
    BOARD_CONTEXT_MODES
} from '../game/src/presentation/board_presentation_state.js';
import { BoardPresentationDataService } from '../game/src/presentation/board_presentation_data_service.js';
import { createTrialBoardSemanticData } from '../game/src/presentation/trial_board_semantic_data.js';

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected=${expected} actual=${actual}`);
    }
}

function createGridState() {
    return {
        grid: [
            [
                { placed: true, isHQ: false, terrain: { terrainId: 'PLAINS', category: 'LAND', nameKey: 'TERRAIN_PLAINS' } },
                { placed: true, isHQ: false, terrain: { terrainId: 'FOREST', category: 'LAND', nameKey: 'TERRAIN_FOREST' } }
            ],
            [
                { placed: true, isHQ: false, terrain: { terrainId: 'HILL', category: 'LAND', nameKey: 'TERRAIN_HILL' } },
                { placed: true, isHQ: true, terrain: { terrainId: 'HQ', category: 'HQ', nameKey: 'TERRAIN_HQ_NAME' } }
            ]
        ]
    };
}

const cellViewDataService = {
    getCellViewData(state, r, c) {
        const cell = state.grid[r][c];
        return {
            r,
            c,
            placed: Boolean(cell.placed),
            isHQ: Boolean(cell.isHQ),
            terrainId: cell.terrain?.terrainId || null,
            category: cell.terrain?.category || null,
            nameKey: cell.terrain?.nameKey || null,
            hasSocket: false,
            socketResource: null,
            yields: { food: 0, wood: 0, defense: 0, mystic: 0 },
            baseYields: { food: 0, wood: 0, defense: 0, mystic: 0 },
            primaryYield: null,
            modifiers: [],
            placementGroupId: null,
            mergeGroupId: null
        };
    }
};

function createTrialData() {
    return createTrialBoardSemanticData({
        available: true,
        activeRouteId: 'R1',
        routes: [
            {
                routeId: 'R1',
                cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
                entryCell: { r: 0, c: 0 },
                entrySide: 'north'
            }
        ],
        interceptionCandidates: [
            { cell: { r: 0, c: 1 }, canIntercept: true }
        ],
        plannedIntercepts: [
            { cell: { r: 0, c: 1 }, routeId: 'R1', defenseAllocation: 3 }
        ],
        battleMarkers: [
            { cell: { r: 0, c: 1 }, routeId: 'R1', isCurrent: true }
        ],
        enemyState: {
            totalSuppression: 10
        }
    });
}

function testFourCombinationsAndPersistence() {
    const state = new BoardPresentationState({
        selectedCell: { r: 1, c: 0 },
        focusCell: { r: 1, c: 1 }
    });

    assertEqual(state.viewMode, BOARD_VIEW_MODES.STRATEGIC_2D, 'initial view');
    assertEqual(state.contextMode, BOARD_CONTEXT_MODES.NORMAL, 'initial context');

    state.toggleViewMode();
    assertEqual(state.viewMode, BOARD_VIEW_MODES.WORLD_2_5D, '2D -> 2.5D');
    assertEqual(state.contextMode, BOARD_CONTEXT_MODES.NORMAL, 'view toggle preserves context');

    state.toggleContextMode();
    assertEqual(state.viewMode, BOARD_VIEW_MODES.WORLD_2_5D, 'context toggle preserves view');
    assertEqual(state.contextMode, BOARD_CONTEXT_MODES.TRIAL, 'NORMAL -> TRIAL');

    state.toggleViewMode();
    assertEqual(state.viewMode, BOARD_VIEW_MODES.STRATEGIC_2D, '2.5D TRIAL -> 2D TRIAL');
    assertEqual(state.contextMode, BOARD_CONTEXT_MODES.TRIAL, 'TRIAL preserved');

    state.toggleContextMode();
    assertEqual(state.viewMode, BOARD_VIEW_MODES.STRATEGIC_2D, '2D preserved');
    assertEqual(state.contextMode, BOARD_CONTEXT_MODES.NORMAL, 'TRIAL -> NORMAL');

    assertEqual(state.selectedCell.r, 1, 'selected row preserved');
    assertEqual(state.selectedCell.c, 0, 'selected column preserved');
    assertEqual(state.focusCell.r, 1, 'focus row preserved');
    assertEqual(state.focusCell.c, 1, 'focus column preserved');
}

function testNormalMasksTrialOperationalFacts() {
    const presentationState = new BoardPresentationState({
        contextMode: BOARD_CONTEXT_MODES.NORMAL
    });
    const service = new BoardPresentationDataService({ cellViewDataService });

    const readModel = service.getBoard(createGridState(), {
        presentationState,
        trialSemanticData: createTrialData()
    });

    assertEqual(readModel.trial.available, false, 'NORMAL hides trial availability');
    assertEqual(readModel.trial.routes.length, 0, 'NORMAL hides routes');
    assertEqual(readModel.trial.interceptionCandidates.length, 0, 'NORMAL hides interception');
    assertEqual(readModel.trial.plannedIntercepts.length, 0, 'NORMAL hides planned intercepts');
    assertEqual(readModel.trial.battleMarkers.length, 0, 'NORMAL hides battle markers');
    assertEqual(readModel.trial.enemyState, null, 'NORMAL hides enemy state');
    assertEqual(readModel.cells[0][0].trial.onRoute, false, 'NORMAL cell hides route');
}

function testTrialExposesOnlyProvidedFacts() {
    const presentationState = new BoardPresentationState({
        contextMode: BOARD_CONTEXT_MODES.TRIAL
    });
    const service = new BoardPresentationDataService({ cellViewDataService });

    const readModel = service.getBoard(createGridState(), {
        presentationState,
        trialSemanticData: createTrialData()
    });

    assertEqual(readModel.trial.available, true, 'TRIAL exposes availability');
    assertEqual(readModel.trial.routes.length, 1, 'TRIAL exposes route');
    assertEqual(readModel.trial.enemyState.totalSuppression, 10, 'TRIAL exposes supplied enemy facts');
    assertEqual(readModel.cells[0][0].trial.onRoute, true, 'route entry exposed');
    assertEqual(readModel.cells[0][0].trial.route.isRouteEntry, true, 'entry marker exposed');
    assertEqual(readModel.cells[0][1].trial.interceptionCandidate.canIntercept, true, 'candidate exposed');
    assertEqual(readModel.cells[0][1].trial.plannedIntercept.defenseAllocation, 3, 'plan exposed');
    assertEqual(readModel.cells[0][1].trial.battleMarker.isCurrent, true, 'battle marker exposed');
}

function testTrialContextWithoutActualTrialIsValid() {
    const presentationState = new BoardPresentationState({
        contextMode: BOARD_CONTEXT_MODES.TRIAL
    });
    const service = new BoardPresentationDataService({ cellViewDataService });

    const readModel = service.getBoard(createGridState(), {
        presentationState
    });

    assertEqual(readModel.presentation.contextMode, BOARD_CONTEXT_MODES.TRIAL, 'TRIAL view remains active');
    assertEqual(readModel.trial.available, false, 'no actual Trial is valid');
    assertEqual(readModel.trial.routes.length, 0, 'no fake route appears');
}

function testGridOverridePreservesPrototypeHelpers() {
    class MockGameState {
        constructor() {
            this.grid = [[{ placed: false, isHQ: false }]];
        }
        domainHelper() {
            return 'alive';
        }
    }

    let helperResult = null;
    const service = new BoardPresentationDataService({
        cellViewDataService: {
            getCellViewData(state, r, c) {
                helperResult = state.domainHelper();
                return {
                    r, c, placed: Boolean(state.grid[r][c].placed), isHQ: false,
                    terrainId: null, category: null, nameKey: null,
                    hasSocket: false, socketResource: null,
                    yields: {}, baseYields: {}, primaryYield: null, modifiers: [],
                    placementGroupId: null, mergeGroupId: null
                };
            }
        }
    });

    const state = new MockGameState();
    const override = [[{ placed: true, isHQ: false }]];
    const presentationState = new BoardPresentationState();

    const readModel = service.getBoard(state, {
        presentationState,
        gridOverride: override
    });

    assertEqual(helperResult, 'alive', 'prototype helper preserved');
    assertEqual(readModel.cells[0][0].placed, true, 'override grid used');
    assertEqual(state.grid[0][0].placed, false, 'original GameState grid untouched');
}

function run() {
    console.log('====================================================');
    console.log('Board Presentation Contract Diagnostic');
    console.log('====================================================');

    const tests = [
        ['four combinations + logical state persistence', testFourCombinationsAndPersistence],
        ['NORMAL masks Trial operational facts', testNormalMasksTrialOperationalFacts],
        ['TRIAL exposes supplied facts', testTrialExposesOnlyProvidedFacts],
        ['TRIAL context without actual Trial', testTrialContextWithoutActualTrialIsValid],
        ['grid override preserves GameState prototype', testGridOverridePreservesPrototypeHelpers]
    ];

    for (const [name, test] of tests) {
        test();
        console.log(`PASS: ${name}`);
    }

    console.log('====================================================');
    console.log(`PASS: ${tests.length}/${tests.length}`);
    console.log('====================================================');
}

run();
