import assert from "node:assert/strict";

import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    ZONE_CONVERSION_DEFINITION_IDS,
    ZONE_CONVERSION_DEFINITIONS
} from "../game/src/data/zone_conversion_definitions.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import {
    attachCardRuntimePolicy,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";

console.log("\nStage1 Agricultural Reform Zone Conversion v1");

const definitionId = ZONE_CONVERSION_DEFINITION_IDS.AGRICULTURAL_REFORM;
const productEngine = GameEngine.createGame({ runSeed: 20260924 });
assert.ok(
    productEngine.zoneConversionService?.getDefinition(definitionId),
    "product GameEngine must inject the Agricultural Reform Zone Conversion definition"
);

function emptyCell(r, c) {
    return {
        r, c,
        placed: false,
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId: null,
        terrain: null,
        production: null,
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

function mergedCell(r, c, groupId, terrainId, zoneCategory) {
    return {
        ...emptyCell(r, c),
        placed: true,
        merged: true,
        mergeGroupId: groupId,
        mergeType: "2x2",
        terrain: {
            id: terrainId,
            terrainId,
            zoneCategory,
            gl: terrainId === "GL1_PLAINS" ? 1 : 2,
            e: terrainId === "GL1_PLAINS" ? 1 : 0,
            food: terrainId === "GL1_PLAINS" ? 4 : 2,
            wood: terrainId === "GL2_FOREST" ? 2 : 0,
            material: terrainId === "GL2_FOREST" ? 2 : 0,
            defense: terrainId === "GL2_FOREST" ? 2 : 0,
            mystic: 0
        }
    };
}

const grid = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => emptyCell(r, c))
);

const plainsCells = [
    { r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }
];
for (const pt of plainsCells) {
    grid[pt.r][pt.c] = mergedCell(pt.r, pt.c, "zone_plains", "GL1_PLAINS", "PLAINS");
}

const forestCells = [
    { r: 0, c: 3 }, { r: 0, c: 4 }, { r: 1, c: 3 }, { r: 1, c: 4 }
];
for (const pt of forestCells) {
    grid[pt.r][pt.c] = mergedCell(pt.r, pt.c, "zone_forest", "GL2_FOREST", "FOREST");
}

grid[2][2] = {
    ...emptyCell(2, 2),
    placed: true,
    isHQ: true,
    terrain: { id: "HQ", terrainId: "HQ", food: 5, wood: 5, defense: 5, mystic: 1 }
};

const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_AGRICULTURAL_REFORM");
assert.ok(card);
assert.equal(isCardRuntimeActive(card), true, "completed Agricultural Reform is active by default through the ID-scoped runtime policy");
assert.deepEqual(card.cost, {}, "card must not duplicate Board-owned Zone Conversion cost");
assert.equal(card.effects?.length, 1);
assert.equal(card.effects[0].action, "CREATE_ZONE_CONVERSION");
assert.equal(card.effects[0].definitionId, definitionId);
assert.equal(card.effects[0].paymentMode, "DOMAIN_QUOTE");

const state = {
    turn: 9,
    stage: { id: 1, size: 5 },
    food: 100,
    wood: 60,
    material: 60,
    defense: 5,
    currentDefense: 5,
    maxDefense: 5,
    mystic: 0,
    ember: 10,
    maxEmber: 20,
    grid,
    mergedBlocks: {
        zone_plains: {
            groupId: "zone_plains",
            terrainId: "GL1_PLAINS",
            zoneCategory: "PLAINS",
            mergeType: "2x2",
            cells: plainsCells,
            yieldMultiplier: 1.2,
            createdTurn: 5
        },
        zone_forest: {
            groupId: "zone_forest",
            terrainId: "GL2_FOREST",
            zoneCategory: "FOREST",
            mergeType: "2x2",
            cells: forestCells,
            yieldMultiplier: 1.2,
            createdTurn: 5
        }
    },
    placedBlockProduction: {},
    reserveSlots: [null],
    handOffering: [card],
    consumedUniqueCards: [],
    usedUniqueCards: [],
    activeBuffs: [],
    hasPickedThisTurn: false,
    hasReservedThisTurn: false,
    hasMulliganedThisTurn: false,
    mergeLinks: new Set(),
    roadEdges: new Set(),
    grantedConnectionPairs: new Set(),
    logs: [],
    addLog(message) { this.logs.push(message); },
    addBuff(buff) { this.activeBuffs.push(buff); },
    isHQVicinity() { return false; }
};

const boardDomainAdapter = new BoardDomainAdapter({
    state,
    zoneConversionDefinitions: ZONE_CONVERSION_DEFINITIONS
});
state.zoneConversionService = boardDomainAdapter.zoneConversionService;

const engine = {
    state,
    boardDomainAdapter,
    cardRuntimeActivationProvider: () => ({
        activeCardIds: ["CMD_AGRICULTURAL_REFORM"]
    })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

const quote = deck.quoteCardExecutionCost(card);
assert.equal(quote.success, true);
assert.deepEqual(quote.resources, { wood: 20 });
assert.equal(quote.source, "DOMAIN_QUOTE");

const targets = deck.enumerateCardExecutionTargets(card);
assert.equal(targets.length, 1, "only one completed PLAINS Zone is legal");
assert.equal(targets[0].groupId, "zone_plains");

const before = ProductionCalculator.calculateTotalProduction(state);
const beforeWood = state.wood;
const played = deck.playCommandCard(card, { groupId: "zone_plains" }, 0, -1);
assert.equal(played.success, true);
assert.equal(state.wood, beforeWood - 20);
assert.equal(state.material, state.wood);
assert.equal(state.handOffering[0]?.isBlank, true);
assert.equal(state.hasPickedThisTurn, true);
assert.equal(state.permanentPlainsFoodBonus, undefined, "legacy global plains buff must not be written");
assert.equal(state.mergedBlocks.zone_forest.conversion, undefined, "non-selected Zone remains unchanged");

const conversion = state.mergedBlocks.zone_plains.conversion;
assert.equal(conversion.definitionId, definitionId);
assert.deepEqual(conversion.paidCost, { wood: 20 });
assert.deepEqual(conversion.maintenance.resources, {});
assert.ok(
    state.consumedUniqueCards.includes(card.id) || state.usedUniqueCards.includes(card.id),
    "UNIQUE lifecycle must consume Agricultural Reform"
);

const resolved = state.zoneConversionService.resolveProduction("zone_plains");
assert.equal(resolved.memberCount, 4);
assert.deepEqual(resolved.perMemberYields, { food: 1 });
assert.deepEqual(resolved.yields, { food: 4, wood: 0, mystic: 0 });

const after = ProductionCalculator.calculateTotalProduction(state);
assert.equal(
    after.grossFood - before.grossFood,
    4,
    "Agricultural Reform must add exactly +1 food per selected Zone member"
);

const duplicateTargets = deck.enumerateCardExecutionTargets(card);
assert.equal(
    duplicateTargets.some(target => target.groupId === "zone_plains"),
    false,
    "already-converted Zone cannot receive a second conversion"
);

console.log("  product default definition injection PASS");
console.log("  completed PLAINS Zone targeting PASS");
console.log("  Board-owned 🧱20 quote/payment PASS");
console.log("  selected Zone gains 🌾+1 per member without global buff PASS");
console.log("✅ Stage1 Agricultural Reform Zone Conversion v1 PASS");
