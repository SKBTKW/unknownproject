import assert from "node:assert/strict";
import {
    BOARD_DAMAGE_EFFECT_STATUS,
    resolveBoardDamageEffects,
    resolveLandDamageEffect,
    resolveSpecialBlockDamageEffect
} from "../game/src/core/board_damage_effect_policy.js";
import { BOARD_DAMAGE_TARGETS } from "../game/src/core/board_damage_service.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { resolveSpecialBlockProduction } from "../game/src/core/special_block_production.js";
import {
    readCellCapabilities,
    readSpecialBlockTrialTraits,
    BOARD_CAPABILITIES
} from "../game/src/core/special_block_domain.js";
import { CellViewDataService } from "../game/src/services/cell_view_data_service.js";

function makeState() {
    const state = {
        grid: [[{
            r: 0,
            c: 0,
            placed: true,
            isHQ: false,
            terrain: {
                id: "GL1_PLAINS",
                terrainId: "GL1_PLAINS",
                food: 3,
                wood: 1,
                defense: 0,
                mystic: 0
            },
            specialBlock: {
                instanceId: "WATCH_1",
                type: "WATCHTOWER",
                definitionId: "WATCHTOWER",
                state: "ACTIVE"
            },
            damageRecords: [
                {
                    id: "DAMAGE_LAND",
                    target: BOARD_DAMAGE_TARGETS.LAND,
                    source: { type: "TRIAL_BATTLE", trialIndex: 1 }
                },
                {
                    id: "DAMAGE_SPECIAL",
                    target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK,
                    source: { type: "TRIAL_BATTLE", trialIndex: 1 }
                }
            ]
        }]],
        mergedBlocks: {},
        placedBlockProduction: {},
        mergeLinks: new Set(),
        isHQVicinity: () => false,
        isWaterSourceInfluence: () => false
    };
    return state;
}

const cleanCell = {
    placed: true,
    isHQ: false,
    terrain: { terrainId: "GL1_PLAINS", food: 3, wood: 1, defense: 0, mystic: 0 },
    specialBlock: { type: "WATCHTOWER", definitionId: "WATCHTOWER", state: "ACTIVE" }
};
const cleanEffects = resolveBoardDamageEffects(cleanCell);
assert.equal(cleanEffects.land.status, BOARD_DAMAGE_EFFECT_STATUS.NONE);
assert.equal(cleanEffects.land.productionMultiplier, 1);
assert.equal(cleanEffects.specialBlock.status, BOARD_DAMAGE_EFFECT_STATUS.NONE);
assert.equal(cleanEffects.specialBlock.capabilitiesEnabled, true);
assert.equal(cleanEffects.specialBlock.trialTraitsEnabled, true);

const state = makeState();
const cell = state.grid[0][0];

const landEffect = resolveLandDamageEffect(cell);
assert.equal(landEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);
assert.equal(landEffect.affected, true);
assert.equal(landEffect.recordCount, 1);
assert.equal(landEffect.productionMultiplier, null);
assert.equal(landEffect.flatYieldAdjustments, null);

const specialEffect = resolveSpecialBlockDamageEffect(cell);
assert.equal(specialEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);
assert.equal(specialEffect.affected, true);
assert.equal(specialEffect.recordCount, 1);
assert.equal(specialEffect.productionMultiplier, null);
assert.equal(specialEffect.capabilitiesEnabled, null);
assert.equal(specialEffect.trialTraitsEnabled, null);

// Existing production numbers stay unchanged until the policy is explicitly resolved.
const breakdown = ProductionCalculator.calculateCellYieldBreakdown(state, 0, 0);
assert.deepEqual(breakdown.baseYields, { food: 3, wood: 1, defense: 0, mystic: 0 });
assert.deepEqual(breakdown.totalYields, { food: 3, wood: 1, defense: 0, mystic: 0 });
assert.equal(breakdown.damageEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);

const specialProduction = resolveSpecialBlockProduction(state, cell, { r: 0, c: 0 });
assert.equal(specialProduction.damageEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);

// Damage must not mutate the owning Special Block semantics.
// WATCHTOWER is observation-only in the current Board contract.
const capabilities = readCellCapabilities(cell);
assert.equal(capabilities.has(BOARD_CAPABILITIES.MILITARY_SITE), false);
assert.equal(capabilities.has(BOARD_CAPABILITIES.INVESTIGATION_SITE), false);
assert.equal(capabilities.has(BOARD_CAPABILITIES.OBSERVATION_SITE), true);

const traits = readSpecialBlockTrialTraits(cell);
assert.equal(traits.interceptionAllowed, null);
assert.equal(traits.suppressTerrainTactic, false);

// View model exposes unresolved effects without modifying displayed yields.
const view = new CellViewDataService().getCellViewData(state, 0, 0);
assert.equal(view.landDamageEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);
assert.equal(view.specialBlockDamageEffect.status, BOARD_DAMAGE_EFFECT_STATUS.UNRESOLVED);
assert.deepEqual(view.yields, { food: 3, wood: 1, defense: 0, mystic: 0 });

console.log("PASS board damage effect policy");
