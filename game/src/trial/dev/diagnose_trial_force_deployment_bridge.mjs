import assert from "node:assert/strict";
import { TrialController } from "../flow/trial_controller.js";

function createController(route) {
    const controller = new TrialController();
    controller.state = { routes: [route] };
    controller.cellResolver = (r, c) => ({
        r,
        c,
        placed: true,
        isHQ: false,
        terrain: {
            terrainId: "GL2_FOREST",
            e: 1,
            gl: 2
        }
    });
    return controller;
}

const heavyController = createController({
    id: "R_HEAVY",
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    strategicSuppression: 100,
    forceProfile: {
        bodySize: "LARGE",
        equipment: ["HEAVY"]
    }
});
const heavy = heavyController.createRouteInterceptionInput(
    "R_HEAVY",
    { r: 0, c: 1 },
    10
);
assert.equal(heavy.success, true);
assert.equal(heavy.input.enemyStrategicSuppression, 100);
assert.equal(heavy.input.enemyReserveSuppression, 55);
assert.equal(heavy.input.enemyDeployment.deployment.deploymentRatio, 0.45);
assert.equal(
    heavy.input.enemySuppression,
    heavyController.powerResolver.resolveSuppression(45)
);

const baselineController = createController({
    id: "R_BASELINE",
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    strategicSuppression: 100
});
const baseline = baselineController.createRouteInterceptionInput(
    "R_BASELINE",
    { r: 0, c: 1 },
    10
);
assert.equal(baseline.success, true);
assert.equal(baseline.input.enemyDeployment.profile.bodySize, "MEDIUM");
assert.deepEqual(baseline.input.enemyDeployment.profile.equipment, ["STANDARD"]);
assert.equal(baseline.input.enemyReserveSuppression, 0);
assert.equal(
    baseline.input.enemySuppression,
    baselineController.powerResolver.resolveSuppression(100)
);

console.log("diagnose_trial_force_deployment_bridge: PASS");
