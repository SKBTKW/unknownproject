import assert from "node:assert/strict";
import { TrialRouteSuppressionAllocator } from "../scenario/trial_route_suppression_allocator.js";
import { TrialController } from "../flow/trial_controller.js";
import { TrialSkippedRouteResolutionService } from "../systems/trial_skipped_route_resolution_service.js";
import { InterceptionPowerResolver } from "../systems/interception_power_resolver.js";

const routes = [
    { id: "A", cells: [{ r: 0, c: 0 }, { r: 1, c: 0 }] },
    { id: "B", cells: [{ r: 0, c: 1 }, { r: 1, c: 1 }] },
    { id: "C", cells: [{ r: 0, c: 2 }, { r: 1, c: 2 }] }
];

const allocator = new TrialRouteSuppressionAllocator({
    weightResolver: ({ route }) => ({ A: 1, B: 2, C: 3 })[route.id]
});
const allocated = allocator.allocate({ routes, enemySuppression: 24 });
assert.deepEqual(allocated.map(route => route.strategicSuppression), [4, 8, 12]);
assert.equal(allocated.reduce((sum, route) => sum + route.strategicSuppression, 0), 24);
assert.equal(new TrialRouteSuppressionAllocator().allocate({ routes, enemySuppression: 24 }).length, 0);

const powerResolver = new InterceptionPowerResolver({ suppressionConversionRate: 5 });
const controller = new TrialController({ powerResolver });
controller.startScenario({
    id: "ROUTE_SUPPRESSION_DIAGNOSTIC",
    enemySuppression: 24,
    availableDefense: 10,
    ember: 20,
    maxEmber: 20,
    mystic: 0,
    routes: allocated
}, {
    cellResolver: (r, c) => ({
        r,
        c,
        placed: true,
        isHQ: false,
        terrainId: "GL1_PLAINS",
        elevation: 1
    })
});

const interceptInput = controller.createRouteInterceptionInput("B", { r: 0, c: 1 }, 2);
assert.equal(interceptInput.success, true);
assert.equal(interceptInput.input.enemySuppression, 40);

const skippedService = new TrialSkippedRouteResolutionService({ powerResolver });
const skippedState = {
    enemy: { totalSuppression: 120, strategicSuppression: 24 },
    routes: allocated,
    planActivated: true,
    interceptionPlan: {
        routes: [{ routeId: "C", status: "SKIP" }]
    },
    skippedRouteResults: {},
    routeProgress: {}
};
const skipped = skippedService.resolve(skippedState, "C");
assert.equal(skipped.success, true);
assert.equal(skipped.traversalResult.sourcePower, 60);

console.log("diagnose_trial_route_suppression_allocator: PASS");
