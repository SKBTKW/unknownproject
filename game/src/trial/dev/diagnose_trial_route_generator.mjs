import assert from "node:assert/strict";
import { TrialRouteGenerator } from "../scenario/trial_route_generator.js";

function cell(r, c, { terrainId = "GL1_PLAINS", isHQ = false, road = false } = {}) {
    return {
        r,
        c,
        placed: true,
        isHQ,
        road,
        terrain: { id: terrainId }
    };
}

const grid = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => cell(r, c))
);
grid[2][2] = cell(2, 2, { isHQ: true });

// Direct route from north is blocked by mountain at (1,2).
grid[1][2] = cell(1, 2, { terrainId: "E3_MOUNTAIN" });

// Left detour is road and therefore cheaper than right detour.
for (const [r, c] of [[0,1], [1,1], [2,1]]) {
    grid[r][c] = cell(r, c, { road: true });
}

const state = {
    grid,
    warningState: "IMMINENT",
    intel: { knownDirection: "EAST" }
};

const costResolver = ({ toCell }) => toCell.road ? 0.5 : 1;
const generator = new TrialRouteGenerator({ costResolver });

const ingress = { id: "N2", r: 0, c: 2, edges: ["NORTH"] };
const routes = generator.generate({
    gameState: state,
    ingresses: [ingress],
    trialIndex: 1,
    threat: { strategicSuppression: 10 }
});

assert.equal(routes.length, 1);
assert.equal(routes[0].id, "ROUTE_N2");
assert.deepEqual(routes[0].cells, [
    { r: 0, c: 2 },
    { r: 0, c: 1 },
    { r: 1, c: 1 },
    { r: 2, c: 1 },
    { r: 2, c: 2 }
]);
assert.equal(routes[0].movementCost, 2.5);
assert.equal(routes[0].cells.some(({ r, c }) => r === 1 && c === 2), false);

// Warning/Intel are not route truth inputs.
state.warningState = "CALM";
state.intel = { knownDirection: "WEST", confidence: 0 };
assert.deepEqual(
    generator.generate({ gameState: state, ingresses: [ingress], trialIndex: 1, threat: { strategicSuppression: 10 } }),
    routes
);

// Without an explicit cost resolver, no route truth is invented.
assert.deepEqual(new TrialRouteGenerator().generate({ gameState: state, ingresses: [ingress] }), []);

// Unreachable HQ produces no route instead of violating mountain constraints.
const blockedGrid = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => cell(r, c, { terrainId: "E3_MOUNTAIN" }))
);
blockedGrid[0][1] = cell(0, 1);
blockedGrid[1][1] = cell(1, 1, { isHQ: true });
const blocked = generator.generate({
    gameState: { grid: blockedGrid },
    ingresses: [{ id: "N1", r: 0, c: 1, edges: ["NORTH"] }]
});
assert.deepEqual(blocked, [{
    id: "ROUTE_N1",
    ingressId: "N1",
    ingress: { r: 0, c: 1, edges: ["NORTH"] },
    cells: [{ r: 0, c: 1 }, { r: 1, c: 1 }],
    movementCost: 1
}]);

console.log("diagnose_trial_route_generator: PASS");
