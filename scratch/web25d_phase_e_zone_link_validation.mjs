import assert from 'node:assert/strict';
import {
    getWeb25DZoneBoundaryDirections,
    getWeb25DLinkDirections
} from '../game/src/presentation/web25d_phase_e_renderer.js';

const zoneCell = Object.freeze({
    zone: Object.freeze({ zoneId: 'zone-a' }),
    edges: Object.freeze([
        Object.freeze({ direction: 'NORTH', zoneBoundary: true, linked: false }),
        Object.freeze({ direction: 'EAST', zoneBoundary: true, linked: true }),
        Object.freeze({ direction: 'SOUTH', zoneBoundary: false, linked: false }),
        Object.freeze({ direction: 'WEST', zoneBoundary: true, linked: true })
    ])
});

assert.deepEqual(
    getWeb25DZoneBoundaryDirections(zoneCell),
    ['NORTH', 'EAST', 'WEST'],
    'Zone overlay must consume only presentation-provided zone boundaries.'
);

assert.deepEqual(
    getWeb25DLinkDirections(zoneCell),
    ['EAST'],
    'Canonical Link overlay must draw a shared boundary once.'
);

assert.deepEqual(
    getWeb25DLinkDirections(zoneCell, { canonicalOnly: false }),
    ['EAST', 'WEST'],
    'Non-canonical inspection must preserve all presentation-provided linked edges.'
);

assert.deepEqual(
    getWeb25DZoneBoundaryDirections({ zone: null, edges: zoneCell.edges }),
    [],
    'Cells without Zone semantics must not gain a renderer-created Zone.'
);

assert.deepEqual(
    getWeb25DLinkDirections({ zone: null, edges: zoneCell.edges }),
    [],
    'Cells without Zone semantics must not gain a renderer-created Link.'
);

console.log('WEB25D_PHASE_E_ZONE_LINK_VALIDATION_OK');
