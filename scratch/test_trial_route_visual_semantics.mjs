import assert from 'node:assert/strict';

import {
    buildTrialRouteCellIndex,
    createTrialBoardSemanticData,
    getTrialRouteCellVisualState
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

console.log('trial route visual semantic checks passed');
