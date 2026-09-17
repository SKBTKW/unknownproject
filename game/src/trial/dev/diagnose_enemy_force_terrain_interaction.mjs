import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../systems/enemy_force_terrain_interaction_resolver.js";

const resolver = new EnemyForceTerrainInteractionResolver();

const largeHeavyForest = resolver.resolve({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainId: "GL2_FOREST"
});
assert.equal(largeHeavyForest.equipmentClass, "HEAVY");
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
assert.equal(smallLightForest.equipmentClass, "LIGHT");
assert.equal(smallLightForest.mobility, "ADVANTAGE");
assert.equal(smallLightForest.ambushExposure, "LOW");
assert.ok(smallLightForest.combatTraits.includes("INFILTRATION_FRIENDLY"));
assert.ok(smallLightForest.combatTraits.includes("ROUGH_TERRAIN_FRIENDLY"));

const standardOpen = resolver.resolve({
    bodySize: "MEDIUM",
    equipment: ["STANDARD"],
    terrainId: "GL1_PLAINS"
});
assert.equal(standardOpen.equipmentClass, "STANDARD");
assert.equal(standardOpen.logistics, "STANDARD");
assert.deepEqual(standardOpen.movementConstraints, []);

const legacyMediumEquipment = resolver.resolve({
    bodySize: "MEDIUM",
    equipment: ["MEDIUM"],
    terrainId: "GL1_PLAINS"
});
assert.equal(legacyMediumEquipment.equipmentClass, "STANDARD");

const reservedOnly = resolver.resolve({
    bodySize: "MEDIUM",
    equipment: ["MOUNTED", "BAGGAGE", "PROJECTILE"],
    terrainId: "GL1_PLAINS"
});
assert.equal(reservedOnly.equipmentClass, "STANDARD");
assert.deepEqual(
    reservedOnly.reservedEquipment,
    ["MOUNTED", "BAGGAGE", "PROJECTILE"]
);
assert.equal(reservedOnly.combatTraits.includes("OPEN_GROUND_MOBILITY"), false);
assert.equal(reservedOnly.combatTraits.includes("EXTENDED_LOGISTICS"), false);
assert.equal(reservedOnly.combatTraits.includes("PRE_CONTACT_PRESSURE"), false);

console.log("diagnose_enemy_force_terrain_interaction: PASS");
