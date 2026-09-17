import assert from "node:assert/strict";
import { BoardPresentationDataService } from "../game/src/presentation/board_presentation_data_service.js";
import { BoardPresentationState } from "../game/src/presentation/board_presentation_state.js";
import { createBoardPresentationDto } from "../game/src/presentation/board_presentation_contract.js";
import { BOARD_INPUT_COMMANDS, createBoardInputCommand, serializeBoardInputCommand } from "../game/src/presentation/board_input_contract.js";
import { GameRuntimeSnapshotDataService } from "../game/src/presentation/game_runtime_snapshot_data_service.js";
import { createGameRuntimeSnapshotDto } from "../game/src/presentation/game_runtime_snapshot_contract.js";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log("🎮 Portable board presentation / Unity boundary tests");

const grid = [
    [
        { placed: true, merged: true, mergeGroupId: "zone-a", placementGroupId: "placement-a", terrain: { terrainId: "PLAINS", id: "PLAINS", nameKey: "PLAINS", e: 1, gl: 1 } },
        { placed: true, merged: true, mergeGroupId: "zone-a", placementGroupId: "placement-a", terrain: { terrainId: "PLAINS", id: "PLAINS", nameKey: "PLAINS", e: 1, gl: 1 } }
    ],
    [
        { placed: true, merged: false, terrain: { terrainId: "FOREST", id: "FOREST", nameKey: "FOREST", e: 1, gl: 2 }, hasSocket: true, socketResource: { id: "SOCKET_WOOD", nameKey: "SOCKET_WOOD", yields: { wood: 2 } } },
        { placed: false }
    ]
];

const viewData = new Map([
    ["0:0", {
        r: 0, c: 0, placed: true, isHQ: false, terrainId: "PLAINS", category: "LAND", nameKey: "PLAINS",
        elevation: 1, greenery: 1, hasSocket: false, socketResource: null,
        yields: { food: 3, wood: 1, defense: 0, mystic: 0 },
        baseYields: { food: 2, wood: 1, defense: 0, mystic: 0 },
        primaryYield: { resource: "food", amount: 3 },
        modifiers: [{ type: "BONUS", resource: "food", amount: 1 }],
        placementGroupId: "placement-a", mergeGroupId: "zone-a"
    }],
    ["0:1", {
        r: 0, c: 1, placed: true, isHQ: false, terrainId: "PLAINS", category: "LAND", nameKey: "PLAINS",
        elevation: 1, greenery: 1, hasSocket: false, socketResource: null,
        yields: { food: 2, wood: 2, defense: 0, mystic: 0 },
        baseYields: { food: 2, wood: 2, defense: 0, mystic: 0 },
        primaryYield: { resource: "food", amount: 2 },
        modifiers: [], placementGroupId: "placement-a", mergeGroupId: "zone-a"
    }],
    ["1:0", {
        r: 1, c: 0, placed: true, isHQ: false, terrainId: "FOREST", category: "LAND", nameKey: "FOREST",
        elevation: 1, greenery: 2, hasSocket: true,
        socketResource: { id: "SOCKET_WOOD", nameKey: "SOCKET_WOOD", category: null, yields: { food: 0, wood: 2, defense: 0, mystic: 0 } },
        yields: { food: 0, wood: 5, defense: 0, mystic: 0 },
        baseYields: { food: 0, wood: 3, defense: 0, mystic: 0 },
        primaryYield: { resource: "wood", amount: 5 },
        modifiers: [{ type: "SOCKET", resource: "wood", amount: 2 }],
        placementGroupId: null, mergeGroupId: null
    }],
    ["1:1", {
        r: 1, c: 1, placed: false, isHQ: false, terrainId: null, category: null, nameKey: null,
        elevation: null, greenery: null, hasSocket: false, socketResource: null,
        yields: { food: 0, wood: 0, defense: 0, mystic: 0 }, primaryYield: null,
        modifiers: [], placementGroupId: null, mergeGroupId: null
    }]
]);

const cellViewDataService = {
    getCellViewData(_state, r, c) {
        return viewData.get(`${r}:${c}`) || null;
    }
};

const state = {
    grid,
    mergedBlocks: {
        "zone-a": { terrainId: "PLAINS", zoneCategory: "LAND", mergeType: "TEST", yieldMultiplier: 1.2 }
    },
    mergeLinks: new Set(),
    isHQVicinity: () => false,
    isWaterSourceInfluence: () => false,
    turn: 12,
    stage: { id: 2, name: "Stage 2", size: 2, maxTiles: 24 },
    ember: 7,
    maxEmber: 13,
    food: 9,
    wood: 5,
    currentDefense: 6,
    mystic: 4
};

const presentationState = new BoardPresentationState();
const service = new BoardPresentationDataService({ cellViewDataService });
const readModel = service.getBoard(state, { presentationState });
const dto = createBoardPresentationDto(readModel);

test("merged production is resolved before renderer DTO consumption", () => {
    const primary = dto.cells[0][0];
    const secondary = dto.cells[0][1];
    assert.equal(primary.display.role, "LAND_PRIMARY");
    assert.deepEqual(primary.display.production, {
        food: 6,
        wood: 3,
        defense: 0,
        mystic: 0,
        primaryYield: { resource: "food", amount: 6 }
    });
    assert.equal(secondary.display.role, "CLEAN");
    assert.equal(secondary.display.production, null);
});

test("socket semantics remain presentation data instead of renderer inference", () => {
    const socket = dto.cells[1][0];
    assert.equal(socket.display.role, "SOCKET");
    assert.equal(socket.display.production, null);
    assert.equal(socket.socketResource.id, "SOCKET_WOOD");
});

test("portable board DTO contains no screen/world/DOM coordinates", () => {
    const serialized = JSON.stringify(dto);
    for (const forbidden of ["screenX", "screenY", "worldPosition", "pixelOffset", "DOMRect", "HTMLElement", "GameObject", "Transform"]) {
        assert.equal(serialized.includes(forbidden), false, `forbidden renderer field leaked: ${forbidden}`);
    }
});

test("logical board input serializes without renderer-specific coordinates", () => {
    const command = createBoardInputCommand(BOARD_INPUT_COMMANDS.SELECT_CELL, { cell: { r: 1, c: 0 } });
    const serialized = serializeBoardInputCommand(command);
    assert.deepEqual(JSON.parse(serialized).payload.cell, { r: 1, c: 0 });
    assert.equal(serialized.includes("screen"), false);
    assert.equal(serialized.includes("world"), false);
});

test("runtime HUD snapshot is JSON-safe and does not expose GameState internals", () => {
    const runtimeService = new GameRuntimeSnapshotDataService();
    const runtimeDto = createGameRuntimeSnapshotDto(runtimeService.getSnapshot(state));
    assert.deepEqual(runtimeDto.progression, {
        verse: 12,
        stage: { id: 2, name: "Stage 2", size: 2, maxTiles: 24 }
    });
    assert.deepEqual(runtimeDto.resources.ember, { current: 7, max: 13 });
    assert.deepEqual(runtimeDto.resources.food, { current: 9 });
    assert.deepEqual(runtimeDto.resources.material, { current: 5 });
    assert.deepEqual(runtimeDto.resources.defense, { current: 6, max: 10 });
    assert.deepEqual(runtimeDto.resources.mystic, { current: 4 });
    const serialized = JSON.stringify(runtimeDto);
    for (const forbidden of ["grid", "mergedBlocks", "mergeLinks", "directiveSystem", "document", "window", "GameObject", "Transform"]) {
        assert.equal(serialized.includes(forbidden), false, `runtime snapshot leaked internal field: ${forbidden}`);
    }
});

console.log(`\n✅ Portable board presentation / Unity boundary: ${passed}/${passed} tests passed`);
