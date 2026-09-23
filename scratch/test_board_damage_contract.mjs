import assert from "node:assert/strict";
import { BoardDamageService, BOARD_DAMAGE_TARGETS } from "../game/src/core/board_damage_service.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";

function makeState() {
    return {
        turn: 20,
        ember: 10,
        maxEmber: 20,
        food: 20,
        wood: 20,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 0,
        reserveSlots: [],
        handOffering: [],
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        grid: [[
            {
                r: 0,
                c: 0,
                placed: true,
                isHQ: false,
                terrain: {
                    id: "GL1_PLAINS",
                    terrainId: "GL1_PLAINS",
                    food: 3,
                    wood: 0,
                    defense: 0,
                    mystic: 0
                },
                specialBlock: {
                    instanceId: "SB1",
                    type: "WATCHTOWER",
                    definitionId: "WATCHTOWER",
                    state: "ACTIVE"
                }
            },
            {
                r: 0,
                c: 1,
                placed: true,
                isHQ: false,
                terrain: {
                    id: "E2_HILL",
                    terrainId: "E2_HILL",
                    food: 0,
                    wood: 1,
                    defense: 2,
                    mystic: 0
                }
            }
        ]],
        mergedBlocks: {},
        placedBlockProduction: {},
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 }
    };
}

const state = makeState();
const service = new BoardDamageService({ state });
const adapter = new BoardDomainAdapter({
    state,
    gridEngine: null,
    boardDamageService: service
});

const source = {
    type: "TRIAL_BATTLE",
    trialIndex: 1,
    scenarioId: "TRIAL_1",
    battleIndex: 0,
    battleSiteId: "BATTLE_SITE@1@TRIAL_1@0@0@0"
};

const land = adapter.recordDamage({
    r: 0,
    c: 0,
    target: BOARD_DAMAGE_TARGETS.LAND,
    source,
    metadata: { note: "semantic-only" }
});
assert.equal(land.success, true);
assert.equal(land.alreadyRecorded, false);
assert.equal(adapter.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.LAND }), true);

const special = adapter.recordDamage({
    r: 0,
    c: 0,
    target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK,
    source
});
assert.equal(special.success, true);
assert.equal(adapter.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK }), true);

// Same semantic source must be idempotent.
const duplicate = adapter.recordDamage({
    r: 0,
    c: 0,
    target: BOARD_DAMAGE_TARGETS.LAND,
    source
});
assert.equal(duplicate.success, true);
assert.equal(duplicate.alreadyRecorded, true);
assert.equal(adapter.getDamageRecords({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.LAND }).length, 1);

// Special Block damage cannot target a cell without a block.
const missingBlock = adapter.recordDamage({
    r: 0,
    c: 1,
    target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK,
    source
});
assert.equal(missingBlock.success, false);
assert.equal(missingBlock.reason, "SPECIAL_BLOCK_REQUIRED");

// v1 damage records are semantic facts only: terrain and Special Block stay unchanged.
assert.equal(state.grid[0][0].terrain.food, 3);
assert.equal(state.grid[0][0].specialBlock.state, "ACTIVE");

// Save/restore must preserve Board damage facts.
const serialized = serializeGameState(state);
assert.equal(serialized.grid[0][0].damageRecords.length, 2);

const restored = makeState();
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
const restoredService = new BoardDamageService({ state: restored });
assert.equal(restoredService.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.LAND }), true);
assert.equal(restoredService.hasDamage({ r: 0, c: 0, target: BOARD_DAMAGE_TARGETS.SPECIAL_BLOCK }), true);
assert.equal(restored.grid[0][0].terrain.food, 3);
assert.equal(restored.grid[0][0].specialBlock.state, "ACTIVE");

console.log("PASS board damage contract");
