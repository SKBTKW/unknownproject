import assert from "node:assert/strict";
import { TRIAL_MARCH_TRAITS, TrialRouteCostPolicy } from "../scenario/trial_route_cost_policy.js";
import { TrialRouteGenerator } from "../scenario/trial_route_generator.js";

const terrain = id => ({ id, terrainId: id });
const cell = (r, c, id, extra = {}) => ({
    r,
    c,
    placed: true,
    isHQ: false,
    terrain: terrain(id),
    ...extra
});

const grid = [
    [
        cell(0, 0, "GL1_PLAINS"),
        cell(0, 1, "GL1_PLAINS"),
        cell(0, 2, "GL1_PLAINS"),
        cell(0, 3, "GL1_PLAINS")
    ],
    [
        cell(1, 0, "GL1_PLAINS"),
        cell(1, 1, "GL2_FOREST"),
        cell(1, 2, "GL2_FOREST"),
        cell(1, 3, "HQ", { isHQ: true })
    ]
];
const gameState = { grid };
const ingresses = [{ id: "WEST", r: 1, c: 0 }];
const policy = new TrialRouteCostPolicy();
const generator = new TrialRouteGenerator({ costResolver: context => policy.resolve(context) });

function routeFor(profile) {
    const routes = generator.generate({
        gameState,
        ingresses,
        armyStructure: {
            forces: [{ id: "FORCE_1", profile }]
        }
    });
    assert.equal(routes.length, 1);
    return routes[0];
}

const largeHeavy = routeFor({
    bodySize: "LARGE",
    equipment: ["HEAVY"]
});
assert.deepEqual(largeHeavy.cells, [
    { r: 1, c: 0 },
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 },
    { r: 0, c: 3 },
    { r: 1, c: 3 }
]);

const smallLight = routeFor({
    bodySize: "SMALL",
    equipment: ["LIGHT"]
});
assert.deepEqual(smallLight.cells, [
    { r: 1, c: 0 },
    { r: 1, c: 1 },
    { r: 1, c: 2 },
    { r: 1, c: 3 }
]);
assert.ok(smallLight.movementCost < largeHeavy.movementCost);

const forestAdaptedLargeHeavy = routeFor({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainAffinity: { FOREST: "HIGH" }
});
assert.deepEqual(forestAdaptedLargeHeavy.cells, [
    { r: 1, c: 0 },
    { r: 1, c: 1 },
    { r: 1, c: 2 },
    { r: 1, c: 3 }
]);
assert.ok(forestAdaptedLargeHeavy.movementCost < largeHeavy.movementCost);

const mediumStandardForest = policy.resolve({
    gameState,
    fromCell: grid[1][0],
    toCell: grid[1][1],
    from: { r: 1, c: 0 },
    to: { r: 1, c: 1 },
    force: { profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] } }
});
const roughTerrainForest = policy.resolve({
    gameState,
    fromCell: grid[1][0],
    toCell: grid[1][1],
    from: { r: 1, c: 0 },
    to: { r: 1, c: 1 },
    force: {
        profile: {
            bodySize: "MEDIUM",
            equipment: ["STANDARD"],
            marchTraits: [TRIAL_MARCH_TRAITS.ROUGH_TERRAIN]
        }
    }
});
assert.ok(roughTerrainForest < mediumStandardForest);

const forcedMarchWithoutTradeoff = policy.resolve({
    gameState,
    fromCell: grid[1][0],
    toCell: grid[1][1],
    from: { r: 1, c: 0 },
    to: { r: 1, c: 1 },
    force: {
        profile: {
            bodySize: "MEDIUM",
            equipment: ["STANDARD"],
            marchTraits: [TRIAL_MARCH_TRAITS.FORCED_MARCH]
        }
    }
});
assert.equal(forcedMarchWithoutTradeoff, mediumStandardForest);

const noRoad = policy.resolve({
    gameState,
    fromCell: grid[0][0],
    toCell: grid[0][1],
    from: { r: 0, c: 0 },
    to: { r: 0, c: 1 },
    force: { profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] } }
});
const roadPolicy = new TrialRouteCostPolicy({ roadResolver: () => true });
const withRoad = roadPolicy.resolve({
    gameState,
    fromCell: grid[0][0],
    toCell: grid[0][1],
    from: { r: 0, c: 0 },
    to: { r: 0, c: 1 },
    force: { profile: { bodySize: "MEDIUM", equipment: ["STANDARD"] } }
});
assert.ok(withRoad < noRoad);

console.log("diagnose_trial_route_cost_policy: PASS");
