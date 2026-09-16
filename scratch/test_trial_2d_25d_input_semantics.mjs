import assert from "node:assert/strict";
import fs from "node:fs";
import { Web25DPhaseFRenderer } from "../game/src/presentation/web25d_phase_f_renderer.js";
import { BOARD_INPUT_COMMANDS } from "../game/src/presentation/board_input_contract.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const phaseFRendererSource = read("../game/src/presentation/web25d_phase_f_renderer.js");
const runtimeBridgeSource = read("../game/src/ui/web25d_validation_runtime_bridge.js");
const routeBridgeSource = read("../game/src/ui/trial_route_board_selection_bridge.js");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- 2D / 2.5D Trial Input Semantics Contract Tests ---");

// Static contract checks
check(phaseFRendererSource.includes("SELECT_TRIAL_INTERCEPTION")
    && phaseFRendererSource.includes("this.readModel?.presentation?.contextMode === 'TRIAL'"),
    "Web25DPhaseFRenderer emits SELECT_TRIAL_INTERCEPTION in TRIAL context");

check(phaseFRendererSource.includes("this.readModel?.cells?.[cell.r]?.[cell.c]")
    && phaseFRendererSource.includes("previousContextMode !== nextContextMode"),
    "Web25DPhaseFRenderer reads Trial semantics from BoardPresentationData and invalidates hover cache on context transition");

check(runtimeBridgeSource.includes("selectTrialInterception")
    && runtimeBridgeSource.includes("selectTrialInterceptionCell"),
    "web25d_validation_runtime_bridge wires selectTrialInterception handler to UIController");

check(runtimeBridgeSource.includes("selectTrialRoute")
    && runtimeBridgeSource.includes("uiController.selectTrialRoute"),
    "web25d_validation_runtime_bridge wires selectTrialRoute handler to UIController");

check(routeBridgeSource.includes('uiController.boardPresentationState?.viewMode === "STRATEGIC_2D"')
    && routeBridgeSource.includes("uiController.isTrialInteractionActive?.()"),
    "trial_route_board_selection_bridge guards DOM route markers to 2D view and isTrialInteractionActive");

// Functional behavior simulation
console.log("\n--- Functional Behavior Simulation ---");

const dispatchedCommands = [];
const mockBridge = {
    dispatch: (command) => {
        dispatchedCommands.push(command);
        return { success: true };
    }
};

const mockCanvas = {
    width: 600,
    height: 600,
    getContext: () => ({
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        arc: () => {}
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 })
};

const renderer = new Web25DPhaseFRenderer({
    canvas: mockCanvas,
    bridge: mockBridge
});
renderer.render = () => {};
renderer.getLogicalCellAtCanvasPoint = () => ({ r: 1, c: 2 });
renderer.getCanvasPointFromEvent = () => ({ x: 100, y: 100 });

const createCells = () => Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => ({
        r,
        c,
        placed: false,
        interaction: { selected: false, hovered: false, focused: false }
    }))
);

// 1. Peace time click in 2.5D
const peaceCells = createCells();
dispatchedCommands.length = 0;
renderer.setReadModel({
    presentation: { contextMode: "NORMAL", viewMode: "WORLD_2_5D" },
    board: { rows: 5, columns: 5 },
    cells: peaceCells
});

renderer.handleClick({});
check(dispatchedCommands.length === 1, "Click dispatched 1 command");
check(dispatchedCommands[0].type === BOARD_INPUT_COMMANDS.SELECT_CELL,
    "Peace time click in 2.5D dispatches SELECT_CELL");
check(dispatchedCommands[0].payload.cell.r === 1 && dispatchedCommands[0].payload.cell.c === 2,
    "Cell coordinates preserved in payload");

// 2. Trial context click in 2.5D - Legal interception candidate
const legalCells = createCells();
legalCells[1][2].trial = {
    interceptionCandidate: { routeId: "route_alpha" },
    route: { routeId: "route_alpha" }
};
renderer.lastPointerCell = { r: 1, c: 2 };
dispatchedCommands.length = 0;
renderer.setReadModel({
    presentation: { contextMode: "TRIAL", viewMode: "WORLD_2_5D" },
    trial: { activeRouteId: "route_alpha" },
    board: { rows: 5, columns: 5 },
    cells: legalCells
});
check(renderer.lastPointerCell === null,
    "NORMAL -> TRIAL context transition invalidates same-cell pointer dedupe cache");

const legalResult = renderer.handleClick({});
check(legalResult !== null, "Legal candidate click returns cell");
check(dispatchedCommands.length === 1, "Legal candidate dispatched 1 command");
check(dispatchedCommands[0].type === BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
    "Legal candidate click in 2.5D dispatches SELECT_TRIAL_INTERCEPTION");
check(dispatchedCommands[0].payload.cell.r === 1 && dispatchedCommands[0].payload.cell.c === 2,
    "Cell coordinates preserved in Trial payload");
check(dispatchedCommands[0].payload.routeId === "route_alpha",
    "routeId properly passed in Trial payload");

// 3. Same-cell hover after NORMAL -> TRIAL must dispatch Trial hover semantics.
dispatchedCommands.length = 0;
renderer.handlePointerMove({});
check(dispatchedCommands.length === 1,
    "Same-cell pointer move after NORMAL -> TRIAL is not suppressed");
check(dispatchedCommands[0].type === BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
    "Same-cell pointer move after NORMAL -> TRIAL dispatches HOVER_TRIAL_INTERCEPTION");
check(dispatchedCommands[0].payload.routeId === "route_alpha",
    "Trial hover preserves routeId from BoardPresentationData");

// 4. Trial context click in 2.5D - Illegal / Non-candidate (NOOP)
dispatchedCommands.length = 0;
renderer.getLogicalCellAtCanvasPoint = () => ({ r: 3, c: 3 });
const illegalCells = createCells();
illegalCells[3][3].trial = {
    interceptionCandidate: null,
    route: null
};
renderer.setReadModel({
    presentation: { contextMode: "TRIAL", viewMode: "WORLD_2_5D" },
    trial: { activeRouteId: "route_alpha" },
    board: { rows: 5, columns: 5 },
    cells: illegalCells
});

const illegalResult = renderer.handleClick({});
check(illegalResult === null, "Illegal/non-candidate click returns null (NOOP)");
check(dispatchedCommands.length === 0, "Illegal candidate click dispatches NO command");

// 5. Trial context click in 2.5D - Candidate without routeId (NOOP, no default fallback)
dispatchedCommands.length = 0;
renderer.getLogicalCellAtCanvasPoint = () => ({ r: 1, c: 2 });
const noRouteCells = createCells();
noRouteCells[1][2].trial = {
    interceptionCandidate: true,
    route: null
};
renderer.setReadModel({
    presentation: { contextMode: "TRIAL", viewMode: "WORLD_2_5D" },
    trial: { activeRouteId: null },
    board: { rows: 5, columns: 5 },
    cells: noRouteCells
});

const noRouteResult = renderer.handleClick({});
check(noRouteResult === null, "Candidate without routeId returns null (NOOP, no 'default' fallback)");
check(dispatchedCommands.length === 0, "No routeId click dispatches NO command");

console.log(`\n2D / 2.5D input semantics tests passed: ${passed}/${passed}`);
