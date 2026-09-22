import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createBoardPresentationDto } from '../game/src/presentation/board_presentation_contract.js';
import {
    buildTrialRouteCellIndex,
    createTrialBoardSemanticData,
    getTrialRouteCellVisualState,
    resolveTrialBattleMarkerState
} from '../game/src/presentation/trial_board_semantic_data.js';

function assertDirection(route, r, c, expected) {
    const state = getTrialRouteCellVisualState(route, r, c);
    assert.ok(state, `expected route state at ${r}:${c}`);
    assert.equal(state.routeDirection, expected);
}

const legacyRowColumnRoute = {
    id: 'legacy-route',
    path: [
        { row: 2, column: 2 },
        { row: 2, column: 3 },
        { row: 3, column: 3 },
        { row: 3, column: 2 },
        { row: 2, column: 2 }
    ]
};

assertDirection(legacyRowColumnRoute, 2, 2, 'east');
assertDirection(legacyRowColumnRoute, 2, 3, 'south');
assertDirection(legacyRowColumnRoute, 3, 3, 'west');
assertDirection(legacyRowColumnRoute, 3, 2, 'north');

const entryState = getTrialRouteCellVisualState(legacyRowColumnRoute, 2, 2);
assert.equal(entryState.routeId, 'legacy-route');
assert.equal(entryState.routeIndex, 0);
assert.equal(entryState.isRouteEntry, true);
assert.equal(entryState.isRouteEnd, false);
assert.equal(entryState.isActiveRoute, false);
assert.equal(Object.isFrozen(entryState), true);

const endRoute = {
    routeId: 'end-route',
    cells: [
        { r: 0, c: 0 },
        { r: 0, c: 1 }
    ],
    isActive: true
};
const endState = getTrialRouteCellVisualState(endRoute, 0, 1);
assert.equal(endState.routeIndex, 1);
assert.equal(endState.isRouteEntry, false);
assert.equal(endState.isRouteEnd, true);
assert.equal(endState.routeDirection, 'east');
assert.equal(endState.isActiveRoute, true);

const singletonRoute = {
    routeId: 'singleton',
    cells: [{ r: 4, c: 5 }],
    isActive: true
};
assert.equal(
    getTrialRouteCellVisualState(singletonRoute, 4, 5).routeDirection,
    null,
    'shared presentation semantics must not invent a direction for a one-cell route'
);
assert.equal(
    getTrialRouteCellVisualState(singletonRoute, 4, 5, {
        singletonDirectionFallback: 'east'
    }).routeDirection,
    'east',
    'legacy 2D renderer may explicitly preserve its historical one-cell east fallback'
);
assert.equal(getTrialRouteCellVisualState(singletonRoute, 9, 9), null);


assert.deepEqual(
    resolveTrialBattleMarkerState({ status: 'PENDING', isCurrent: false }),
    {
        status: 'PENDING',
        isCurrent: false,
        isPending: true,
        isActive: false,
        isResolved: false
    }
);
assert.deepEqual(
    resolveTrialBattleMarkerState({ status: 'ACTIVE', isCurrent: true }),
    {
        status: 'ACTIVE',
        isCurrent: true,
        isPending: false,
        isActive: true,
        isResolved: false
    }
);
assert.deepEqual(
    resolveTrialBattleMarkerState({ status: 'RESOLVED', isCurrent: true }),
    {
        status: 'RESOLVED',
        isCurrent: true,
        isPending: false,
        isActive: false,
        isResolved: true
    },
    'resolved current state remains distinct from active battle state'
);
assert.equal(
    resolveTrialBattleMarkerState({ status: 'UNKNOWN', isCurrent: false }).status,
    'PENDING',
    'unknown presentation status falls back to pending'
);
assert.equal(resolveTrialBattleMarkerState(null), null);

const trialData = createTrialBoardSemanticData({
    available: true,
    activeRouteId: 'singleton',
    routes: [singletonRoute]
});
const routeIndex = buildTrialRouteCellIndex(trialData);
assert.equal(routeIndex.size, 1);
assert.equal(routeIndex.get('4:5').routeDirection, null);
assert.equal(routeIndex.get('4:5').isRouteEntry, true);
assert.equal(routeIndex.get('4:5').isRouteEnd, true);

const fallbackToFirstRoute = createTrialBoardSemanticData({
    available: true,
    routes: [
        {
            routeId: 'first',
            cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }]
        },
        {
            routeId: 'second',
            cells: [{ r: 8, c: 8 }, { r: 8, c: 7 }]
        }
    ]
});
const firstRouteIndex = buildTrialRouteCellIndex(fallbackToFirstRoute);
assert.equal(firstRouteIndex.has('1:1'), true);
assert.equal(firstRouteIndex.has('1:2'), true);
assert.equal(firstRouteIndex.has('8:8'), false);
assert.equal(firstRouteIndex.has('8:7'), false);

const portableTrialDto = createBoardPresentationDto({
    presentation: {
        viewMode: '2D',
        contextMode: 'TRIAL',
        selectedCell: null,
        hoveredCell: null,
        focusCell: null
    },
    profile: {},
    board: { rows: 1, columns: 2 },
    trial: {
        available: true,
        activeRouteId: 'route-a',
        selectedInterceptCell: { r: 0, c: 1 },
        hoveredInterceptCell: { r: 0, c: 0 },
        routes: [],
        interceptionCandidates: [],
        plannedIntercepts: [],
        battleMarkers: [],
        enemyState: null
    },
    cells: [[]]
});
assert.deepEqual(
    portableTrialDto.trial.selectedInterceptCell,
    { r: 0, c: 1 },
    'portable Trial DTO must preserve selected interception cell for every renderer'
);
assert.deepEqual(
    portableTrialDto.trial.hoveredInterceptCell,
    { r: 0, c: 0 },
    'portable Trial DTO must preserve hovered interception cell for every renderer'
);

const presentationGridSource = await readFile(
    new URL('../game/src/ui/board_presentation_grid_component.js', import.meta.url),
    'utf8'
);
const web25DTrialSource = await readFile(
    new URL('../game/src/presentation/web25d_trial_overlay_renderer.js', import.meta.url),
    'utf8'
);
assert.match(
    presentationGridSource,
    /resolveTrialBattleMarkerState/,
    '2D presentation grid must consume shared battle lifecycle semantics'
);
assert.match(
    web25DTrialSource,
    /resolveTrialBattleMarkerState/,
    '2.5D Trial overlay must consume shared battle lifecycle semantics'
);
assert.doesNotMatch(
    presentationGridSource,
    /trial-battle-active', Boolean\(trial\?\.battleMarker\?\.isCurrent\)/,
    '2D active battle class must not be derived from current pointer alone'
);

const boardGridSource = await readFile(
    new URL('../game/src/ui/board_grid_component.js', import.meta.url),
    'utf8'
);
assert.match(
    boardGridSource,
    /getTrialRouteCellVisualState/,
    'BoardGrid must consume the shared Trial route presentation helper'
);
assert.doesNotMatch(
    boardGridSource,
    /\.getTrialRouteVisualState\s*\(/,
    'BoardGrid must not delegate Trial route visual semantics back to UIController'
);
assert.match(
    boardGridSource,
    /singletonDirectionFallback:\s*["']east["']/,
    'legacy one-cell east fallback must remain explicit at the 2D renderer boundary'
);

console.log('trial route visual semantic checks passed');