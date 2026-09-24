import assert from "node:assert/strict";
import fs from "node:fs";
import {
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_MODES,
    BoardPresentationState
} from "../game/src/presentation/board_presentation_state.js";
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from "../game/src/presentation/board_input_contract.js";
import {
    BOARD_POINTER_ACTIONS,
    resolveBoardPointerCommand
} from "../game/src/presentation/board_input_semantic_resolver.js";
import { Web25DPhaseFRenderer } from "../game/src/presentation/web25d_phase_f_renderer.js";
import { resolveWeb25DTrialRouteSelectors } from "../game/src/presentation/web25d_trial_overlay_renderer.js";
import { attachBoardPresentationRuntime } from "../game/src/ui/board_presentation_runtime_bridge.js";
import { attachTrialRouteBoardSelection } from "../game/src/ui/trial_route_board_selection_bridge.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
}

console.log("\n--- 2D / 2.5D Board Input Semantics Contract Tests ---");

test("Web2D and Web2.5D wiring both consume the shared input boundary", () => {
    const gridSource = read("../game/src/ui/board_presentation_grid_component.js");
    const runtimeSource = read("../game/src/ui/web25d_board_runtime_bridge.js");
    assert.equal(gridSource.includes("resolveBoardPointerCommand"), true);
    assert.equal(gridSource.includes("boardPresentationRuntimeBridge"), true);
    assert.equal(runtimeSource.includes("boardPresentationRuntimeBridge"), true);
    assert.equal(runtimeSource.includes("new BoardRendererBridge"), false);
});

test("Phase F no longer owns duplicate Trial click or hover routing", () => {
    const source = read("../game/src/presentation/web25d_phase_f_renderer.js");
    assert.equal(source.includes("SELECT_TRIAL_INTERCEPTION"), false);
    assert.equal(source.includes("HOVER_TRIAL_INTERCEPTION"), false);
    assert.equal(source.includes("previousRouteId"), true);
});

test("Trial route markers compare the actual 2D enum value, not the enum key name", () => {
    const source = read("../game/src/ui/trial_route_board_selection_bridge.js");
    assert.equal(source.includes("BOARD_VIEW_MODES.TWO_D"), true);
    assert.equal(source.includes('=== "STRATEGIC_2D"'), false);
});

const normalReadModel = {
    presentation: { contextMode: BOARD_CONTEXT_MODES.NORMAL },
    trial: { activeRouteId: null },
    cells: [[{
        trial: {
            route: null,
            interceptionCandidate: null
        }
    }]]
};

const legalTrialReadModel = {
    presentation: { contextMode: BOARD_CONTEXT_MODES.TRIAL },
    trial: { activeRouteId: "route-a" },
    cells: [[{
        trial: {
            route: { routeId: "route-a" },
            interceptionCandidate: { canIntercept: true }
        }
    }]]
};

const blockedTrialReadModel = {
    presentation: { contextMode: BOARD_CONTEXT_MODES.TRIAL },
    trial: { activeRouteId: "route-a" },
    cells: [[{
        trial: {
            route: { routeId: "route-a" },
            interceptionCandidate: {
                canIntercept: false,
                reason: "BLOCK_ALREADY_PLANNED"
            }
        }
    }]]
};

test("shared resolver maps NORMAL click and hover to portable logical commands", () => {
    const click = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.CLICK,
        { readModel: normalReadModel, cell: { r: 0, c: 0 } }
    );
    const hover = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.HOVER,
        { readModel: normalReadModel, cell: { r: 0, c: 0 } }
    );
    assert.equal(click.type, BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION);
    assert.deepEqual(click.payload.cell, { r: 0, c: 0 });
    assert.equal(hover.type, BOARD_INPUT_COMMANDS.HOVER_CELL);
    assert.deepEqual(hover.payload.cell, { r: 0, c: 0 });
});

test("shared resolver maps legal Trial target to route-scoped commands", () => {
    const click = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.CLICK,
        { readModel: legalTrialReadModel, cell: { r: 0, c: 0 } }
    );
    const hover = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.HOVER,
        { readModel: legalTrialReadModel, cell: { r: 0, c: 0 } }
    );
    assert.equal(click.type, BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION);
    assert.equal(click.payload.routeId, "route-a");
    assert.equal(hover.type, BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION);
    assert.equal(hover.payload.routeId, "route-a");
});

test("blocked Trial target is never selectable and hover clears Trial preview", () => {
    const click = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.CLICK,
        { readModel: blockedTrialReadModel, cell: { r: 0, c: 0 } }
    );
    const hover = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.HOVER,
        { readModel: blockedTrialReadModel, cell: { r: 0, c: 0 } }
    );
    assert.equal(click, null);
    assert.equal(hover.type, BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER);
});

test("leave command follows presentation context without renderer coordinates", () => {
    const normalLeave = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.LEAVE,
        { readModel: normalReadModel }
    );
    const trialLeave = resolveBoardPointerCommand(
        BOARD_POINTER_ACTIONS.LEAVE,
        { readModel: legalTrialReadModel }
    );
    assert.equal(normalLeave.type, BOARD_INPUT_COMMANDS.CLEAR_HOVER);
    assert.equal(trialLeave.type, BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER);
    const serialized = JSON.stringify([normalLeave, trialLeave]);
    assert.equal(serialized.includes("screen"), false);
    assert.equal(serialized.includes("world"), false);
    assert.equal(serialized.includes("clientX"), false);
});

test("Browser runtime keeps SELECT_CELL presentation-only", () => {
    const calls = [];
    const ui = {
        boardPresentationState: new BoardPresentationState(),
        isTrialInteractionActive: () => false,
        performPrimaryCellAction(r, c) {
            calls.push(["performPrimaryCellAction", r, c]);
            return true;
        }
    };
    const runtime = attachBoardPresentationRuntime(ui);
    const result = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_CELL,
        { cell: { r: 2, c: 3 } }
    ));
    assert.equal(result.success, true);
    assert.deepEqual(ui.boardPresentationState.selectedCell, { r: 2, c: 3 });
    assert.deepEqual(calls, []);
});

test("Browser runtime delegates PRIMARY_CELL_ACTION without mutating selection", () => {
    const calls = [];
    const ui = {
        boardPresentationState: new BoardPresentationState(),
        isTrialInteractionActive: () => false,
        performPrimaryCellAction(r, c) {
            calls.push(["performPrimaryCellAction", r, c]);
            return true;
        }
    };
    const runtime = attachBoardPresentationRuntime(ui);
    const result = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
        { cell: { r: 1, c: 4 } }
    ));
    assert.equal(result.success, true);
    assert.equal(ui.boardPresentationState.selectedCell, null);
    assert.deepEqual(calls, [["performPrimaryCellAction", 1, 4]]);
});

test("Browser runtime rejects normal board mutation while a live Trial is active", () => {
    const state = new BoardPresentationState({ selectedCell: { r: 1, c: 1 } });
    const ui = {
        boardPresentationState: state,
        isTrialInteractionActive: () => true,
        performPrimaryCellAction() {
            throw new Error("NORMAL_CLICK_MUST_NOT_REACH_GAMEPLAY");
        }
    };
    const runtime = attachBoardPresentationRuntime(ui);
    const selection = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_CELL,
        { cell: { r: 4, c: 4 } }
    ));
    const primary = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.PRIMARY_CELL_ACTION,
        { cell: { r: 4, c: 4 } }
    ));
    assert.equal(selection.success, false);
    assert.equal(selection.reason, "LIVE_TRIAL_REQUIRES_TRIAL_COMMAND");
    assert.equal(primary.success, false);
    assert.equal(primary.reason, "LIVE_TRIAL_REQUIRES_TRIAL_COMMAND");
    assert.deepEqual(state.selectedCell, { r: 1, c: 1 });
});

test("Browser runtime rejects stale route-scoped Trial commands", () => {
    const calls = [];
    const ui = {
        boardPresentationState: new BoardPresentationState({
            contextMode: BOARD_CONTEXT_MODES.TRIAL
        }),
        isTrialInteractionActive: () => true,
        getActiveTrialRoute: () => ({ id: "route-a" }),
        selectTrialInterceptionCell(r, c) {
            calls.push([r, c]);
            return true;
        }
    };
    const runtime = attachBoardPresentationRuntime(ui);
    const stale = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
        { routeId: "route-b", cell: { r: 0, c: 0 } }
    ));
    const current = runtime.dispatchInput(createBoardInputCommand(
        BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION,
        { routeId: "route-a", cell: { r: 0, c: 1 } }
    ));
    assert.equal(stale.success, false);
    assert.equal(stale.reason, "TRIAL_ROUTE_NOT_ACTIVE");
    assert.equal(current.success, true);
    assert.deepEqual(calls, [[0, 1]]);
});

test("2.5D renderer uses the shared resolver for legal and blocked Trial cells", () => {
    const commands = [];
    const bridge = {
        dispatch(command) {
            commands.push(command);
            return { success: true };
        }
    };
    const canvas = {
        width: 600,
        height: 600,
        getContext: () => ({
            clearRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            fill() {},
            stroke() {},
            fillText() {},
            arc() {}
        }),
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 })
    };

    const renderer = new Web25DPhaseFRenderer({ canvas, bridge });
    renderer.render = () => {};
    renderer.getLogicalCellAtCanvasPoint = () => ({ r: 0, c: 0 });
    renderer.getCanvasPointFromEvent = () => ({ x: 10, y: 10 });

    renderer.setReadModel({
        ...legalTrialReadModel,
        board: { rows: 1, columns: 1 }
    });
    renderer.handleClick({});
    assert.equal(commands.at(-1).type, BOARD_INPUT_COMMANDS.SELECT_TRIAL_INTERCEPTION);

    commands.length = 0;
    renderer.lastPointerCell = null;
    renderer.setReadModel({
        ...blockedTrialReadModel,
        board: { rows: 1, columns: 1 }
    });
    const blockedClick = renderer.handleClick({});
    assert.equal(blockedClick, null);
    assert.equal(commands.length, 0);

    renderer.handlePointerMove({});
    assert.equal(commands.at(-1).type, BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER);
});

test("2.5D Trial route selector dispatches SELECT_TRIAL_ROUTE before interception hit testing", () => {
    const commands = [];
    const bridge = {
        dispatch(command) {
            commands.push(command);
            return { success: true };
        }
    };
    const canvas = {
        width: 600,
        height: 600,
        getContext: () => ({
            clearRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            fill() {},
            stroke() {},
            fillText() {},
            arc() {}
        }),
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 })
    };
    const readModel = {
        presentation: { contextMode: BOARD_CONTEXT_MODES.TRIAL },
        board: { rows: 2, columns: 2 },
        cells: [
            [
                { r: 0, c: 0, elevation: 0, placed: true, trial: { interceptionCandidate: { canIntercept: true }, route: { routeId: "route-a" } } },
                { r: 0, c: 1, elevation: 0, placed: true, trial: { interceptionCandidate: null, route: null } }
            ],
            [
                { r: 1, c: 0, elevation: 0, placed: true, trial: { interceptionCandidate: null, route: null } },
                { r: 1, c: 1, elevation: 0, placed: true, trial: { interceptionCandidate: { canIntercept: true }, route: { routeId: "route-b" } } }
            ]
        ],
        trial: {
            available: true,
            activeRouteId: "route-a",
            routes: [
                {
                    routeId: "route-a",
                    entryCell: { r: 0, c: 0 },
                    entrySide: "north",
                    cells: [{ r: 0, c: 0 }]
                },
                {
                    routeId: "route-b",
                    entryCell: { r: 1, c: 1 },
                    entrySide: "south",
                    cells: [{ r: 1, c: 1 }]
                }
            ],
            interceptionCandidates: []
        }
    };

    const renderer = new Web25DPhaseFRenderer({ canvas, bridge });
    renderer.render = () => {};
    renderer.setReadModel(readModel);

    const selectors = resolveWeb25DTrialRouteSelectors({
        projection: renderer.projection,
        readModel
    });
    const inactive = selectors.find(item => item.routeId === "route-b");
    const active = selectors.find(item => item.routeId === "route-a");

    renderer.getCanvasPointFromEvent = () => inactive.center;
    renderer.getLogicalCellAtCanvasPoint = () => {
        throw new Error("route selector hit must take priority over cell interception hit testing");
    };
    renderer.handleClick({});
    assert.equal(commands.length, 1);
    assert.equal(commands[0].type, BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE);
    assert.equal(commands[0].payload.routeId, "route-b");

    commands.length = 0;
    renderer.getCanvasPointFromEvent = () => active.center;
    renderer.handleClick({});
    assert.equal(commands.length, 0, "active route selector consumes click without redispatching selection");
});

test("2.5D pointer dedupe resets when active Trial route changes", () => {
    const canvas = {
        width: 600,
        height: 600,
        getContext: () => ({
            clearRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            fill() {},
            stroke() {},
            fillText() {},
            arc() {}
        }),
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 })
    };
    const renderer = new Web25DPhaseFRenderer({
        canvas,
        bridge: { dispatch: () => ({ success: true }) }
    });
    renderer.render = () => {};
    renderer.setReadModel({
        ...legalTrialReadModel,
        board: { rows: 1, columns: 1 }
    });
    renderer.lastPointerCell = { r: 0, c: 0 };
    renderer.setReadModel({
        ...legalTrialReadModel,
        trial: { activeRouteId: "route-b" },
        board: { rows: 1, columns: 1 }
    });
    assert.equal(renderer.lastPointerCell, null);
});

class FakeClassList {
    constructor() {
        this.values = new Set();
    }
    add(...items) {
        items.forEach(item => this.values.add(item));
    }
    remove(...items) {
        items.forEach(item => this.values.delete(item));
    }
    contains(item) {
        return this.values.has(item);
    }
    toggle(item, force) {
        const next = force === undefined ? !this.values.has(item) : Boolean(force);
        if (next) this.values.add(item);
        else this.values.delete(item);
        return next;
    }
}

class FakeMarker {
    constructor() {
        this.dataset = {};
        this.className = "";
        this.attrs = new Map();
        this.parentNode = null;
        this.onclick = null;
    }
    setAttribute(name, value) {
        this.attrs.set(name, String(value));
    }
    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(item => item !== this);
        this.parentNode = null;
    }
}

class FakeCell {
    constructor(r, c) {
        this.r = r;
        this.c = c;
        this.classList = new FakeClassList();
        this.attrs = new Map();
        this.children = [];
    }
    setAttribute(name, value) {
        this.attrs.set(name, String(value));
    }
    removeAttribute(name) {
        this.attrs.delete(name);
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
    }
}

test("2D Trial route marker is shown for actual 2D mode and emits SELECT_TRIAL_ROUTE", () => {
    const originalDocument = globalThis.document;
    const cell = new FakeCell(0, 0);
    const bodyClassList = new FakeClassList();

    const boardEl = {
        querySelector(selector) {
            const match = selector.match(/data-r="(\d+)"\]\[data-c="(\d+)"/);
            if (!match) return null;
            return Number(match[1]) === cell.r && Number(match[2]) === cell.c ? cell : null;
        },
        querySelectorAll(selector) {
            if (selector === ".trial-route-entry-selector") {
                return cell.children.filter(child => child.className.includes("trial-route-entry-selector"));
            }
            if (selector === ".cell.is-trial-route-selector-host") {
                return cell.classList.contains("is-trial-route-selector-host") ? [cell] : [];
            }
            return [];
        }
    };

    globalThis.document = {
        body: { classList: bodyClassList },
        getElementById(id) {
            return id === "gridBoard" ? boardEl : null;
        },
        createElement() {
            return new FakeMarker();
        }
    };

    const commands = [];
    const ui = {
        boardPresentationState: {
            contextMode: BOARD_CONTEXT_MODES.TRIAL,
            viewMode: BOARD_VIEW_MODES.TWO_D
        },
        isTrialInteractionActive: () => true,
        getTrialPlanningRoutes: () => [{
            id: "route-a",
            cells: [{ r: 0, c: 0 }]
        }],
        getActiveTrialRoute: () => ({ id: "route-b" }),
        boardPresentationRuntimeBridge: {
            dispatchInput(command) {
                commands.push(command);
                return { success: true };
            }
        }
    };

    try {
        const bridge = attachTrialRouteBoardSelection(ui);
        assert.equal(cell.children.length, 1);
        assert.equal(cell.children[0].dataset.routeId, "route-a");
        assert.equal(bodyClassList.contains("trial-route-selection-on-board"), true);

        cell.children[0].onclick({
            preventDefault() {},
            stopPropagation() {}
        });
        assert.equal(commands.length, 1);
        assert.equal(commands[0].type, BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE);
        assert.equal(commands[0].payload.routeId, "route-a");

        ui.boardPresentationState.viewMode = BOARD_VIEW_MODES.TWO_POINT_FIVE_D;
        bridge.sync();
        assert.equal(cell.children.length, 0);
        assert.equal(bodyClassList.contains("trial-route-selection-on-board"), false);
    } finally {
        globalThis.document = originalDocument;
    }
});

console.log(`\n2D / 2.5D input semantics tests passed: ${passed}/${passed}`);
