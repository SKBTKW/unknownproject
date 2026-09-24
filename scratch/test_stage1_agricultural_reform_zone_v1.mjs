import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    ZONE_CONVERSION_DEFINITIONS,
    ZONE_CONVERSION_DEFINITION_IDS
} from "../game/src/data/zone_conversion_definitions.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy, isCardRuntimeActive } from "../game/src/systems/card_runtime_policy.js";

console.log("\nStage1 Agricultural Reform Zone Conversion v1");

function emptyCell(r, c) {
    return {
        r, c, placed: false, isHQ: false, merged: false,
        mergeGroupId: null, mergeType: null, placementGroupId: null,
        terrain: null, specialBlock: null, searched: false,
        hasSocket: false, socketResource: null, cachedSocketSeeds: {}
    };
}
function zoneCell(r, c, groupId, terrainId, zoneCategory, yields) {
    return {
        ...emptyCell(r, c),
        placed: true,
        merged: true,
        mergeGroupId: groupId,
        mergeType: "2x2",
        terrain: {
            id: terrainId, terrainId, zoneCategory,
            food: yields.food || 0, wood: yields.wood || 0,
            material: yields.wood || 0, defense: yields.defense || 0,
            mystic: yields.mystic || 0
        }
    };
}
function makeState() {
    const grid = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => emptyCell(r, c))
    );
    const plains = [{r:0,c:0},{r:0,c:1},{r:1,c:0},{r:1,c:1}];
    const forest = [{r:3,c:3},{r:3,c:4},{r:4,c:3},{r:4,c:4}];
    for (const pt of plains) {
        grid[pt.r][pt.c] = zoneCell(pt.r, pt.c, "zone_plains", "GL1_PLAINS", "PLAINS", { food: 4 });
    }
    for (const pt of forest) {
        grid[pt.r][pt.c] = zoneCell(pt.r, pt.c, "zone_forest", "GL2_FOREST", "GL2_FOREST", { food: 2, wood: 2, defense: 2 });
    }
    grid[2][2] = {
        ...emptyCell(2,2),
        placed: true,
        isHQ: true,
        terrain: { id:"HQ", terrainId:"HQ", food:5, wood:5, defense:5, mystic:1 }
    };

    return {
        turn: 10,
        stage: { id: 1, size: 5 },
        food: 100, wood: 100, material: 100,
        defense: 5, currentDefense: 5, maxDefense: 5,
        mystic: 0, ember: 10, maxEmber: 20,
        grid,
        mergedBlocks: {
            zone_plains: {
                groupId: "zone_plains", terrainId: "GL1_PLAINS", zoneCategory: "PLAINS",
                mergeType: "2x2", cells: plains, yieldMultiplier: 1.2, createdTurn: 4
            },
            zone_forest: {
                groupId: "zone_forest", terrainId: "GL2_FOREST", zoneCategory: "GL2_FOREST",
                mergeType: "2x2", cells: forest, yieldMultiplier: 1.2, createdTurn: 5
            }
        },
        placedBlockProduction: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        reserveSlots: [null],
        handOffering: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        hasPickedThisTurn: false,
        hasReservedThisTurn: false,
        hasMulliganedThisTurn: false,
        isHQVicinity() { return false; },
        addLog() {},
        addBuff(buff) { this.activeBuffs.push(buff); }
    };
}

const definition = ZONE_CONVERSION_DEFINITIONS[ZONE_CONVERSION_DEFINITION_IDS.AGRICULTURAL_REFORM];
assert.ok(definition);
assert.deepEqual(definition.eligibleZoneAttributes, ["PLAINS"]);
assert.equal(definition.creationCost.status, "RESOLVED");
assert.deepEqual(definition.creationCost.base, { wood: 20 });
assert.equal(definition.production.status, "RESOLVED");
assert.equal(definition.production.kind, "PER_MEMBER_CELL");
assert.deepEqual(definition.production.perMemberYields, { food: 1 });

const card = COMMAND_CARDS_MASTER.find(item => item.id === "CMD_AGRICULTURAL_REFORM");
assert.ok(card);
assert.equal(isCardRuntimeActive(card), false, "production default keeps Agricultural Reform dormant");
assert.equal(card.cost, undefined, "Board definition owns Agricultural Reform creation cost");
assert.equal(card.reqWood, undefined);
assert.equal(card.reqConnectedPlainsOrReclaimed, undefined);
assert.deepEqual(card.effects, [{
    type: "DOMAIN_ACTION",
    action: "CREATE_ZONE_CONVERSION",
    definitionId: "AGRICULTURAL_REFORM",
    paymentMode: "DOMAIN_QUOTE",
    logActivation: true
}]);

const state = makeState();
state.handOffering = [card];
const boardDomainAdapter = new BoardDomainAdapter({
    state,
    zoneConversionDefinitions: ZONE_CONVERSION_DEFINITIONS
});
state.boardDomainAdapter = boardDomainAdapter;
state.zoneConversionService = boardDomainAdapter.zoneConversionService;

const engine = {
    state,
    boardDomainAdapter,
    cardRuntimeActivationProvider: () => ({ activeCardIds: ["CMD_AGRICULTURAL_REFORM"] })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

const targets = deck.enumerateCardExecutionTargets(card);
assert.equal(targets.length, 1, "only the completed PLAINS Zone is a legal target");
assert.equal(targets[0].groupId, "zone_plains");
assert.deepEqual(targets[0].cost, { wood: 20 });

const baseline = ProductionCalculator.calculateTotalProduction(state);
const beforeWood = state.wood;
const beforeMaterial = state.material;
const played = deck.playCommandCard(card, { groupId: "zone_plains" }, 0, -1);
assert.equal(played.success, true);
assert.equal(state.wood, beforeWood - 20);
assert.equal(state.material, beforeMaterial - 20);
assert.equal(state.mergedBlocks.zone_plains.conversion?.definitionId, "AGRICULTURAL_REFORM");
assert.equal(state.mergedBlocks.zone_plains.conversion?.state, "ACTIVE");
assert.equal(state.permanentPlainsFoodBonus, undefined);
assert.equal(state.handOffering[0]?.isBlank, true);
assert.equal(state.hasPickedThisTurn, true);

const after = ProductionCalculator.calculateTotalProduction(state);
assert.equal(after.grossFood - baseline.grossFood, 4,
    "Agricultural Reform adds +1 food per member exactly once");
assert.equal(after.zoneConversionProduction?.yields?.food, 4);

const cell = ProductionCalculator.calculateCellYieldBreakdown(state, 0, 0);
const modifier = cell.modifiers.find(item =>
    item.type === "ZONE_CONVERSION" && item.definitionId === "AGRICULTURAL_REFORM"
);
assert.ok(modifier);
assert.equal(modifier.amount, 1);
assert.equal(modifier.groupId, "zone_plains");

state.handOffering = [card];
state.hasPickedThisTurn = false;
assert.equal(deck.enumerateCardExecutionTargets(card).length, 0,
    "already-converted Zone is not targetable again");

console.log("  Board-owned 🧱20 quote PASS");
console.log("  completed PLAINS Zone targeting PASS");
console.log("  local +1 🌾/member production PASS");
console.log("  global permanentPlainsFoodBonus retired from live path");
console.log("✅ Stage1 Agricultural Reform Zone Conversion v1 PASS");
