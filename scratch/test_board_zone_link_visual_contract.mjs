import assert from 'node:assert/strict';
import {
    ZONE_LINK_EDGE_KINDS,
    resolveZoneLinkEdgeVisual,
    buildZoneLinkVisuals
} from '../game/src/presentation/board_zone_link_visual_contract.js';

assert.equal(
    resolveZoneLinkEdgeVisual({ direction: 'EAST', sameZone: true, zoneBoundary: false, linked: false }).kind,
    ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL
);
assert.equal(
    resolveZoneLinkEdgeVisual({ direction: 'EAST', sameZone: false, zoneBoundary: true, linked: false }).kind,
    ZONE_LINK_EDGE_KINDS.ZONE_BOUNDARY
);
assert.equal(
    resolveZoneLinkEdgeVisual({ direction: 'EAST', sameZone: false, zoneBoundary: true, linked: true }).kind,
    ZONE_LINK_EDGE_KINDS.LINK
);

const visuals = buildZoneLinkVisuals({
    zone: { zoneId: 'zone:1' },
    links: [{ linkId: 'zone:1::zone:2' }],
    edges: [
        { direction: 'NORTH', sameZone: true, linked: false, zoneBoundary: false },
        { direction: 'EAST', sameZone: false, linked: true, zoneBoundary: true }
    ]
});
assert.equal(visuals.zoneId, 'zone:1');
assert.deepEqual(visuals.linkIds, ['zone:1::zone:2']);
assert.deepEqual(visuals.edges.map(edge => edge.kind), [
    ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL,
    ZONE_LINK_EDGE_KINDS.LINK
]);

console.log('board zone/link visual contract ok');
