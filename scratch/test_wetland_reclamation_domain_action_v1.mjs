import assert from "node:assert/strict";
import fs from "node:fs";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    isDomainActionRequired,
    resolveDomainActionMigrationBlocker
} from "../game/src/cards/legacy_command_execution_inventory.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import {
    attachCardRuntimePolicy,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";

console.log("\nIrrigation Plan Domain Action v1");

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

function terrainCell(r, c, terrainId, extra = {}) {
    return {
        ...emptyCell(r, c),
        placed: true,
        terrain: {
            id: terrainId,
            terrainId,
            nameKey: terrainId,
            gl: terrainId === "E0_WETLAND" ? 1 : 2,
            e: terrainId === "E0_WETLAND" ? 0 : 1,
            food: terrainId === "E0_WETLAND" ? 2 : 0,
            wood: 0,
            material: 0,
            defense: terrainId === "E0_WETLAND" ? 1 : 0,
            mystic: 0
        },
        ...extra
    };
}

const wetlandCard = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_WETLAND_RECLAMATION");
assert.ok(wetlandCard);
assert.equal(isCardRuntimeActive(wetlandCard), false, "production default keeps Irrigation Plan dormant");
assert.deepEqual(wetlandCard.cost, {});
assert.equal(wetlandCard.reqWetland, undefined);
assert.equal(wetlandCard.effects?.length || 0, 0);
assert.deepEqual(
    wetlandCard.executionVariants.map(variant => [variant.id, variant.cost?.wood]),
    [["RECLAIM", 30], ["IRRIGATION_WORKS", 70], ["EXPEDITE", 110]]
);
for (const variant of wetlandCard.executionVariants) {
    assert.equal(variant.effects?.length, 1);
    assert.equal(variant.effects[0].action, "TRANSFORM_TERRAIN");
}

const grid = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => emptyCell(r, c))
);
grid[0][0] = terrainCell(0, 0, "E0_WETLAND", {
    socketResource: { id: "SOCKET_WILD_RICE", bonusFood: 3 }
});
grid[0][1] = terrainCell(0, 1, "E0_WETLAND", {
    socketResource: { id: "SOCKET_LAKE", isLake: true }
});
grid[1][0] = terrainCell(1, 0, "E0_WETLAND", {
    merged: true,
    mergeGroupId: "wetland_zone",
    mergeType: "2x2"
});
grid[1][1] = terrainCell(1, 1, "HQ", { isHQ: true });
grid[2][0] = terrainCell(2, 0, "E0_WETLAND", {
    production: { status: "STALE_WETLAND_SNAPSHOT" }
});
grid[2][1] = terrainCell(2, 1, "GL2_FOREST");

const state = {
    turn: 8,
    stage: { id: 1 },
    food: 100,
    wood: 60,
    material: 60,
    defense: 5,
    currentDefense: 5,
    mystic: 0,
    ember: 10,
    maxEmber: 20,
    grid,
    mergedBlocks: {
        wetland_zone: {
            groupId: "wetland_zone",
            terrainId: "E0_WETLAND",
            zoneCategory: "E0_WETLAND",
            mergeType: "2x2",
            cells: [
                { r: 1, c: 0 },
                { r: 1, c: 1 },
                { r: 0, c: 0 },
                { r: 0, c: 1 }
            ]
        }
    },
    reserveSlots: [null],
    handOffering: [wetlandCard],
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
    cardRuntimeActivationProvider: () => ({ activeCardIds: ["CMD_WETLAND_RECLAMATION"] })
};
engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
const deck = new DeckManager(state, engine);
engine.deckManager = deck;
assert.equal(attachCardRuntimePolicy(deck).success, true);

assert.deepEqual(
    deck.enumerateCardExecutionTargets(wetlandCard),
    [],
    "execution targets remain unresolved until an investment variant is selected"
);
const reclaimCard = { ...wetlandCard, selectedExecutionVariantId: "RECLAIM" };
const targets = deck.enumerateCardExecutionTargets(reclaimCard);
const keys = new Set(targets.map(target => `${target.r}:${target.c}`));
assert.equal(keys.has("0:0"), true, "normal wetland is targetable");
assert.equal(keys.has("2:0"), true, "second normal wetland is targetable");
assert.equal(keys.has("0:1"), false, "Lake wetland is forbidden");
assert.equal(keys.has("1:0"), false, "true merged wetland is forbidden");
assert.equal(keys.has("1:1"), false, "HQ is forbidden");
assert.equal(keys.has("2:1"), false, "non-wetland is forbidden");

const beforeInvalid = { wood: state.wood, material: state.material, ember: state.ember };
const invalid = deck.playCommandCard(reclaimCard, { r: 2, c: 1 }, 0, -1);
assert.equal(invalid.success, false);
assert.deepEqual(
    { wood: state.wood, material: state.material, ember: state.ember },
    beforeInvalid,
    "invalid explicit target fails before payment"
);
assert.equal(state.handOffering[0], wetlandCard);

const before = { wood: state.wood, material: state.material, ember: state.ember };
const played = deck.playCommandCard(reclaimCard, { r: 2, c: 0 }, 0, -1);
assert.equal(played.success, true);
assert.equal(state.wood, before.wood - 30);
assert.equal(state.material, before.material - 30);
assert.equal(state.ember, before.ember);
assert.equal(state.grid[2][0].terrain.terrainId, "E1_RECLAIMED_LAND");
assert.equal(state.grid[2][0].terrain.zoneCategory, "PLAINS");
assert.equal(state.grid[2][0].terrain.food, 4);
assert.equal(state.grid[2][0].terrain.wood, 1);
assert.equal(state.grid[2][0].production, null, "old Wetland production snapshot is discarded");
assert.equal(
    state.grid[0][0].terrain.terrainId,
    "E0_WETLAND",
    "explicit target prevents legacy scan-first mutation"
);
assert.equal(state.grid[0][0].socketResource.id, "SOCKET_WILD_RICE");
assert.equal(state.handOffering[0]?.isBlank, true);
assert.equal(state.hasPickedThisTurn, true);

assert.equal(isDomainActionRequired("CMD_WETLAND_RECLAMATION"), false);
assert.equal(resolveDomainActionMigrationBlocker("CMD_WETLAND_RECLAMATION"), null);
const deckSource = fs.readFileSync(new URL("../game/src/systems/deck_manager.js", import.meta.url), "utf8");
assert.equal(
    deckSource.includes('cId === "CMD_WETLAND_RECLAMATION"'),
    false,
    "legacy Wetland auto-target branch is retired"
);

console.log("  execution-variant legal target enumeration PASS");
console.log("  invalid target fails before payment");
console.log("  A: exact 🧱30 payment and canonical terrain transform PASS");
console.log("  legacy scan-first branch retired");
console.log("✅ Irrigation Plan Domain Action v1 PASS");
