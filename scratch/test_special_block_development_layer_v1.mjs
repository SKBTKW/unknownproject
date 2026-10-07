import assert from "node:assert/strict";

import {
    SPECIAL_BLOCK_TYPES,
    TRIAL_CAUSALITY_CHANNELS,
    TRIAL_CAUSALITY_RUNTIME_STATUS,
    getSpecialBlockDefinition,
    hasSpecialBlockTrialCausality,
    readSpecialBlockTrialCausality
} from "../game/src/core/special_block_domain.js";
import {
    enumerateSpecialBlockInstances,
    resolveSpecialBlockInstance
} from "../game/src/core/special_block_instance_read_model.js";
import {
    SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS,
    SPECIAL_BLOCK_DEVELOPMENT_LAYERS,
    resolveSpecialBlockDevelopmentModifiers,
    sumSpecialBlockDevelopmentModifiers
} from "../game/src/core/special_block_development_domain.js";
import {
    SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS
} from "../game/src/data/special_block_development_definitions.js";
import { SpecialBlockDevelopmentService } from "../game/src/systems/special_block_development_service.js";
import {
    resolveSpecialBlockProduction,
    sumSpecialBlockProduction
} from "../game/src/core/special_block_production.js";
import { DefenseSystem } from "../game/src/systems/defense_system.js";
import { serializeGameState } from "../game/src/core/state_serializer_base.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state_base.js";

function cell(r, c, specialBlock = null) {
    return {
        r, c,
        placed: true,
        isHQ: false,
        terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", e: 1, gl: 1 },
        specialBlock,
        placementGroupId: null,
        mergeGroupId: null,
        merged: false,
        mergeType: null,
        searched: false,
        hasSocket: false,
        socketResource: null
    };
}

function makeState() {
    const grid = Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => cell(r, c, null))
    );
    const state = {
        turn: 8,
        stage: { id: 1, name: "Stage 1", size: 3, maxTiles: 9 },
        food: 120,
        wood: 120,
        material: 120,
        defense: 5,
        defenseCapacityBonus: 0,
        currentDefense: 5,
        maxDefense: 5,
        mystic: 0,
        ember: 20,
        maxEmber: 20,
        grid,
        mergedBlocks: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        reserveSlots: [],
        handOffering: [],
        placedBlockProduction: {},
        cardCooldowns: {},
        cardStageUsage: {},
        usedUniqueCards: [],
        consumedUniqueCards: []
    };

    grid[0][0].specialBlock = {
        instanceId: "FARM@0:0",
        type: SPECIAL_BLOCK_TYPES.FARM,
        definitionId: SPECIAL_BLOCK_TYPES.FARM,
        state: "ACTIVE"
    };
    grid[0][1].specialBlock = {
        instanceId: "WATCHTOWER@0:1",
        type: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        definitionId: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        state: "ACTIVE"
    };

    const civilMulti = {
        instanceId: "GRANARY@1:0",
        type: SPECIAL_BLOCK_TYPES.GRANARY,
        definitionId: SPECIAL_BLOCK_TYPES.GRANARY,
        state: "ACTIVE",
        footprint: [{ r: 1, c: 0 }, { r: 1, c: 1 }]
    };
    grid[1][0].specialBlock = { ...civilMulti, footprint: civilMulti.footprint.map(p => ({ ...p })) };
    grid[1][1].specialBlock = { ...civilMulti, footprint: civilMulti.footprint.map(p => ({ ...p })) };

    const barracks = {
        instanceId: "BARRACKS@2:0",
        type: SPECIAL_BLOCK_TYPES.BARRACKS,
        definitionId: SPECIAL_BLOCK_TYPES.BARRACKS,
        state: "ACTIVE",
        footprint: [{ r: 2, c: 0 }, { r: 2, c: 1 }]
    };
    grid[2][0].specialBlock = { ...barracks, footprint: barracks.footprint.map(p => ({ ...p })) };
    grid[2][1].specialBlock = { ...barracks, footprint: barracks.footprint.map(p => ({ ...p })) };

    return state;
}

let count = 0;
function test(name, fn) {
    fn();
    count++;
    console.log(`  ✅ [${count}] ${name}`);
}

console.log("\n🧪 Running generic Special Block Development Layer v1 tests...");

test("Trial causality is semantic and independent from display category/capability", () => {
    const farm = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.FARM);
    const watchtower = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.WATCHTOWER);
    const palisade = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.PALISADE);
    const barracks = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.BARRACKS);

    assert.equal(hasSpecialBlockTrialCausality(farm), false);
    assert.deepEqual(readSpecialBlockTrialCausality(watchtower), {
        participates: true,
        channels: [TRIAL_CAUSALITY_CHANNELS.OBSERVATION],
        runtimeStatus: TRIAL_CAUSALITY_RUNTIME_STATUS.FOUNDATION
    });
    assert.deepEqual(readSpecialBlockTrialCausality(palisade), {
        participates: true,
        channels: [TRIAL_CAUSALITY_CHANNELS.POSITIONING],
        runtimeStatus: TRIAL_CAUSALITY_RUNTIME_STATUS.ACTIVE
    });
    assert.deepEqual(readSpecialBlockTrialCausality(barracks), {
        participates: true,
        channels: [TRIAL_CAUSALITY_CHANNELS.DEPLOYMENT],
        runtimeStatus: TRIAL_CAUSALITY_RUNTIME_STATUS.FOUNDATION
    });
});

test("instance read model dedupes multi-cell copies without object identity", () => {
    const state = makeState();
    const instances = enumerateSpecialBlockInstances(state);
    assert.equal(instances.length, 4);
    const multi = resolveSpecialBlockInstance(state, "GRANARY@1:0");
    assert.ok(multi);
    assert.equal(multi.cells.length, 2);
    assert.deepEqual(multi.footprint, [{ r: 1, c: 0 }, { r: 1, c: 1 }]);
    assert.equal(multi.consistent, true);
    assert.notStrictEqual(state.grid[1][0].specialBlock, state.grid[1][1].specialBlock);
});

test("BASIC target eligibility excludes all Trial-causality facilities, including Watchtower and Barracks", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    const targets = service.enumerateEligibleTargets(
        SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT
    );
    const ids = targets.map(target => target.instanceId);
    assert.ok(ids.includes("FARM@0:0"));
    assert.ok(ids.includes("GRANARY@1:0"));
    assert.equal(ids.includes("WATCHTOWER@0:1"), false);
    assert.equal(ids.includes("BARRACKS@2:0"), false);
});

test("2-of-4 selection is distinct and canonically sorted", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    const preview = service.previewDevelopment({
        instanceId: "FARM@0:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["MYSTIC_YIELD", "FOOD_YIELD"]
    });
    assert.equal(preview.success, true);
    assert.deepEqual(preview.optionIds, ["FOOD_YIELD", "MYSTIC_YIELD"]);

    const duplicate = service.previewDevelopment({
        instanceId: "FARM@0:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "FOOD_YIELD"]
    });
    assert.equal(duplicate.success, false);
    assert.equal(duplicate.reason, "DEVELOPMENT_OPTIONS_MUST_BE_DISTINCT");
});

test("multi-cell Development writes every persisted copy atomically and only once per instance", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    const result = service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["MYSTIC_YIELD", "FOOD_YIELD"]
    });
    assert.equal(result.success, true);

    const left = state.grid[1][0].specialBlock.developments.BASIC;
    const right = state.grid[1][1].specialBlock.developments.BASIC;
    assert.deepEqual(left, right);
    assert.notStrictEqual(left, right);
    assert.deepEqual(left.optionIds, ["FOOD_YIELD", "MYSTIC_YIELD"]);
    assert.equal(left.layer, SPECIAL_BLOCK_DEVELOPMENT_LAYERS.BASIC);

    const second = service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "MATERIAL_YIELD"]
    });
    assert.equal(second.success, false);
    assert.equal(second.reason, "DEVELOPMENT_LAYER_OCCUPIED");
});

test("Development yield modifiers are instance-deduped and permit zero-to-positive civilian yields", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    assert.equal(service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "MYSTIC_YIELD"]
    }).success, true);

    const one = resolveSpecialBlockDevelopmentModifiers(state, "GRANARY@1:0");
    assert.deepEqual(one.yields, { food: 2, wood: 0, defense: 0, mystic: 1 });

    const total = sumSpecialBlockDevelopmentModifiers(state);
    assert.deepEqual(total.yields, { food: 2, wood: 0, defense: 0, mystic: 1 });
    assert.equal(total.defenseCapacityBonus, 0);
});

test("Defense is capacity-only in persistent modifiers and current recovery is one-shot", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    let calls = 0;
    let recovered = 0;
    const result = service.applyDevelopment({
        instanceId: "FARM@0:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["DEFENSE_CAPACITY", "FOOD_YIELD"]
    }, {
        onApplyEffectHandler(effects) {
            calls++;
            assert.equal(effects.length, 1);
            assert.equal(effects[0].kind, SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.RECOVER_CURRENT_DEFENSE);
            recovered += effects[0].amount;
            return { success: true };
        }
    });
    assert.equal(result.success, true);
    assert.equal(calls, 1);
    assert.equal(recovered, 1);

    const modifiers = resolveSpecialBlockDevelopmentModifiers(state, "FARM@0:0");
    assert.deepEqual(modifiers.yields, { food: 2, wood: 0, defense: 0, mystic: 0 });
    assert.equal(modifiers.defenseCapacityBonus, 1);
});

test("one-shot failure rolls back all instance copies", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    const result = service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["DEFENSE_CAPACITY", "FOOD_YIELD"]
    }, {
        onApplyEffectHandler() {
            return { success: false, reason: "SYNTHETIC_FAILURE" };
        }
    });
    assert.equal(result.success, false);
    assert.equal(result.reason, "SYNTHETIC_FAILURE");
    assert.equal(state.grid[1][0].specialBlock.developments, undefined);
    assert.equal(state.grid[1][1].specialBlock.developments, undefined);
});

test("Damage records alone do not disable Development; lifecycle functional state does", () => {
    const state = makeState();
    state.grid[0][0].damageRecords = [{ id: "DAMAGE", target: "SPECIAL_BLOCK" }];
    const service = new SpecialBlockDevelopmentService({ state });
    assert.ok(service.enumerateEligibleTargets(
        SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT
    ).some(target => target.instanceId === "FARM@0:0"));

    state.grid[0][0].specialBlock.state = "DYSFUNCTIONAL";
    assert.equal(service.enumerateEligibleTargets(
        SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT
    ).some(target => target.instanceId === "FARM@0:0"), false);
});

test("Development state survives canonical Save/Restore without reference identity assumptions", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    assert.equal(service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "MYSTIC_YIELD"]
    }).success, true);

    const serialized = serializeGameState(state);
    const restored = {};
    hydrateGameState(restored, serialized, {
        resolveCardMaster: id => ({ id, nameKey: id })
    });

    const restoredInstance = resolveSpecialBlockInstance(restored, "GRANARY@1:0");
    assert.ok(restoredInstance);
    assert.equal(restoredInstance.consistent, true);
    assert.equal(restoredInstance.cells.length, 2);
    assert.deepEqual(
        restored.grid[1][0].specialBlock.developments.BASIC,
        restored.grid[1][1].specialBlock.developments.BASIC
    );
    assert.notStrictEqual(
        restored.grid[1][0].specialBlock,
        restored.grid[1][1].specialBlock
    );
    assert.deepEqual(
        sumSpecialBlockDevelopmentModifiers(restored).yields,
        { food: 2, wood: 0, defense: 0, mystic: 1 }
    );
});

test("Development yields join effective Special Block production without multi-cell double counting", () => {
    const state = makeState();
    const service = new SpecialBlockDevelopmentService({ state });
    assert.equal(service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "MYSTIC_YIELD"]
    }).success, true);

    const left = resolveSpecialBlockProduction(state, state.grid[1][0], { r: 1, c: 0 });
    const right = resolveSpecialBlockProduction(state, state.grid[1][1], { r: 1, c: 1 });
    assert.deepEqual(left.baseYields, { food: 0, wood: 0, defense: 0, mystic: 0 });
    assert.deepEqual(left.developmentYields, { food: 2, wood: 0, defense: 0, mystic: 1 });
    assert.deepEqual(left.yields, { food: 2, wood: 0, defense: 0, mystic: 1 });
    assert.deepEqual(right.yields, left.yields);

    const total = sumSpecialBlockProduction(state);
    assert.equal(total.developmentYields.food, 2);
    assert.equal(total.developmentYields.mystic, 1);
});

test("Development-created mystic output participates in Altar relation semantics once per logical instance", () => {
    const state = makeState();
    state.grid[0][1].specialBlock = {
        instanceId: "ALTAR@0:1",
        type: SPECIAL_BLOCK_TYPES.ALTAR,
        definitionId: SPECIAL_BLOCK_TYPES.ALTAR,
        state: "ACTIVE"
    };

    const service = new SpecialBlockDevelopmentService({ state });
    assert.equal(service.applyDevelopment({
        instanceId: "GRANARY@1:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["FOOD_YIELD", "MYSTIC_YIELD"]
    }).success, true);

    const altar = resolveSpecialBlockProduction(state, state.grid[0][1], { r: 0, c: 1 });
    assert.equal(altar.status, "RESOLVED");
    assert.equal(altar.yields.mystic, 1);
});

test("Defense capacity is derived from Development and one-shot recovery happens exactly once on apply", () => {
    const state = makeState();
    const defense = new DefenseSystem(state);
    const service = new SpecialBlockDevelopmentService({ state });
    const beforeMax = defense.getMaxDefense();
    const beforeCurrent = defense.getCurrentDefense();

    const result = service.applyDevelopment({
        instanceId: "FARM@0:0",
        developmentDefinitionId: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        optionIds: ["DEFENSE_CAPACITY", "FOOD_YIELD"]
    }, {
        onApplyEffectHandler(effects) {
            for (const effect of effects) {
                if (effect.kind === SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.RECOVER_CURRENT_DEFENSE) {
                    defense.recoverCurrentDefense(effect.amount);
                }
            }
            return { success: true };
        }
    });
    assert.equal(result.success, true);
    assert.equal(defense.getMaxDefense(), beforeMax + 1);
    assert.equal(defense.getCurrentDefense(), Math.min(beforeCurrent + 1, beforeMax + 1));

    const stableCurrent = defense.getCurrentDefense();
    assert.equal(defense.getMaxDefense(), beforeMax + 1);
    assert.equal(defense.getCurrentDefense(), stableCurrent);
    assert.equal(sumSpecialBlockProduction(state).developmentYields.defense, 0);
});

console.log(`test_special_block_development_layer_v1: PASS (${count} cases)`);
