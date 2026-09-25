import assert from "node:assert/strict";

import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    ZONE_CONVERSION_PRODUCTION_KINDS,
    ZONE_CONVERSION_PRODUCTION_STATUS
} from "../game/src/core/zone_conversion_domain.js";
import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    ZONE_CONVERSION_DEFINITION_IDS,
    ZONE_CONVERSION_DEFINITIONS
} from "../game/src/data/zone_conversion_definitions.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy } from "../game/src/systems/card_runtime_policy.js";

console.log("\nResettlement Zone Conversion v2");

const definitionId = ZONE_CONVERSION_DEFINITION_IDS.RESETTLEMENT_PLAINS_2X2;
assert.equal(definitionId, "RESETTLEMENT_PLAINS_2X2");

const productEngine = GameEngine.createGame({ runSeed: 20260925 });
assert.ok(
    productEngine.zoneConversionService?.getDefinition(definitionId),
    "product GameEngine must inject the Resettlement Zone Conversion definition"
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

function mergedCell(r, c, {
    groupId,
    mergeType,
    terrainId,
    zoneCategory
}) {
    return {
        ...emptyCell(r, c),
        placed: true,
        merged: true,
        mergeGroupId: groupId,
        mergeType,
        terrain: {
            id: terrainId,
            terrainId,
            zoneCategory,
            gl: terrainId.includes("PLAINS") ? 1 : 2,
            e: terrainId.includes("PLAINS") ? 1 : 0,
            food: terrainId.includes("PLAINS") ? 4 : 2,
            wood: terrainId.includes("FOREST") ? 2 : 0,
            material: terrainId.includes("FOREST") ? 2 : 0,
            defense: terrainId.includes("FOREST") ? 2 : 0,
            mystic: 0
        }
    };
}

function installZone(grid, {
    groupId,
    mergeType,
    terrainId,
    zoneCategory,
    cells
}) {
    for (const pt of cells) {
        grid[pt.r][pt.c] = mergedCell(pt.r, pt.c, {
            groupId,
            mergeType,
            terrainId,
            zoneCategory
        });
    }
    return {
        groupId,
        terrainId,
        zoneCategory,
        mergeType,
        cells,
        yieldMultiplier: 1.2,
        createdTurn: 5
    };
}

const grid = Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => emptyCell(r, c))
);

const plains2x2Cells = [
    { r: 0, c: 0 }, { r: 0, c: 1 },
    { r: 1, c: 0 }, { r: 1, c: 1 }
];
const plainsLCells = [
    { r: 0, c: 3 }, { r: 0, c: 4 },
    { r: 0, c: 5 }, { r: 1, c: 3 }
];
const forest2x2Cells = [
    { r: 3, c: 0 }, { r: 3, c: 1 },
    { r: 4, c: 0 }, { r: 4, c: 1 }
];

const mergedBlocks = {
    zone_plains_2x2: installZone(grid, {
        groupId: "zone_plains_2x2",
        mergeType: "2x2",
        terrainId: "GL1_PLAINS",
        zoneCategory: "PLAINS",
        cells: plains2x2Cells
    }),
    zone_plains_l: installZone(grid, {
        groupId: "zone_plains_l",
        mergeType: "L_SHAPE",
        terrainId: "GL1_PLAINS",
        zoneCategory: "PLAINS",
        cells: plainsLCells
    }),
    zone_forest_2x2: installZone(grid, {
        groupId: "zone_forest_2x2",
        mergeType: "2x2",
        terrainId: "GL2_FOREST",
        zoneCategory: "FOREST",
        cells: forest2x2Cells
    })
};

grid[6][6] = {
    ...emptyCell(6, 6),
    placed: true,
    isHQ: true,
    terrain: {
        id: "HQ",
        terrainId: "HQ",
        food: 5,
        wood: 5,
        defense: 5,
        mystic: 1
    }
};

const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_RESETTLEMENT");
assert.ok(card, "CMD_RESETTLEMENT must exist in generated command master");
assert.deepEqual(card.cost, {}, "Card must not duplicate Board-owned Zone Conversion cost");
assert.equal(card.effects?.length, 1);
assert.equal(card.effects[0].action, "CREATE_ZONE_CONVERSION");
assert.equal(card.effects[0].definitionId, definitionId);
assert.equal(card.effects[0].paymentMode, "DOMAIN_QUOTE");

const state = {
    turn: 20,
    stage: { id: 2, name: "Stage 2", size: 7, maxTiles: 48 },
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
    mergedBlocks,
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
        activeCardIds: ["CMD_RESETTLEMENT"]
    })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

const quote = deck.quoteCardExecutionCost(card);
assert.equal(quote.success, true);
assert.deepEqual(quote.resources, { food: 15, wood: 10 });
assert.equal(quote.source, "DOMAIN_QUOTE");

const targets = deck.enumerateCardExecutionTargets(card);
assert.deepEqual(
    targets.map(target => target.groupId),
    ["zone_plains_2x2"],
    "Resettlement must target only completed PLAINS 2x2 Zones"
);

const before = ProductionCalculator.calculateTotalProduction(state);
const beforeFoodStock = state.food;
const beforeWood = state.wood;
const beforeEmber = state.ember;

const played = deck.playCommandCard(card, { groupId: "zone_plains_2x2" }, 0, -1);
assert.equal(played.success, true);
assert.equal(state.food, beforeFoodStock - 15);
assert.equal(state.wood, beforeWood - 10);
assert.equal(state.material, state.wood);
assert.equal(state.ember, beforeEmber + 2, "creation reward must grant exactly +2 Ember");
assert.equal(state.handOffering[0]?.isBlank, true);
assert.equal(state.hasPickedThisTurn, true);
assert.equal(
    state.resettlementFoodBonus,
    undefined,
    "legacy global resettlementFoodBonus must not be written"
);
assert.equal(
    state.mergedBlocks.zone_plains_l.conversion,
    undefined,
    "non-2x2 PLAINS Zone must remain unchanged"
);
assert.equal(
    state.mergedBlocks.zone_forest_2x2.conversion,
    undefined,
    "non-PLAINS 2x2 Zone must remain unchanged"
);

const conversion = state.mergedBlocks.zone_plains_2x2.conversion;
assert.equal(conversion.definitionId, definitionId);
assert.deepEqual(conversion.paidCost, { food: 15, wood: 10 });
assert.deepEqual(conversion.maintenance.resources, {});
assert.deepEqual(conversion.creationReward.requested, { ember: 2 });
assert.deepEqual(conversion.creationReward.applied, { ember: 2 });

const resolved = state.zoneConversionService.resolveProduction("zone_plains_2x2");
assert.equal(resolved.status, ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED);
assert.equal(resolved.kind, ZONE_CONVERSION_PRODUCTION_KINDS.FIXED_PER_ZONE);
assert.equal(resolved.memberCount, 4);
assert.deepEqual(resolved.fixedYields, { food: 2 });
assert.deepEqual(resolved.yields, { food: 2, wood: 0, mystic: 0 });

const after = ProductionCalculator.calculateTotalProduction(state);
assert.equal(
    after.grossFood - before.grossFood,
    2,
    "Resettlement fixed production must add exactly +2 food per Verse, not +2 per member cell"
);

const cellBreakdown = ProductionCalculator.calculateCellYieldBreakdown(state, 0, 0);
assert.equal(
    cellBreakdown.modifiers.some(modifier => modifier.type === "ZONE_CONVERSION"),
    false,
    "fixed per-Zone production must not be duplicated into member-cell breakdown"
);

const targetsAfterConversion = deck.enumerateCardExecutionTargets(card);
assert.equal(
    targetsAfterConversion.some(target => target.groupId === "zone_plains_2x2"),
    false,
    "already-converted Zone cannot receive Resettlement again"
);

console.log("  canonical product definition injection PASS");
console.log("  completed PLAINS 2x2-only targeting PASS");
console.log("  Board-owned 🌾15 / 🧱10 quote and payment PASS");
console.log("  immediate 🔥+2 creation reward PASS");
console.log("  fixed Zone-level 🌾+2/T without cell duplication PASS");
console.log("  legacy global state remains unused PASS");
console.log("✅ Resettlement Zone Conversion v2 PASS");
