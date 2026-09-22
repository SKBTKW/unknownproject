import assert from "node:assert/strict";
import fs from "node:fs";
import { attachTrialRouteBoardSelection } from "../game/src/ui/trial_route_board_selection_bridge.js";
import { BOARD_INPUT_COMMANDS } from "../game/src/presentation/board_input_contract.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const indexHtml = read("../game/index.html");
const routeCss = read("../game/css/2_center_area/trial_route_board_selection.css");

function makeClassList(initial = []) {
    const values = new Set(initial);
    return {
        add: (...names) => names.forEach(name => values.add(name)),
        remove: (...names) => names.forEach(name => values.delete(name)),
        contains: name => values.has(name),
        toggle: (name, force) => {
            if (force === undefined) {
                if (values.has(name)) { values.delete(name); return false; }
                values.add(name); return true;
            }
            if (force) values.add(name); else values.delete(name);
            return Boolean(force);
        }
    };
}

function makeCell(r, c) {
    return {
        r, c,
        children: [],
        attributes: {},
        classList: makeClassList(["cell"]),
        setAttribute(name, value) { this.attributes[name] = String(value); },
        removeAttribute(name) { delete this.attributes[name]; },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        }
    };
}

const cells = new Map([
    ["0,0", makeCell(0, 0)],
    ["0,1", makeCell(0, 1)]
]);

const boardEl = {
    querySelectorAll(selector) {
        if (selector === ".trial-route-entry-selector") {
            return Array.from(cells.values()).flatMap(cell =>
                cell.children.filter(child => String(child.className).includes("trial-route-entry-selector"))
            );
        }
        if (selector === ".cell.is-trial-route-selector-host") {
            return Array.from(cells.values()).filter(cell =>
                cell.classList.contains("is-trial-route-selector-host")
            );
        }
        return [];
    },
    querySelector(selector) {
        const match = selector.match(/data-r="(\d+)"\]\[data-c="(\d+)"/);
        return match ? cells.get(`${match[1]},${match[2]}`) || null : null;
    }
};

const bodyClassList = makeClassList();
globalThis.document = {
    body: { classList: bodyClassList },
    getElementById: id => id === "gridBoard" ? boardEl : null,
    createElement: () => ({
        dataset: {},
        attributes: {},
        className: "",
        textContent: "",
        setAttribute(name, value) { this.attributes[name] = String(value); },
        remove() {
            this.removed = true;
            if (!this.parentNode) return;
            this.parentNode.children = this.parentNode.children.filter(child => child !== this);
            this.parentNode = null;
        }
    })
};

const routes = [
    { id: "route-a", nameKey: "ROUTE_A", cells: [{ r: 0, c: 0 }] },
    { id: "route-b", nameKey: "ROUTE_B", cells: [{ r: 0, c: 1 }] }
];
const commands = [];
let acknowledged = 0;
let planActivated = false;
const ui = {
    isTrialInteractionActive: () => true,
    isTrialRouteSelectionEnabled: () => !planActivated,
    boardPresentationState: { contextMode: "TRIAL", viewMode: "2D" },
    getTrialPlanningRoutes: () => routes,
    getActiveTrialRoute: () => routes[0],
    boardPresentationRuntimeBridge: { dispatchInput: command => commands.push(command) },
    acknowledgeFirstRunTrialRoute: () => { acknowledged += 1; },
    render: () => {},
    selectTrialRoute: () => { throw new Error("fallback route selection should not be used when input runtime is attached"); }
};

const bridge = attachTrialRouteBoardSelection(ui);
assert.ok(bridge, "Board route selection bridge attaches");
assert.ok(bodyClassList.contains("trial-route-selection-on-board"), "Trial route board mode is projected to the body");
assert.strictEqual(cells.get("0,0").children.length, 1, "active route entry gets one board marker");
assert.strictEqual(cells.get("0,1").children.length, 1, "inactive route entry gets one board marker");
assert.ok(cells.get("0,0").children[0].className.includes("is-active"), "active route marker is visually identified");

let prevented = false;
let stopped = false;
cells.get("0,1").children[0].onclick({
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; }
});
assert.strictEqual(prevented, true, "route marker prevents default browser action");
assert.strictEqual(stopped, true, "route marker click does not leak into interception-cell selection");
assert.strictEqual(acknowledged, 1, "first-run route tutorial acknowledgement follows the real click path");
assert.strictEqual(commands.length, 1, "route click dispatches exactly one board input command");
assert.strictEqual(commands[0].type, BOARD_INPUT_COMMANDS.SELECT_TRIAL_ROUTE);
assert.deepStrictEqual(commands[0].payload, { routeId: "route-b" });

planActivated = true;
bridge.sync();
assert.strictEqual(cells.get("0,0").children.length, 0, "activated plan removes 2D route selectors");
assert.strictEqual(cells.get("0,1").children.length, 0, "activated plan removes inactive 2D route selectors");
assert.strictEqual(
    bodyClassList.contains("trial-route-selection-on-board"),
    false,
    "activated plan exits route-selection board mode"
);

assert.ok(indexHtml.includes("trial_route_board_selection.css"), "Board route selector stylesheet is loaded");
assert.ok(routeCss.includes(".trial-route-entry-selector"), "Board route selector has dedicated presentation styles");

delete globalThis.document;
console.log("Trial Board route selection behavior contract: PASS");
