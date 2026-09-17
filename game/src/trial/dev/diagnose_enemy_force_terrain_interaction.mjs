import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../systems/enemy_force_terrain_interaction_resolver.js";

const resolver = new EnemyForceTerrainInteractionResolver();

const largeHeavyForest = resolver.resolve({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainId: "GL2_FOREST"
});
assert.equal(largeHeavyForest.deployment, "CONSTRAINED");
assert.equal(largeHeavyForest.mobility, "DISADVANTAGE");
assert.equal(largeHeavyForest.ambushExposure, "HIGH");
assert.ok(largeHeavyForest.combatTraits.includes("FRONTAL_BREAKTHROUGH"));
assert.ok(largeHeavyForest.movementConstraints.includes("HEAVY_EQUIPMENT_ROUGH_TERRAIN"));

const smallLightForest = resolver.resolve({
    bodySize: "SMALL",
    equipment: ["LIGHT"],
    terrainId: "GL3_DEEP_FOREST"
});
assert.equal(smallLightForest.mobility, "ADVANTAGE");
assert.equal(smallLightForest.ambushExposure, "LOW");
assert.ok(smallLightForest.combatTraits.includes("INFILTRATION_FRIENDLY"));
assert.ok(smallLightForest.combatTraits.includes("ROUGH_TERRAIN_FRIENDLY"));

const mountedOpen = resolver.resolve({
    bodySize: "MEDIUM",
    equipment: ["MOUNTED"],
    terrainId: "GL1_PLAINS"
});
assert.ok(mountedOpen.combatTraits.includes("OPEN_GROUND_MOBILITY"));
assert.ok(mountedOpen.combatTraits.includes("FLANKING_CAPABLE"));
assert.equal(mountedOpen.movementConstraints.length, 0);

const baggageWetland = resolver.resolve({
    bodySize: "MEDIUM",
    equipment: ["BAGGAGE"],
    terrainId: "E0_WETLAND"
});
assert.equal(baggageWetland.logistics, "EXTENDED");
assert.ok(baggageWetland.movementConstraints.includes("BAGGAGE_SLOWS_COLUMN"));

console.log("diagnose_enemy_force_terrain_interaction: PASS");
