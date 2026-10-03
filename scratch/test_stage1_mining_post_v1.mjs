import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    MINERAL_RESOURCE_CATEGORIES,
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES,
    getSpecialBlockDefinition,
    readSpecialBlockAdjacencyProfile
} from "../game/src/core/special_block_domain.js";
import {
    SPECIAL_BLOCK_PRODUCTION_KINDS,
    SpecialBlockProductionResolver
} from "../game/src/core/special_block_production.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy, isCardRuntimeActive } from "../game/src/systems/card_runtime_policy.js";

function terrain(id, e, gl, yields = {}) {
    return {
        id,
        terrainId: id,
        e,
        gl,
        food: yields.food || 0,
        wood: yields.wood || 0,
        material: yields.wood || 0,
        defense: yields.defense || 0,
        mystic: yields.mystic || 0
    };
}

function cell(r, c, base = null, socketResource = null) {
    return {
        r,
        c,
        placed: Boolean(base),
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId: null,
        terrain: base,
        specialBlock: null,
        searched: Boolean(socketResource),
        hasSocket: Boolean(socketResource),
        socketResource,
        cachedSocketSeeds: {}
    };
}

const mineralCategories = [
    "CAT_STRATEGIC_MINERAL",
    "CAT_PRECIOUS_METAL",
    "CAT_SPECIAL_MINERAL"
];
assert.deepEqual([...MINERAL_RESOURCE_CATEGORIES], mineralCategories);

const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_MINE");
assert.ok(card, "CMD_MINE must exist");
assert.equal(card.minStage, 1);
assert.equal(card.rarity, "UC");
assert.equal(card.weight, 0.25);
assert.deepEqual(card.cost, {});
assert.equal(card.reqOreSocket, undefined);
assert.equal(card.reqWood, undefined);
assert.deepEqual(card.offering?.requirements, [{
    type: "SOCKET_CATEGORY_ANY",
    categories: mineralCategories
}]);
assert.deepEqual(card.effects, [{
    type: "DOMAIN_ACTION",
    action: "CREATE_SPECIAL_BLOCK",
    blockType: "MINE",
    paymentMode: "DOMAIN_QUOTE",
    logActivation: true
}]);
assert.equal(isCardRuntimeActive(card), true, "Mining Post is active by default");

const definition = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.MINE);
assert.equal(definition.placement.mode, "INDEPENDENT_CELL_GENERATION");
assert.deepEqual([...definition.placement.sourceResourceCategories], mineralCategories);
assert.equal(definition.placement.sourceSelection, "MAX_RESOURCE_BONUS_CHANNELS");
assert.equal(definition.placement.maxPerSource, 1);
assert.equal(definition.placement.allowSourceTerrainAdjacency, true);
assert.equal(definition.placement.participatesInZones, false);
assert.equal(definition.baseTerrainInteraction.kind, "INDEPENDENT");
assert.deepEqual(definition.creationCost, {
    status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
    resources: { wood: 25 }
});
assert.equal(definition.production.kind, SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_RESOURCE_BONUS);
assert.equal(definition.production.status, "RESOLVED");
assert.deepEqual([...definition.production.allowedResourceCategories], mineralCategories);
assert.equal(definition.production.perPositiveYield, 1);

const hematite = {
    id: "SOCKET_HEMATITE",
    category: "CAT_STRATEGIC_MINERAL",
    bonusFood: 0,
    bonusWood: 1,
    bonusDefense: 2,
    bonusMystic: 0
};
const gold = {
    id: "SOCKET_GOLD_VEIN",
    category: "CAT_PRECIOUS_METAL",
    bonusFood: 0,
    bonusWood: 2,
    bonusDefense: 0,
    bonusMystic: 2
};
const crystal = {
    id: "SOCKET_CRYSTAL",
    category: "CAT_SPECIAL_MINERAL",
    bonusFood: 0,
    bonusWood: 0,
    bonusDefense: 0,
    bonusMystic: 3
};
const stone = {
    id: "SOCKET_GRANITE",
    category: "CAT_STONE",
    bonusFood: 0,
    bonusWood: 3,
    bonusDefense: 1,
    bonusMystic: 0
};

const grid = [
    [
        cell(0, 0, terrain("E2_DESERT_HILL", 2, 0, { wood: 1, defense: 1, mystic: 2 }), hematite),
        cell(0, 1),
        cell(0, 2, terrain("E2_HILL", 2, 1), stone),
        cell(0, 3)
    ],
    [
        cell(1, 0),
        cell(1, 1),
        cell(1, 2),
        cell(1, 3)
    ],
    [
        cell(2, 0, terrain("E3_MOUNTAIN", 3, 0, { wood: 3, defense: 5, mystic: 1 }), gold),
        cell(2, 1),
        cell(2, 2),
        cell(2, 3)
    ],
    [
        cell(3, 0),
        cell(3, 1),
        cell(3, 2),
        cell(3, 3, terrain("E3_MOUNTAIN", 3, 0, { wood: 3, defense: 5, mystic: 1 }), crystal)
    ]
];

const state = {
    turn: 6,
    stage: { id: 1 },
    food: 60,
    wood: 100,
    material: 100,
    defense: 5,
    currentDefense: 5,
    mystic: 0,
    ember: 10,
    maxEmber: 20,
    grid,
    mergedBlocks: {},
    reserveSlots: [null],
    handOffering: [card],
    consumedUniqueCards: [],
    usedUniqueCards: [],
    activeBuffs: [],
    hasPickedThisTurn: false,
    hasReservedThisTurn: false,
    hasMulliganedThisTurn: false,
    logs: [],
    addLog(message) { this.logs.push(message); },
    addBuff(buff) { this.activeBuffs.push(buff); },
    isHQVicinity() { return false; }
};

const boardDomainAdapter = new BoardDomainAdapter({ state });
const engine = {
    state,
    boardDomainAdapter,
    cardRuntimeActivationProvider: () => ({ activeCardIds: [card.id] })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

assert.deepEqual(deck.quoteCardExecutionCost(card), {
    success: true,
    resources: { wood: 25 },
    source: "DOMAIN_QUOTE",
    quote: {
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources: { wood: 25 }
    }
});

assert.equal(deck.isCardEligible(card, 1, 0), true, "mineral resource + legal target exposes Offering");

const targets = deck.enumerateCardExecutionTargets(card);
assert.ok(targets.length > 0);
assert.ok(
    targets.every(target => Number.isInteger(target.r) && Number.isInteger(target.c)),
    "execution targets expose top-level destination coordinates for production UI"
);
assert.ok(targets.some(target =>
    target.r === 0 && target.c === 1
    && target.source?.r === 0 && target.source?.c === 0
), "strategic mineral exposes adjacent empty target even when source is desert-like");
assert.ok(targets.some(target =>
    target.r === 2 && target.c === 1
    && target.source?.r === 2 && target.source?.c === 0
), "precious metal on mountain can be the bound source");
assert.ok(targets.some(target =>
    target.source?.r === 3 && target.source?.c === 3
), "special mineral can be the bound source");
assert.equal(
    targets.some(target => target.source?.r === 0 && target.source?.c === 2),
    false,
    "stone resources are intentionally outside the Mining Post mineral umbrella"
);

state.handOffering = [card];
state.hasPickedThisTurn = false;
const beforeWood = state.wood;
const result = deck.playCommandCard(card, { r: 0, c: 1 }, 0, -1);
assert.equal(result.success, true);
assert.equal(state.wood, beforeWood - 25);
assert.equal(state.material, state.wood);

const builtCell = state.grid[0][1];
assert.equal(builtCell.placed, false, "Mining Post is a special-only block");
assert.equal(builtCell.specialBlock?.definitionId, SPECIAL_BLOCK_TYPES.MINE);
assert.deepEqual(
    readSpecialBlockAdjacencyProfile(builtCell),
    { e: 2, gl: 1, source: { r: 0, c: 0 } },
    "Mining Post inherits source E and uses GL1"
);

const production = new SpecialBlockProductionResolver().resolveCell(
    state,
    builtCell,
    { r: 0, c: 1 }
);
assert.equal(production.status, "RESOLVED");
assert.deepEqual(
    production.yields,
    { food: 0, wood: 1, defense: 1, mystic: 0 },
    "each positive yield channel from the linked mineral resource gains exactly +1"
);

const duplicateTargets = deck.enumerateCardExecutionTargets(card);
assert.equal(
    duplicateTargets.some(target => target.source?.r === 0 && target.source?.c === 0),
    false,
    "one mineral resource may bind only one active Mining Post"
);
assert.equal(
    boardDomainAdapter.validateSpecialBlockTarget(
        SPECIAL_BLOCK_TYPES.MINE,
        { source: { r: 0, c: 0 }, destination: { r: 1, c: 0 } }
    ).reason,
    "SOURCE_ALREADY_SERVICED"
);

state.grid[0][1].specialBlock.state = "DAMAGED";
const damagedDuplicate = boardDomainAdapter.validateSpecialBlockTarget(
    SPECIAL_BLOCK_TYPES.MINE,
    { source: { r: 0, c: 0 }, destination: { r: 1, c: 0 } }
);
assert.equal(damagedDuplicate.valid, false);
assert.equal(
    damagedDuplicate.reason,
    "SOURCE_ALREADY_SERVICED",
    "a damaged Mining Post still occupies the one-per-resource slot"
);
state.grid[0][1].specialBlock.state = "ACTIVE";

// When one destination touches multiple legal mineral resources, production UI
// still needs one deterministic source. Prefer the resource whose +1 effect
// touches the most positive yield channels, then use stable coordinates.
{
    const lowValueMineral = {
        id: "SOCKET_TEST_IRON",
        category: "CAT_STRATEGIC_MINERAL",
        bonusFood: 0,
        bonusWood: 1,
        bonusDefense: 0,
        bonusMystic: 0
    };
    const highValueMineral = {
        id: "SOCKET_TEST_GOLD",
        category: "CAT_PRECIOUS_METAL",
        bonusFood: 0,
        bonusWood: 1,
        bonusDefense: 0,
        bonusMystic: 1
    };
    const multiSourceState = {
        grid: [
            [cell(0, 0), cell(0, 1, terrain("E2_HILL", 2, 1), highValueMineral), cell(0, 2)],
            [cell(1, 0, terrain("E2_HILL", 2, 1), lowValueMineral), cell(1, 1), cell(1, 2)],
            [cell(2, 0), cell(2, 1), cell(2, 2)]
        ]
    };
    const multiSourceBoard = new BoardDomainAdapter({ state: multiSourceState });
    const selected = multiSourceBoard.validateSpecialBlockTarget(
        SPECIAL_BLOCK_TYPES.MINE,
        { r: 1, c: 1 }
    );
    assert.equal(selected.valid, true);
    assert.deepEqual(
        selected.source,
        { r: 0, c: 1 },
        "destination-only UI selects the mineral resource with the largest +1 channel count"
    );
}

const noMineralState = {
    ...state,
    wood: 100,
    material: 100,
    grid: [
        [cell(0, 0, terrain("E2_HILL", 2, 1), stone), cell(0, 1)],
        [cell(1, 0), cell(1, 1)]
    ],
    handOffering: [card]
};
const noMineralBoard = new BoardDomainAdapter({ state: noMineralState });
const noMineralEngine = { state: noMineralState, boardDomainAdapter: noMineralBoard };
noMineralEngine.cardDomainActionExecutor = createCardDomainActionExecutor(noMineralEngine);
const noMineralDeck = new DeckManager(noMineralState, noMineralEngine);
assert.equal(
    noMineralDeck.isCardEligible(card, 1, 0),
    false,
    "stone alone does not satisfy the mineral Offering condition"
);

console.log("✅ Stage1 Mining Post v1 PASS");
