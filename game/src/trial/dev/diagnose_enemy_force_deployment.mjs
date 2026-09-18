import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../systems/enemy_force_deployment_resolver.js";

const terrainResolver = new EnemyForceTerrainInteractionResolver();
const deploymentResolver = new EnemyForceDeploymentResolver();

function assertApproxEqual(actual, expected, epsilon = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `expected ${actual} to be within ${epsilon} of ${expected}`
    );
}

function resolveCase({ bodySize, equipment, terrainId, forceSuppression = 100 }) {
    const interaction = terrainResolver.resolve({ bodySize, equipment, terrainId });
    return deploymentResolver.resolve({ forceSuppression, interaction });
}

const mediumStandardOpen = resolveCase({
    bodySize: "MEDIUM",
    equipment: ["STANDARD"],
    terrainId: "GL1_PLAINS"
});
assert.equal(mediumStandardOpen.deploymentRatio, 1);
assert.equal(mediumStandardOpen.deployedSuppression, 100);
assert.equal(mediumStandardOpen.reserveSuppression, 0);

const largeHeavyForest = resolveCase({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainId: "GL2_FOREST"
});
assertApproxEqual(largeHeavyForest.deploymentRatio, 0.45);
assertApproxEqual(largeHeavyForest.deployedSuppression, 45);
assertApproxEqual(largeHeavyForest.reserveSuppression, 55);
assert.ok(largeHeavyForest.reasons.includes("BODY_DEPLOYMENT_CONSTRAINED"));
assert.ok(largeHeavyForest.reasons.includes("EQUIPMENT_DEPLOYMENT_CONSTRAINED"));

const smallLightDeepForest = resolveCase({
    bodySize: "SMALL",
    equipment: ["LIGHT"],
    terrainId: "GL3_DEEP_FOREST"
});
assert.equal(smallLightDeepForest.deploymentRatio, 1);
assert.equal(smallLightDeepForest.reserveSuppression, 0);

const largeLightForest = resolveCase({
    bodySize: "LARGE",
    equipment: ["LIGHT"],
    terrainId: "GL2_FOREST"
});
assertApproxEqual(largeLightForest.deploymentRatio, 0.85);
assert.ok(largeLightForest.deploymentRatio > largeHeavyForest.deploymentRatio);

const conserved = resolveCase({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainId: "E3_MOUNTAIN",
    forceSuppression: 73
});
assert.equal(
    conserved.deployedSuppression + conserved.reserveSuppression,
    conserved.totalSuppression
);
assert.equal(conserved.totalSuppression, 73);

console.log("diagnose_enemy_force_deployment: PASS");
