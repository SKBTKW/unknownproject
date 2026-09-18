import assert from "node:assert/strict";
import { TrialController } from "../flow/trial_controller.js";
import { ENEMY_TACTICS } from "../systems/enemy_tactic_resolver.js";

function assertApproxEqual(actual, expected, epsilon = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `expected ${actual} to be within ${epsilon} of ${expected}`
    );
}

function createController(route, armyStructure = null) {
    const controller = new TrialController();
    controller.state = {
        routes: [route],
        armyStructure,
        commander: armyStructure?.commander || null,
        forces: armyStructure?.forces || []
    };
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
    forceId: "FORCE_1",
    commander: { level: 2 },
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
assertApproxEqual(heavy.input.enemyDeployment.deployment.reserveSuppression, 55);
assertApproxEqual(
    heavy.input.enemyReserveSuppression,
    heavyController.powerResolver.resolveSuppression(55)
);
assertApproxEqual(heavy.input.enemyDeployment.deployment.deploymentRatio, 0.45);
assert.deepEqual(heavy.input.enemyDeployment.tactics, []);
assert.equal(heavy.input.enemyDeployment.selectedTactic, null);
assertApproxEqual(
    heavy.input.enemySuppression,
    heavyController.powerResolver.resolveSuppression(45)
);

const infiltratorController = createController({
    id: "R_LIGHT",
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    strategicSuppression: 40,
    forceId: "FORCE_1",
    commander: { level: 2 },
    forceProfile: {
        bodySize: "SMALL",
        equipment: ["LIGHT"],
        terrainAffinity: { FOREST: "HIGH" },
        marchTraits: ["ROUGH_TERRAIN"]
    }
});
const infiltrator = infiltratorController.createRouteInterceptionInput(
    "R_LIGHT",
    { r: 0, c: 1 },
    10
);
assert.equal(infiltrator.success, true);
assert.equal(infiltrator.input.enemyDeployment.profile.terrainAffinity.FOREST, "HIGH");
assert.deepEqual(infiltrator.input.enemyDeployment.profile.marchTraits, ["ROUGH_TERRAIN"]);
assert.equal(
    infiltrator.input.enemyDeployment.tactics.some(tactic => tactic.id === ENEMY_TACTICS.DISPERSED_INFILTRATION),
    true
);
assert.equal(
    infiltrator.input.enemyDeployment.tactics.some(tactic => tactic.id === ENEMY_TACTICS.FLANKING),
    true
);
assert.equal(infiltrator.input.enemyDeployment.selectedTactic.id, ENEMY_TACTICS.FLANKING);
assert.equal(infiltrator.input.enemySelectedTactic.id, ENEMY_TACTICS.FLANKING);
assert.equal(
    infiltrator.input.enemyDeployment.tacticAlternatives.some(tactic => tactic.id === ENEMY_TACTICS.DISPERSED_INFILTRATION),
    true
);

const coordinatedArmy = {
    forceCount: 3,
    commander: { level: 4 },
    forces: [{ id: "FORCE_1" }, { id: "FORCE_2" }, { id: "FORCE_3" }]
};
const coordinatedController = createController({
    id: "R_COORDINATED",
    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    strategicSuppression: 40,
    forceId: "FORCE_1",
    commander: { level: 4 },
    forceProfile: {
        bodySize: "SMALL",
        equipment: ["LIGHT"]
    }
}, coordinatedArmy);
const coordinated = coordinatedController.createRouteInterceptionInput(
    "R_COORDINATED",
    { r: 0, c: 1 },
    10
);
assert.equal(coordinated.success, true);
assert.equal(coordinated.input.enemyDeployment.selectedTactic.id, ENEMY_TACTICS.MAIN_FEINT);

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
assert.equal(baseline.input.enemyDeployment.selectedTactic, null);
assert.equal(
    baseline.input.enemySuppression,
    baselineController.powerResolver.resolveSuppression(100)
);

console.log("diagnose_trial_force_deployment_bridge: PASS");
