import assert from 'node:assert/strict';
import { getWeb25DTrialVisualFlags } from '../game/src/presentation/web25d_phase_f_renderer.js';

const empty = getWeb25DTrialVisualFlags({ trial: null });
assert.deepEqual(empty, {
    onRoute: false,
    entry: false,
    interceptionCandidate: false,
    interceptionSelected: false,
    plannedIntercept: false,
    battleMarker: false
});

const tactical = getWeb25DTrialVisualFlags({
    trial: {
        onRoute: true,
        route: { isRouteEntry: true },
        interceptionCandidate: { routeId: 'route-a' },
        interceptionSelected: true,
        plannedIntercept: { cell: { r: 1, c: 2 } },
        battleMarker: { cell: { r: 1, c: 2 } }
    }
});

assert.deepEqual(tactical, {
    onRoute: true,
    entry: true,
    interceptionCandidate: true,
    interceptionSelected: true,
    plannedIntercept: true,
    battleMarker: true
});

const routeOnly = getWeb25DTrialVisualFlags({
    trial: {
        onRoute: true,
        route: { isRouteEntry: false },
        interceptionCandidate: null,
        interceptionSelected: false,
        plannedIntercept: null,
        battleMarker: null
    }
});
assert.equal(routeOnly.onRoute, true);
assert.equal(routeOnly.entry, false);
assert.equal(routeOnly.interceptionCandidate, false);
assert.equal(routeOnly.battleMarker, false);

console.log('WEB25D_PHASE_F_TACTICAL_VISUAL_VALIDATION_OK');
