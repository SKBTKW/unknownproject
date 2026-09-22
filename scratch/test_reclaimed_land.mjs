import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { getZoneCategory } from "../game/src/core/merge_rules.js";
import { TrialTerrainEffectResolver } from "../game/src/trial/systems/trial_terrain_effect_resolver.js";
import { isCardRuntimeActive } from "../game/src/systems/card_runtime_policy.js";

console.log("============================================================");
console.log("🌾 [Reclaimed Land compatibility semantics]");
console.log("============================================================");

const engine = GameEngine.createGame({ runSeed: 0xA0715001 });
const command = engine.deckManager.getLandCardMaster()
    .find(card => card.id === "CMD_WETLAND_RECLAMATION");

assert.ok(command, "legacy reclamation command data remains available for restore/data compatibility");
assert.equal(command.category, "COMMAND");
assert.equal(isCardRuntimeActive(command), false, "reclamation command runtime is intentionally dormant");
assert.equal(
    engine.deckManager.isCardEligible(command, 3, 0, { ignoreCooldown: true, ignoreHold: true }),
    false,
    "dormant reclamation command must not re-enter Offering"
);

const reclaimedTerrain = {
    id: "E1_RECLAIMED_LAND",
    terrainId: "E1_RECLAIMED_LAND",
    nameKey: "TERRAIN_RECLAIMED_LAND",
    e: 1,
    gl: 1,
    food: 4,
    wood: 1,
    defense: 0,
    mystic: 0,
    isSpecialBlock: true,
    isArtificialTerrain: true,
    category: "BASE",
    zoneCategory: "PLAINS",
    trialTerrainCategory: "STANDARD_E1"
};

Object.assign(engine.state.grid[0][0], {
    placed: true,
    isHQ: false,
    terrain: reclaimedTerrain,
    socketResource: null,
    merged: false,
    mergeGroupId: null
});

assert.equal(getZoneCategory(engine.state.grid[0][0]), "PLAINS", "reclaimed land remains PLAINS-compatible for zoning");

const breakdown = ProductionCalculator.calculateCellYieldBreakdown(engine.state, 0, 0);
assert.equal(breakdown.baseYields.food, 4, "reclaimed land base food remains 4");
assert.equal(breakdown.baseYields.wood, 1, "reclaimed land base material remains 1");
assert.equal(breakdown.baseYields.defense, 0, "reclaimed land base defense remains 0");
assert.equal(breakdown.baseYields.mystic, 0, "reclaimed land base mystic remains 0");

const resolver = new TrialTerrainEffectResolver();
const trialCell = {
    cellId: "compat_reclaimed",
    terrain: reclaimedTerrain,
    elevation: 1
};
assert.equal(resolver.canInterceptAt(trialCell), true, "reclaimed land remains interceptable in Trial");
assert.equal(resolver.canEnterNormalRoute(trialCell), true, "reclaimed land remains traversable by normal Trial routes");
const trialEffects = resolver.resolve({
    interceptCell: trialCell,
    approachCell: { ...trialCell, cellId: "compat_reclaimed_approach" }
});
assert.equal(trialEffects.modifiers.length, 0, "reclaimed E1 does not inherit wetland/mountain/special terrain modifiers");

assert.equal(reclaimedTerrain.isArtificialTerrain, true);
assert.equal(reclaimedTerrain.isSpecialBlock, true);
assert.equal(reclaimedTerrain.terrainId.includes("WETLAND"), false, "restored reclaimed land is not treated as wetland");

console.log("Reclaimed Land compatibility semantics: PASS");