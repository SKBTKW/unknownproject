import assert from 'node:assert/strict';

import {
    canonicalRoadResolver,
    createRoadEdgeId,
    hasRoadBetween,
    normalizeRoadEdgeIds,
    parseRoadEdgeId,
    resolveRoadConnections
} from '../game/src/core/road_network.js';
import { serializeGameState } from '../game/src/core/state_serializer_base.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state_base.js';
import { BoardPresentationSemanticService } from '../game/src/presentation/board_presentation_semantic_service.js';
import { TrialRouteCostPolicy } from '../game/src/trial/scenario/trial_route_cost_policy.js';

const eastEdge = createRoadEdgeId({ r: 1, c: 2 }, { r: 1, c: 3 });
assert.equal(eastEdge, '1:2::1:3');
assert.equal(
    createRoadEdgeId({ r: 1, c: 3 }, { r: 1, c: 2 }),
    eastEdge,
    'road edge identity must be undirected and canonical'
);
assert.equal(createRoadEdgeId({ r: 1, c: 2 }, { r: 2, c: 3 }), null, 'diagonal road edges are invalid');
assert.deepEqual(parseRoadEdgeId(eastEdge), {
    edgeId: eastEdge,
    from: { r: 1, c: 2 },
    to: { r: 1, c: 3 }
});
assert.equal(parseRoadEdgeId('1:3::1:2'), null, 'non-canonical road ids are rejected');

assert.deepEqual(
    normalizeRoadEdgeIds([
        eastEdge,
        eastEdge,
        { from: { r: 0, c: 0 }, to: { r: 1, c: 0 } },
        'invalid'
    ]),
    ['0:0::1:0', '1:2::1:3']
);

const roadState = {
    roadEdges: new Set([eastEdge])
};
assert.equal(hasRoadBetween(roadState, { r: 1, c: 2 }, { r: 1, c: 3 }), true);
assert.equal(hasRoadBetween(roadState, { r: 1, c: 3 }, { r: 1, c: 2 }), true);
assert.equal(canonicalRoadResolver({
    gameState: roadState,
    from: { r: 1, c: 2 },
    to: { r: 1, c: 3 }
}), true);
assert.deepEqual(resolveRoadConnections(roadState, 1, 2), [{
    edgeId: eastEdge,
    direction: 'EAST',
    to: { r: 1, c: 3 }
}]);

const grid = [[
    { r: 0, c: 0, placed: true, terrain: { terrainId: 'GL1_PLAINS' } },
    { r: 0, c: 1, placed: true, terrain: { terrainId: 'GL1_PLAINS' } }
]];
const state = {
    grid,
    roadEdges: new Set(['0:0::0:1']),
    mergeLinks: new Set(),
    grantedConnectionPairs: new Set(),
    handOffering: [],
    reserveSlots: []
};
const serialized = serializeGameState(state);
assert.deepEqual(serialized.roadEdges, ['0:0::0:1']);

const restored = {};
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
assert.equal(restored.roadEdges instanceof Set, true);
assert.deepEqual([...restored.roadEdges], ['0:0::0:1']);

const legacySerialized = { ...serialized };
delete legacySerialized.roadEdges;
const restoredLegacy = {};
hydrateGameState(restoredLegacy, legacySerialized, { resolveCardMaster: () => null });
assert.equal(restoredLegacy.roadEdges instanceof Set, true);
assert.equal(restoredLegacy.roadEdges.size, 0, 'older saves without roads restore as an empty canonical network');

const semantic = new BoardPresentationSemanticService();
const edges = semantic.getLogicalEdges(state, {
    r: 0,
    c: 0,
    placed: true,
    placementGroupId: null,
    mergeGroupId: null
}, new Map());
const east = edges.find(edge => edge.direction === 'EAST');
assert.equal(east.road, true);
assert.deepEqual(east.neighbor, { r: 0, c: 1 });

const noRoadPolicy = new TrialRouteCostPolicy();
const plainState = { grid, roadEdges: new Set() };
const noRoadCost = noRoadPolicy.resolve({
    gameState: plainState,
    fromCell: grid[0][0],
    toCell: grid[0][1],
    from: { r: 0, c: 0 },
    to: { r: 0, c: 1 },
    force: { profile: { bodySize: 'MEDIUM', equipment: ['STANDARD'] } }
});
const roadCost = noRoadPolicy.resolve({
    gameState: state,
    fromCell: grid[0][0],
    toCell: grid[0][1],
    from: { r: 0, c: 0 },
    to: { r: 0, c: 1 },
    force: { profile: { bodySize: 'MEDIUM', equipment: ['STANDARD'] } }
});
assert.equal(roadCost, noRoadCost * 0.6, 'canonical roads feed the existing Trial road multiplier');

const injectedPolicy = new TrialRouteCostPolicy({ roadResolver: () => false });
assert.equal(
    injectedPolicy.resolve({
        gameState: state,
        fromCell: grid[0][0],
        toCell: grid[0][1],
        from: { r: 0, c: 0 },
        to: { r: 0, c: 1 },
        force: { profile: { bodySize: 'MEDIUM', equipment: ['STANDARD'] } }
    }),
    noRoadCost,
    'explicit roadResolver injection remains authoritative for focused tests or exceptional rules'
);

console.log('ROAD_NETWORK_FOUNDATION_OK');
