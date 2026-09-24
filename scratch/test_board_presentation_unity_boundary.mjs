import assert from "node:assert/strict";
import { BoardPresentationDataService } from "../game/src/presentation/board_presentation_data_service.js";
import {
    resolveBoardDisplayProduction,
    resolveBoardDisplayRole,
    resolveSocketPrimaryYield
} from "../game/src/presentation/board_presentation_semantic_service.js";
import { BoardPresentationRuntimeAdapter } from "../game/src/presentation/board_presentation_runtime_adapter.js";
import { BoardPresentationState } from "../game/src/presentation/board_presentation_state.js";
import { createBoardPresentationDto } from "../game/src/presentation/board_presentation_contract.js";
import { BOARD_INPUT_COMMANDS, createBoardInputCommand, serializeBoardInputCommand } from "../game/src/presentation/board_input_contract.js";
import { BoardInputDispatcher } from "../game/src/presentation/board_input_dispatcher.js";
import { GameRuntimeSnapshotDataService } from "../game/src/presentation/game_runtime_snapshot_data_service.js";
import { createGameRuntimeSnapshotDto } from "../game/src/presentation/game_runtime_snapshot_contract.js";
import { LegacyWeb2DBoardInputAdapter } from "../game/src/ui/legacy_web2d_board_input_adapter.js";
import { getWaterSourceInfluenceType } from "../game/src/core/lake_rules.js";
import fs from "node:fs";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log("🎮 Portable board presentation / Unity boundary tests");

const grid = [
    [
        { placed: true, merged: true, searched: true, mergeGroupId: "zone-a", placementGroupId: "placement-a", terrain: { terrainId: "PLAINS", id: "PLAINS", nameKey: "PLAINS", e: 1, gl: 1 } },
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

test("normal Web2D cell tooltip consumes BoardPresentationData", () => {
    const source = fs.readFileSync(
        new URL("../game/src/ui/board_aware_ui_controller.js", import.meta.url),
        "utf8"
    );
    const start = source.indexOf("    showBoardPresentationCellTooltip(e, r, c, cell) {");
    const end = source.indexOf("\n    onCellClick(r, c) {", start);
    assert.ok(start >= 0 && end > start);
    const tooltipSource = source.slice(start, end);

    assert.equal(tooltipSource.includes("cell.interaction?.placedThisTurn"), true);
    assert.equal(tooltipSource.includes("cell.influence?.hqVicinity"), true);
    assert.equal(tooltipSource.includes("cell.influence?.waterSourceType"), true);
    assert.equal(tooltipSource.includes("cell.yields"), true);
    assert.equal(tooltipSource.includes("cell.modifiers"), true);
    assert.equal(tooltipSource.includes("cell.socketResource"), true);

    assert.equal(tooltipSource.includes("this.undoSys"), false);
    assert.equal(tooltipSource.includes("this.state.isHQVicinity"), false);
    assert.equal(tooltipSource.includes("this.engine.getCellViewData"), false);
    assert.equal(tooltipSource.includes("this.state.grid"), false);
});

test("Trial cell tooltip remains on the existing Trial presentation path", () => {
    const source = fs.readFileSync(
        new URL("../game/src/ui/board_aware_ui_controller.js", import.meta.url),
        "utf8"
    );
    const start = source.indexOf("    onCellMouseMove(e, r, c) {");
    const end = source.indexOf("\n    showBoardPresentationCellTooltip", start);
    assert.ok(start >= 0 && end > start);
    const moveSource = source.slice(start, end);

    assert.equal(moveSource.includes("BOARD_CONTEXT_MODES.TRIAL"), true);
    assert.equal(moveSource.includes("super.onCellMouseMove(e, r, c)"), true);
    assert.equal(moveSource.includes("this.getBoardPresentationData()?.cells?.[r]?.[c]"), true);
});

test("water source influence type is renderer-neutral", () => {
    const lakeState = {
        grid: [
            [
                { placed: true, socketResource: { id: "SOCKET_LAKE" } },
                { placed: false }
            ],
            [
                { placed: false },
                { placed: false }
            ]
        ]
    };
    const oasisState = {
        grid: [
            [
                { placed: false },
                { placed: false }
            ],
            [
                { placed: false },
                { placed: true, socketResource: { id: "SOCKET_OASIS" } }
            ]
        ]
    };

    assert.equal(getWaterSourceInfluenceType(lakeState, 0, 0), "LAKE");
    assert.equal(getWaterSourceInfluenceType(lakeState, 1, 1), "LAKE");
    assert.equal(getWaterSourceInfluenceType(oasisState, 0, 0), "OASIS");
    assert.equal(getWaterSourceInfluenceType({ grid: [[{ placed: false }]] }, 0, 0), null);
});

test("generic irrigation source keeps null legacy waterSourceType", () => {
    const genericGrid = [[
        { placed: true, irrigationSource: true },
        { placed: false }
    ]];
    const genericState = {
        grid: genericGrid,
        mergedBlocks: {},
        mergeLinks: new Set(),
        isHQVicinity: () => false
    };
    const genericService = new BoardPresentationDataService({
        cellViewDataService: {
            getCellViewData(_state, r, c) {
                const source = genericGrid?.[r]?.[c] || {};
                return {
                    r, c,
                    placed: Boolean(source.placed),
                    isHQ: false,
                    terrainId: null,
                    category: "LAND",
                    nameKey: null,
                    elevation: null,
                    greenery: null,
                    hasSocket: false,
                    socketResource: null,
                    yields: {},
                    baseYields: {},
                    primaryYield: null,
                    modifiers: [],
                    placementGroupId: null,
                    mergeGroupId: null
                };
            }
        }
    });
    const genericReadModel = genericService.getBoard(genericState, {
        presentationState: new BoardPresentationState()
    });
    assert.equal(getWaterSourceInfluenceType(genericState, 0, 0), null);
    assert.equal(genericReadModel.cells[0][0].influence.waterSource, true);
    assert.equal(genericReadModel.cells[0][0].influence.waterSourceType, null);
});

test("BoardPresentationData and DTO preserve water source type", () => {
    const waterGrid = [
        [
            { placed: true, socketResource: { id: "SOCKET_OASIS" } },
            { placed: false }
        ]
    ];
    const waterState = {
        grid: waterGrid,
        mergedBlocks: {},
        mergeLinks: new Set(),
        isHQVicinity: () => false
    };
    const waterService = new BoardPresentationDataService({
        cellViewDataService: {
            getCellViewData(_state, r, c) {
                const source = waterGrid?.[r]?.[c] || {};
                return {
                    r, c,
                    placed: Boolean(source.placed),
                    isHQ: false,
                    terrainId: null,
                    category: "LAND",
                    nameKey: null,
                    elevation: null,
                    greenery: null,
                    hasSocket: Boolean(source.socketResource),
                    socketResource: source.socketResource || null,
                    yields: {},
                    baseYields: {},
                    primaryYield: null,
                    modifiers: [],
                    placementGroupId: null,
                    mergeGroupId: null
                };
            }
        }
    });
    const waterReadModel = waterService.getBoard(waterState, {
        presentationState: new BoardPresentationState()
    });
    const waterDto = createBoardPresentationDto(waterReadModel);

    assert.equal(waterReadModel.cells[0][0].influence.waterSource, true);
    assert.equal(waterReadModel.cells[0][0].influence.waterSourceType, "OASIS");
    assert.equal(waterReadModel.cells[0][1].influence.waterSourceType, "OASIS");
    assert.equal(waterDto.cells[0][1].influence.waterSourceType, "OASIS");
});

test("shared display role is the renderer-neutral SSOT", () => {
    assert.equal(resolveBoardDisplayRole(state, {
        r: 0, c: 0, placed: true, isHQ: false,
        socketResource: null, mergeGroupId: "zone-a", placementGroupId: "placement-a"
    }), "LAND_PRIMARY");
    assert.equal(resolveBoardDisplayRole(state, {
        r: 0, c: 1, placed: true, isHQ: false,
        socketResource: null, mergeGroupId: "zone-a", placementGroupId: "placement-a"
    }), "CLEAN");
    assert.equal(resolveBoardDisplayRole(state, {
        r: 1, c: 0, placed: true, isHQ: false,
        socketResource: { id: "SOCKET_WOOD" }, mergeGroupId: null, placementGroupId: null
    }), "SOCKET");
});

test("socket primary yield tie-breaks are renderer-neutral semantics", () => {
    assert.deepEqual(resolveSocketPrimaryYield({
        id: "IRON_ORE",
        yields: { food: 0, wood: 3, defense: 3, mystic: 0 }
    }), { resource: "wood", amount: 3 });

    assert.deepEqual(resolveSocketPrimaryYield({
        id: "GUARD_POST",
        yields: { food: 0, wood: 2, defense: 2, mystic: 2 }
    }), { resource: "defense", amount: 2 });

    assert.deepEqual(resolveSocketPrimaryYield({
        id: "WHEAT_FIELD",
        yields: { food: 4, wood: 4, defense: 0, mystic: 0 }
    }), { resource: "food", amount: 4 });
});

test("socket with no own yield falls back to shared land production", () => {
    const fallbackState = {
        grid: [[{
            placed: true,
            merged: false,
            terrain: { terrainId: "PLAINS" },
            socketResource: { id: "EMPTY_SOCKET", yields: { food: 0, wood: 0, defense: 0, mystic: 0 } }
        }]]
    };
    const fallbackFacts = {
        r: 0,
        c: 0,
        placed: true,
        isHQ: false,
        terrainId: "PLAINS",
        socketResource: fallbackState.grid[0][0].socketResource,
        baseYields: { food: 2, wood: 1, defense: 0, mystic: 0 },
        modifiers: [],
        mergeGroupId: null,
        placementGroupId: null
    };
    const fallbackService = {
        getCellViewData() {
            return fallbackFacts;
        }
    };
    const production = resolveBoardDisplayProduction(
        fallbackState,
        fallbackFacts,
        fallbackService
    );
    assert.deepEqual(production, {
        food: 2,
        wood: 1,
        defense: 0,
        mystic: 0,
        primaryYield: { resource: "food", amount: 2 }
    });
});

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

test("searched cell fact is portable presentation semantic instead of Web DOM inference", () => {
    assert.equal(dto.cells[0][0].display.searched, true);
    assert.equal(dto.cells[0][1].display.searched, false);
});

test("socket semantics remain presentation data instead of renderer inference", () => {
    const socket = dto.cells[1][0];
    assert.equal(socket.display.role, "SOCKET");
    assert.deepEqual(socket.display.production, {
        food: 0,
        wood: 2,
        defense: 0,
        mystic: 0,
        primaryYield: { resource: "wood", amount: 2 }
    });
    assert.equal(socket.socketResource.id, "SOCKET_WOOD");
});

test("browser BoardAware UI routes board reads through the shared runtime adapter", () => {
    const source = fs.readFileSync(
        new URL("../game/src/ui/board_aware_ui_controller.js", import.meta.url),
        "utf8"
    );
    assert.equal(source.includes("new BoardPresentationRuntimeAdapter"), true);
    assert.equal(source.includes("this.boardPresentationRuntimeAdapter.getBoard(this.state"), true);
    assert.equal(source.includes("this.boardPresentationDataService.getBoard(this.state"), false);
});

test("shared browser runtime keeps selection separate from primary gameplay action", () => {
    const runtimeSource = fs.readFileSync(
        new URL("../game/src/ui/board_presentation_runtime_bridge.js", import.meta.url),
        "utf8"
    );
    const web25dSource = fs.readFileSync(
        new URL("../game/src/ui/web25d_board_runtime_bridge.js", import.meta.url),
        "utf8"
    );
    const resolverSource = fs.readFileSync(
        new URL("../game/src/presentation/board_input_semantic_resolver.js", import.meta.url),
        "utf8"
    );
    assert.equal(runtimeSource.includes("selectCell: ({ cell }) =>"), false);
    assert.equal(runtimeSource.includes("primaryCellAction: ({ cell }) =>"), true);
    assert.equal(runtimeSource.includes("uiController.onCellClick(cell.r, cell.c)"), false);
    assert.equal(runtimeSource.includes("uiController.performPrimaryCellAction(cell.r, cell.c)"), true);
    assert.equal(web25dSource.includes("boardPresentationRuntimeBridge"), true);
    assert.equal(web25dSource.includes("new BoardRendererBridge"), false);
    assert.equal(resolverSource.includes("BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION"), true);
});

test("browser Web2D click path emits portable primary/trial commands", () => {
    const source = fs.readFileSync(
        new URL("../game/src/ui/board_aware_ui_controller.js", import.meta.url),
        "utf8"
    );
    assert.equal(source.includes("BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION"), true);
    assert.equal(source.includes("BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION"), true);
    assert.equal(source.includes("new LegacyWeb2DBoardInputAdapter(this)"), true);
});

test("placed-this-turn interaction state stays portable", () => {
    const readModel = new BoardPresentationRuntimeAdapter().getBoard(state, {
        presentationState,
        interactionQuery: {
            isCellPlacedThisTurn: (r, c) => r === 0 && c === 1
        }
    });
    assert.equal(readModel.cells[0][1].interaction.placedThisTurn, true);
    assert.equal(readModel.cells[0][0].interaction.placedThisTurn, false);

    const dto = createBoardPresentationDto(readModel);
    assert.equal(dto.cells[0][1].interaction.placedThisTurn, true);
    assert.equal(dto.cells[0][0].interaction.placedThisTurn, false);
});

test("placed-this-turn defaults false without runtime query", () => {
    const readModel = new BoardPresentationRuntimeAdapter().getBoard(state, {
        presentationState
    });
    assert.equal(readModel.cells[0][0].interaction.placedThisTurn, false);
});

test("runtime adapter is the shared runtime-to-presentation entrypoint", () => {
    let capturedTrialInput = null;
    const runtimeAdapter = new BoardPresentationRuntimeAdapter({
        dataService: service,
        trialAdapter: {
            fromRuntime(input) {
                capturedTrialInput = input;
                return {
                    available: false,
                    activeRouteId: null,
                    selectedInterceptCell: null,
                    hoveredInterceptCell: null,
                    routes: [],
                    interceptionCandidates: [],
                    plannedIntercepts: [],
                    battleMarkers: [],
                    enemyState: null
                };
            }
        }
    });
    const runtimeReadModel = runtimeAdapter.getBoard(state, {
        presentationState,
        trialState: { phase: "SETUP" },
        trialPresentationState: { activeEnemyRoute: null }
    });

    assert.deepEqual(capturedTrialInput.boardSize, { rows: 2, columns: 2 });
    assert.equal(capturedTrialInput.trialState.phase, "SETUP");
    assert.equal(runtimeReadModel.cells[0][0].display.role, "LAND_PRIMARY");
    assert.equal(runtimeReadModel.cells[0][1].display.role, "CLEAN");
});

test("runtime adapter uses grid override as presentation board without mutating GameState", () => {
    const overrideGrid = [[grid[0][0]]];
    let capturedBoardSize = null;
    const runtimeAdapter = new BoardPresentationRuntimeAdapter({
        dataService: service,
        trialAdapter: {
            fromRuntime(input) {
                capturedBoardSize = input.boardSize;
                return {
                    available: false,
                    activeRouteId: null,
                    selectedInterceptCell: null,
                    hoveredInterceptCell: null,
                    routes: [],
                    interceptionCandidates: [],
                    plannedIntercepts: [],
                    battleMarkers: [],
                    enemyState: null
                };
            }
        }
    });
    const runtimeReadModel = runtimeAdapter.getBoard(state, { presentationState, gridOverride: overrideGrid });

    assert.deepEqual(capturedBoardSize, { rows: 1, columns: 1 });
    assert.deepEqual(runtimeReadModel.board, { rows: 1, columns: 1 });
    assert.equal(state.grid, grid);
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

test("legacy Web 2D keeps selection separate from primary gameplay action", () => {
    const selected = [];
    const actions = [];
    const adapter = new LegacyWeb2DBoardInputAdapter({
        isTrialInteractionActive: () => false,
        selectBoardPresentationCell(r, c) { selected.push({ r, c }); return { r, c }; },
        performPrimaryCellAction(r, c) { actions.push({ r, c }); return true; }
    });

    const selectionResult = adapter.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_CELL,
        { cell: { r: 1, c: 0 } }
    ));
    const actionResult = adapter.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
        { cell: { r: 0, c: 1 } }
    ));

    assert.equal(selectionResult.success, true);
    assert.equal(actionResult.success, true);
    assert.deepEqual(selected, [{ r: 1, c: 0 }]);
    assert.deepEqual(actions, [{ r: 0, c: 1 }]);
});

test("BoardInputDispatcher delegates primary action without mutating selection", () => {
    const state = new BoardPresentationState();
    const calls = [];
    const dispatcher = new BoardInputDispatcher({
        presentationState: state,
        handlers: {
            primaryCellAction(payload) {
                calls.push(payload.cell);
                return { success: true };
            }
        }
    });

    const result = dispatcher.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
        { cell: { r: 1, c: 1 } }
    ));

    assert.equal(result.success, true);
    assert.deepEqual(calls, [{ r: 1, c: 1 }]);
    assert.equal(state.snapshot().selectedCell, null);
});

test("legacy Web 2D Trial input preserves explicit route identity", () => {
    const calls = [];
    const adapter = new LegacyWeb2DBoardInputAdapter({
        isTrialInteractionActive: () => true,
        getActiveTrialRoute: () => ({ id: "route-a" }),
        selectTrialInterceptionCell(r, c) { calls.push({ r, c }); return true; }
    });
    const rejected = adapter.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
        { routeId: "route-b", cell: { r: 0, c: 0 } }
    ));
    const accepted = adapter.dispatch(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
        { routeId: "route-a", cell: { r: 0, c: 1 } }
    ));

    assert.equal(rejected.success, false);
    assert.equal(rejected.reason, "TRIAL_ROUTE_NOT_ACTIVE");
    assert.equal(accepted.success, true);
    assert.deepEqual(calls, [{ r: 0, c: 1 }]);
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
    assert.deepEqual(runtimeDto.resources.defense, { current: 5, max: 5 });
    assert.deepEqual(runtimeDto.resources.mystic, { current: 4 });
    const serialized = JSON.stringify(runtimeDto);
    for (const forbidden of ["grid", "mergedBlocks", "mergeLinks", "directiveSystem", "document", "window", "GameObject", "Transform"]) {
        assert.equal(serialized.includes(forbidden), false, `runtime snapshot leaked internal field: ${forbidden}`);
    }
});

console.log(`\n✅ Portable board presentation / Unity boundary: ${passed}/${passed} tests passed`);
