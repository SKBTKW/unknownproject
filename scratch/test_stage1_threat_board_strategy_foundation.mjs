import assert from "node:assert/strict";
import { GameEngine } from "../game/src/core/game_engine.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";
import { resolveCanonicalTerrainSemantic } from "../game/src/data/land_system.js";
import { readSpecialBlockTrialTraits } from "../game/src/core/special_block_domain.js";
import { captureCivilizationDevelopment } from "../game/src/trial/systems/civilization_development_snapshot_service.js";
import { TrialThreatResolver } from "../game/src/trial/systems/trial_threat_resolver.js";
import { prepareStage1, strategies } from "./diagnose_stage1_board_strategy.mjs";
import { diagnoseStage1Survival } from "./diagnose_stage1_trial_survival.mjs";
import { resolveStage1ForceAllocation, sampleStage1ForceShares } from "./stage1_force_allocation_probe.mjs";

const { state, specialBlockService } = GameEngine.createGame({ runSeed: 20260923, firstRun: true });

function expectLand(blocks, cells) {
    const snapshot = captureCivilizationDevelopment(state);
    assert.equal(snapshot.placedBlockCount, blocks, "Threat counts original land placements");
    assert.equal(snapshot.territoryTiles, cells, "Threat counts ordinary land cells");
}
function land(r, c, id, group) {
    Object.assign(state.grid[r][c], {
        placed: true, terrain: { ...resolveCanonicalTerrainSemantic(id) }, placementGroupId: group
    });
}

expectLand(0, 0);
land(1, 1, "GL1_PLAINS", "one");
state.placedBlockCount = 1;
expectLand(1, 1);
land(1, 2, "GL2_FOREST", "pair");
land(0, 2, "GL2_FOREST", "pair");
state.placedBlockCount = 2;
expectLand(2, 3);
const beforeFacilities = captureCivilizationDevelopment(state);
assert.equal(specialBlockService.createSpecialBlock("FARM", { r: 1, c: 1 }, {
    paymentConfirmed: true, paidCost: { wood: 30 }
}).success, true);
assert.deepEqual(captureCivilizationDevelopment(state), beforeFacilities);
assert.equal(specialBlockService.createSpecialBlock("EARTHWORK", { r: 0, c: 2 }).success, true);
assert.equal(readSpecialBlockTrialTraits(state.grid[0][2]).interceptionAllowed, true);
assert.deepEqual(captureCivilizationDevelopment(state), beforeFacilities);
assert.equal(specialBlockService.createSpecialBlock("FARM", { r: 1, c: 0 }, {
    paymentConfirmed: true, paidCost: { wood: 30 }
}).success, true);
assert.equal(state.grid[1][0].placed, false);
assert.deepEqual(captureCivilizationDevelopment(state), beforeFacilities);
assert.equal(state.gridEngine.getPlacedBlockCount(), 2);
assert.equal(state.getTerritoryTileCount(), 4);

land(0, 4, "E1_RECLAIMED_LAND", "legacy-special-terrain");
state.placedBlockCount++;
expectLand(2, 3);
assert.equal(state.getTerritoryTileCount(), 5);
assert.equal(state.gridEngine.getPlacedBlockCount(), 3);

const zoneA = [[3, 0], [3, 1], [4, 0], [4, 1]];
const zoneB = [[3, 2], [3, 3], [4, 2], [4, 3]];
for (const [id, terrain, coordinates] of [
    ["a", "GL1_PLAINS", zoneA], ["b", "GL2_FOREST", zoneB]
]) {
    const cells = coordinates.map(([r, c]) => {
        land(r, c, terrain, `land-${r}-${c}`);
        Object.assign(state.grid[r][c], { merged: true, mergeGroupId: id, mergeType: "2x2" });
        state.placedBlockCount++;
        return { r, c };
    });
    state.mergedBlocks[id] = { cells, mergeType: "2x2", terrainId: terrain };
}
state.mergeLinks.add("a::b");
expectLand(10, 11);
const developed = captureCivilizationDevelopment(state);
assert.equal(developed.completedZones, 2);
assert.equal(developed.links, 1);

state.handOffering = []; // This fixture tests board persistence only.
const restored = {};
hydrateGameState(restored, JSON.parse(JSON.stringify(serializeGameState(state))));
assert.deepEqual(captureCivilizationDevelopment(restored), developed);
assert.deepEqual(restored.grid[1][0].specialBlock, state.grid[1][0].specialBlock);
state.ember = 1;
state.currentDefense = 0;
state.temporaryDefense = 99;
assert.deepEqual(captureCivilizationDevelopment(state), developed);
console.log("PASS: normal land counts, overlays, independent facilities, legacy terrain, zones, links, and Save/Restore");

const seed = 20260923;
const hypotheses = { custom: new TrialThreatResolver({ baseThreatByTrial: { 1: 10 }, placedBlockWeight: 3 }) };
const [expansion, concentration, balanced] = strategies.map(strategy => prepareStage1(strategy, { seed, hypotheses }).snapshot);
for (const row of [expansion, concentration, balanced]) {
    assert.equal(row.seed, seed);
    assert.equal(row.stage, 1);
    assert.equal(row.verse, 15);
    assert.equal(row.productionThreat, 20);
    assert.equal(row.hypothesisThreat.custom, 10 + 3 * row.normalLandBlocks);
    assert.ok(row.interceptionCandidates.length > 0);
    assert.equal(row.trace.length, 14);
    for (const entry of row.trace.filter(entry => entry.chosen)) {
        assert.ok(entry.offering.some(card => card.id === entry.chosen.id));
    }
}
assert.ok(expansion.normalLandBlocks > balanced.normalLandBlocks);
assert.ok(balanced.normalLandBlocks > concentration.normalLandBlocks);
assert.ok(expansion.ember.actionSpent > concentration.ember.actionSpent);
assert.ok(concentration.specialBlocks.FARM > 0);
assert.ok(balanced.specialBlocks.FARM > 0);
console.log("PASS: three legal seeded strategies and independently injected threat hypothesis");

const results = diagnoseStage1Survival({ seed });
assert.ok(results.every(row => !row.blocked));
const [growthIntercept, compactIntercept, growthSkip, compactSkip, lowEmber, allStopped, partial, multiple, extreme] = results;
for (const row of results.filter(row => row.mode === "production-trial1")) {
    assert.equal(row.strategicSuppression, 20);
    assert.equal(row.routeCount, 1);
}
assert.equal(growthIntercept.battles[0].outcome, "REPEL");
assert.equal(growthIntercept.hqDamage.emberDamage, 0);
assert.equal(growthIntercept.afterFirstStage2Verse.stage, 2);
assert.ok(growthIntercept.afterFirstStage2Verse.offeringSize > 0);
assert.equal(compactIntercept.hqDamage.arrivals[0].sourceType, "INTERCEPT_BREAKTHROUGH");
for (const row of [compactIntercept, growthSkip, compactSkip, lowEmber, extreme]) {
    assert.equal(row.afterTrial.ember, 0);
    assert.equal(row.runTerminated, true);
    assert.equal(row.afterSettlement.stage, 1);
    assert.equal(row.afterFirstStage2Verse, null);
}
assert.equal(allStopped.hqDamage.routeEndCount, 0);
assert.equal(partial.hqDamage.emberDamage, 2);
assert.equal(multiple.hqDamage.routeEndCount, 3);
assert.equal(multiple.hqDamage.emberDamage, 4);
assert.equal(multiple.afterSettlement.ember, 1);
assert.equal(multiple.afterFirstStage2Verse.gameOver, true);
assert.equal(extreme.hqDamage.sourcePower, 100);
console.log("PASS: production Trial1 and diagnostic HQ arrival scenarios through termination and Stage2");

const seenShares = new Set();
let sawNonMajority = false;
for (let seed = 1; seed <= 32; seed++) {
    const shares = sampleStage1ForceShares(seed);
    assert.deepEqual(sampleStage1ForceShares(seed), shares);
    seenShares.add(shares.join(":"));
    for (const rounding of ["largest-remainder", "remainder-to-a"]) {
        for (const minimumCheck of ["rounded", "unrounded"]) {
            for (const total of [0, 1, 12, 25, 60, 100]) {
                const allocation = resolveStage1ForceAllocation({ total, minimum: 5, shares, rounding, minimumCheck });
                assert.deepEqual(JSON.parse(JSON.stringify(allocation)), allocation);
                const [a, b, c] = allocation.forces;
                assert.deepEqual(allocation.forces.map(force => force.id), ["A", "B", "C"]);
                assert.equal(a.suppression + b.suppression + c.suppression, total);
                assert.ok(a.suppression >= b.suppression && a.suppression >= c.suppression);
                assert.ok(!c.participates || b.participates);
                assert.ok(!b.participates || b.suppression >= 5);
                assert.ok(!c.participates || c.suppression >= 5);
                if (c.participates && a.suppression * 2 <= total) sawNonMajority = true;
                if (total <= 1) assert.equal(b.participates, false);
                if (total === 100) assert.equal(c.participates, true);
            }
        }
    }
}
assert.ok(seenShares.size > 1);
assert.ok(sawNonMajority);
const boundary = { total: 23, minimum: 5 };
const active = result => result.forces.filter(force => force.participates).length;
assert.equal(active(resolveStage1ForceAllocation({ ...boundary, minimumCheck: "rounded" })), 3);
assert.equal(active(resolveStage1ForceAllocation({ ...boundary, minimumCheck: "unrounded" })), 2);
console.log("PASS: independent seeded A/B/C allocations across rounding and eligibility policies");
