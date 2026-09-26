import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    BOARD_CAPABILITIES,
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES,
    getSpecialBlockDefinition,
    hasCellCapability
} from "../game/src/core/special_block_domain.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { MaintenanceFallbackSystem } from "../game/src/systems/maintenance_fallback_system.js";
import { resolveBoardFoodMaintenanceModifiers } from "../game/src/core/board_maintenance_modifier.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import {
    attachCardRuntimePolicy,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";

function cell(r, c, terrainId, { hq = false } = {}) {
    return {
        r,
        c,
        placed: true,
        isHQ: hq,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId: null,
        terrain: {
            id: terrainId,
            terrainId,
            gl: terrainId === "GL1_PLAINS" ? 1 : 0,
            food: 0,
            wood: 0,
            defense: 0,
            mystic: 0
        },
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

const granary = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_GRANARY");
assert.ok(granary, "CMD_GRANARY must exist");
assert.equal(isCardRuntimeActive(granary), true, "completed Granary is active by default through the ID-scoped runtime policy");
assert.deepEqual(granary.cost, {});
assert.equal(granary.reqWood, undefined);
assert.equal(granary.effects?.[0]?.paymentMode, "DOMAIN_QUOTE");
assert.deepEqual(
    getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.GRANARY)?.creationCost,
    { status: SPECIAL_BLOCK_COST_STATUS.RESOLVED, resources: { wood: 20 } },
    "Granary creation cost must be Board-owned"
);
assert.deepEqual(
    getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.GRANARY)?.maintenanceModifiers?.food,
    {
        status: "RESOLVED",
        kind: "FLAT_REDUCTION",
        amountPerInstance: 2,
        maxInstances: 2
    },
    "Granary maintenance effect must be authored by the Board definition"
);

const grid = [
    [cell(0, 0, "GL1_PLAINS"), cell(0, 1, "GL1_PLAINS"), cell(0, 2, "GL1_PLAINS")],
    [cell(1, 0, "E1_RECLAIMED_LAND"), cell(1, 1, "GL2_FOREST"), cell(1, 2, "E2_HILL")],
    [cell(2, 0, "E0_WETLAND"), cell(2, 1, "GL1_PLAINS"), cell(2, 2, "HQ", { hq: true })]
];

const state = {
    turn: 6,
    stage: { id: 1 },
    food: 100,
    wood: 80,
    material: 80,
    defense: 5,
    currentDefense: 5,
    mystic: 0,
    ember: 20,
    maxEmber: 20,
    grid,
    mergedBlocks: {},
    reserveSlots: [null],
    handOffering: [granary],
    consumedUniqueCards: [],
    usedUniqueCards: [],
    activeBuffs: [],
    hasPickedThisTurn: false,
    hasReservedThisTurn: false,
    hasMulliganedThisTurn: false,
    logs: [],
    addLog(message) { this.logs.push(message); },
    addBuff(buff) { this.activeBuffs.push(buff); }
};

const boardDomainAdapter = new BoardDomainAdapter({ state });
const engine = {
    state,
    boardDomainAdapter,
    cardRuntimeActivationProvider: () => ({ activeCardIds: ["CMD_GRANARY"] })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

const quote = deck.quoteCardExecutionCost(granary);
assert.equal(quote.success, true);
assert.deepEqual(quote.resources, { wood: 20 });

const targets = deck.enumerateCardExecutionTargets(granary);
const targetKeys = new Set(targets.map(target => `${target.r}:${target.c}`));
assert.equal(targetKeys.has("0:0"), true);
assert.equal(targetKeys.has("1:0"), true, "reclaimed land is a legal Granary target");
assert.equal(targetKeys.has("1:1"), false, "forest is not a legal Granary target");
assert.equal(targetKeys.has("2:2"), false, "HQ is not a legal Granary target");

const beforeInvalidWood = state.wood;
const invalid = deck.playCommandCard(granary, { r: 1, c: 1 });
assert.equal(invalid.success, false);
assert.equal(state.wood, beforeInvalidWood, "invalid target must fail before payment");

function playGranary(target) {
    state.handOffering = [granary];
    state.hasPickedThisTurn = false;
    const beforeWood = state.wood;
    const result = deck.playCommandCard(granary, target, 0, -1);
    assert.equal(result.success, true);
    assert.equal(state.wood, beforeWood - 20);
    assert.equal(state.material, state.wood);
    assert.equal(state.handOffering[0]?.isBlank, true);
    assert.equal(state.hasPickedThisTurn, true);
    return result;
}

playGranary({ r: 0, c: 0 });
assert.equal(grid[0][0].specialBlock?.definitionId, SPECIAL_BLOCK_TYPES.GRANARY);
assert.equal(
    hasCellCapability(grid[0][0], BOARD_CAPABILITIES.FOOD_STORAGE),
    true
);
let boardMaintenance = resolveBoardFoodMaintenanceModifiers(state);
assert.equal(boardMaintenance.flatReduction, 2);
assert.equal(boardMaintenance.appliedInstances, 1);

let maintenance = MaintenanceFallbackSystem.resolveFoodMaintenanceCost(state);
assert.equal(maintenance.baseFoodCost, 20);
assert.equal(maintenance.foodStorageSites, 1);
assert.equal(maintenance.granaryReduction, 2);
assert.equal(maintenance.foodCost, 18);

playGranary({ r: 0, c: 1 });
maintenance = MaintenanceFallbackSystem.resolveFoodMaintenanceCost(state);
assert.equal(maintenance.foodStorageSites, 2);
assert.equal(maintenance.granaryReduction, 4);
assert.equal(maintenance.foodCost, 16);

playGranary({ r: 0, c: 2 });
maintenance = MaintenanceFallbackSystem.resolveFoodMaintenanceCost(state);
assert.equal(maintenance.foodStorageSites, 2, "maintenance benefit is capped at two Granaries");
assert.equal(maintenance.granaryReduction, 4);
assert.equal(maintenance.foodCost, 16);

state.foodCostHalvedTurns = 1;
state.emergencyLevyTurns = 1;
state.emergencyLevyStartsNextTurn = false;
maintenance = MaintenanceFallbackSystem.resolveFoodMaintenanceCost(state);
assert.equal(maintenance.preBoardFoodCost, 16, "Board flat reduction applies before temporary response modifiers");
assert.equal(maintenance.foodCost, 8, "Rationing halves the post-Board maintenance cost");
assert.equal(maintenance.emergencyLevyApplied, false, "legacy Emergency Levy maintenance surcharge is not part of First-Wave v1");
state.foodCostHalvedTurns = 0;
state.emergencyLevyTurns = 0;

grid[0][0].specialBlock.state = "DAMAGED";
boardMaintenance = boardDomainAdapter.resolveFoodMaintenanceModifiers();
assert.equal(boardMaintenance.appliedInstances, 2, "damaged storage must not contribute to Board maintenance semantics");
assert.equal(boardMaintenance.flatReduction, 4);
grid[0][0].specialBlock.state = "ACTIVE";

const duplicateBeforeWood = state.wood;
const duplicate = deck.playCommandCard(granary, { r: 0, c: 0 });
assert.equal(duplicate.success, false);
assert.equal(state.wood, duplicateBeforeWood, "occupied target must not charge twice");

console.log("✅ Stage1 Granary Special Block v1 PASS");
