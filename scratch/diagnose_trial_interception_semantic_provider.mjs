import { TrialInterceptionSemanticProvider } from '../game/src/trial/presentation/trial_interception_semantic_provider.js';

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}: expected=${expected} actual=${actual}`);
    }
}

const provider = new TrialInterceptionSemanticProvider();

const grid = [[
    { placed: true, isHQ: false, placementGroupId: 10 },
    { placed: true, isHQ: false, placementGroupId: 20 },
    { placed: true, isHQ: true, placementGroupId: null }
]];

const route = {
    id: 'R1',
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]
};

const trialPresentationState = {
    previewDefenseAllocation: 4,
    getPlannedCellInfo(r, c) {
        return (r === 0 && c === 1)
            ? { routeId: 'R1' }
            : null;
    },
    isBlockPlannedByOtherRoute(routeId, blockId) {
        return routeId === 'R1' && blockId === 'placement:10';
    }
};

let previewCalls = 0;
const previewResolver = input => {
    previewCalls += 1;
    return {
        success: input.interceptCell.cellId === '0:1'
    };
};

const first = provider.getCellState({
    r: 0,
    c: 0,
    displayGrid: grid,
    activeRoute: route,
    trialPresentationState,
    previewResolver
});

assertEqual(first.onRoute, true, 'first on route');
assertEqual(first.canIntercept, false, 'other-route block not interceptable');
assertEqual(first.isBlockPlannedByOther, true, 'block conflict exposed');
assertEqual(first.reason, 'BLOCK_ALREADY_PLANNED', 'block conflict reason');
assertEqual(previewCalls, 0, 'domain resolver skipped when structurally blocked');

const second = provider.getCellState({
    r: 0,
    c: 1,
    displayGrid: grid,
    activeRoute: route,
    trialPresentationState,
    previewResolver
});

assertEqual(second.onRoute, true, 'second on route');
assertEqual(second.canIntercept, true, 'domain resolver can allow interception');
assertEqual(second.isPlanned, true, 'planned state preserved');
assertEqual(second.isPlannedActive, true, 'active-route plan identified');
assertEqual(previewCalls, 1, 'domain resolver called exactly once');

const hq = provider.getCellState({
    r: 0,
    c: 2,
    displayGrid: grid,
    activeRoute: route,
    trialPresentationState,
    previewResolver
});

assertEqual(hq.onRoute, true, 'HQ still belongs to route semantics');
assertEqual(hq.canIntercept, false, 'HQ cannot be interception candidate');
assertEqual(previewCalls, 1, 'HQ does not call domain resolver');

const collected = provider.collect({
    displayGrid: grid,
    activeRoute: route,
    trialPresentationState,
    previewResolver
});

assertEqual(collected.length, 3, 'collect emits route/planned semantic cells');
assertEqual(collected[1].cell.r, 0, 'logical row retained');
assertEqual(collected[1].cell.c, 1, 'logical column retained');

console.log('PASS: TrialInterceptionSemanticProvider');
