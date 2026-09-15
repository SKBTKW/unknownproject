import assert from 'node:assert/strict';
import { createTrialBoardSemanticData } from '../game/src/presentation/trial_board_semantic_data.js';

const data = createTrialBoardSemanticData({
    available: true,
    activeRouteId: 'route:a',
    selectedInterceptCell: { r: 1, c: 1 },
    hoveredInterceptCell: { r: 2, c: 3 },
    routes: [{ routeId: 'route:a', cells: [{ r: 0, c: 0 }, { r: 1, c: 1 }] }]
});

assert.deepEqual(data.selectedInterceptCell, { r: 1, c: 1 });
assert.deepEqual(data.hoveredInterceptCell, { r: 2, c: 3 });
assert.notStrictEqual(data.selectedInterceptCell, data.hoveredInterceptCell);
assert.equal(Object.isFrozen(data), true);
assert.equal(Object.isFrozen(data.hoveredInterceptCell), true);

console.log('trial hover semantic projection ok');
