import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialPlanningDraftService
} from "../game/src/app.js";
import { I18n } from "../game/src/i18n.js";

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log("  ✅ " + name);
}

// Lightweight DOM mock for UIController and TrialDefenseAllocationComponent
class MockElement {
    constructor(id = "", className = "", tagName = "div") {
        this._id = id;
        if (id) elementRegistry.set(id, this);
        this._classes = new Set();
        if (className) String(className).split(" ").filter(Boolean).forEach(c => this._classes.add(c));
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.onclick = null;
        this.oninput = null;
        this.disabled = false;
        this._innerHTML = "";
        this._innerText = "";

        const self = this;
        this.classList = {
            add: (...cls) => cls.forEach(c => self._classes.add(c)),
            remove: (...cls) => cls.forEach(c => self._classes.delete(c)),
            contains: (c) => self._classes.has(c),
            toggle: (c, force) => {
                if (force === true) { self._classes.add(c); return true; }
                if (force === false) { self._classes.delete(c); return false; }
                if (self._classes.has(c)) { self._classes.delete(c); return false; }
                self._classes.add(c); return true;
            }
        };
    }

    get id() { return this._id || ""; }
    set id(v) {
        this._id = String(v);
        if (this._id) elementRegistry.set(this._id, this);
    }

    get className() { return Array.from(this._classes).join(" "); }
    set className(v) {
        this._classes.clear();
        if (v) String(v).split(" ").filter(Boolean).forEach(c => this._classes.add(c));
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
        this._innerHTML = String(html);
        this.children = [];
        const tagRegex = /<([a-z0-9]+)([^>]*)>/gi;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1];
            const attrs = match[2];
            const idMatch = attrs.match(/id=["']([^"']+)["']/i);
            const classMatch = attrs.match(/class=["']([^"']+)["']/i);
            const routeIdMatch = attrs.match(/data-route-id=["']([^"']+)["']/i);
            const disabledMatch = attrs.includes("disabled");

            const child = new MockElement(idMatch ? idMatch[1] : "", classMatch ? classMatch[1] : "", tagName);
            if (routeIdMatch) child.setAttribute("data-route-id", routeIdMatch[1]);
            if (disabledMatch) child.disabled = true;
            this.children.push(child);
            if (child.id) elementRegistry.set(child.id, child);
        }
    }

    get innerText() { return this._innerText; }
    set innerText(v) { this._innerText = String(v); }

    setAttribute(k, v) { this.attributes[k] = String(v); if (k === "disabled") this.disabled = true; }
    getAttribute(k) { return this.attributes[k]; }
    removeAttribute(k) { delete this.attributes[k]; if (k === "disabled") this.disabled = false; }
    appendChild(el) { if (el) this.children.push(el); return el; }
    removeChild(el) { this.children = this.children.filter(c => c !== el); return el; }
    hasChildNodes() { return this.children.length > 0; }

    querySelector(sel) {
        if (sel.startsWith("#")) {
            const id = sel.slice(1);
            return elementRegistry.get(id) || null;
        }
        if (sel.startsWith(".")) {
            const cls = sel.slice(1);
            for (const c of this.children) {
                if (c.classList.contains(cls)) return c;
            }
        }
        return null;
    }

    querySelectorAll(sel) {
        const results = [];
        if (sel.startsWith(".")) {
            const cls = sel.slice(1);
            for (const c of this.children) {
                if (c.classList.contains(cls)) results.push(c);
            }
        }
        return results;
    }
}

const elementRegistry = new Map();
const mockHead = new MockElement("head", "", "head");
const mockBody = new MockElement("body", "", "body");
elementRegistry.set("head", mockHead);
elementRegistry.set("body", mockBody);

const mockDoc = {
    getElementById: (id) => elementRegistry.get(id) || null,
    createElement: (tag) => {
        const el = new MockElement("", "", tag);
        return el;
    },
    querySelectorAll: () => [],
    querySelector: (sel) => {
        if (sel.startsWith("#")) return elementRegistry.get(sel.slice(1)) || null;
        return null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    head: mockHead,
    body: mockBody
};

globalThis.document = mockDoc;
globalThis.window = {
    __TOA_DEV_MODE__: true,
    location: { search: "?dev=1" },
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {},
    document: mockDoc,
    I18n
};

console.log("⚔️ Starting Phase 2.7C-D Route Decision UI Tests (A through T)...\n");

const engine = GameEngine.createGame();
const ui = new UIController(engine);

// Start the 3-route dev trial scenario
const startRes = ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
assert.equal(startRes.success, true, "Development Trial Preview harness should start successfully");

const root = document.getElementById("trialDefenseAllocationRoot");
assert.ok(root, "trialDefenseAllocationRoot should be mounted");

// A. route一覧がPlanning順で表示される
test("A. route一覧がPlanning順で表示される", () => {
    const routes = ui.getTrialPlanningRoutes();
    assert.equal(routes.length, 3, "Should have 3 routes");
    assert.equal(routes[0].id, "TERRAIN_COMPARE_ROUTE");
    assert.equal(routes[1].id, "TERRAIN_COMPARE_ROUTE_EAST");
    assert.equal(routes[2].id, "TERRAIN_COMPARE_ROUTE_SOUTH");
});

// B. Commander routeが先頭
test("B. Commander routeが先頭", () => {
    const routes = ui.getTrialPlanningRoutes();
    assert.equal(routes[0].isCommanderRoute, true, "First route must be Commander route");
    assert.equal(routes[1].isCommanderRoute, false);
    assert.equal(routes[2].isCommanderRoute, false);
});

// C. routeクリックでactive route変更
test("C. routeクリックでactive route変更", () => {
    assert.equal(ui.getActiveTrialRoute().id, "TERRAIN_COMPARE_ROUTE");
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    assert.equal(ui.getActiveTrialRoute().id, "TERRAIN_COMPARE_ROUTE_EAST");
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    assert.equal(ui.getActiveTrialRoute().id, "TERRAIN_COMPARE_ROUTE");
});

// D. UNDECIDED route選択時に初期UI状態が正しい
test("D. UNDECIDED route選択時に初期UI状態が正しい", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_SOUTH");
    const decision = ui.trialPresentationState.getRouteDecision("TERRAIN_COMPARE_ROUTE_SOUTH");
    assert.equal(decision.status, "UNDECIDED");
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);
});

// E. 既存INTERCEPT routeを開くと cell/allocationが復元される
test("E. 既存INTERCEPT routeを開くと cell/allocationが復元される", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(6);
    const interceptRes = ui.setTrialActiveRouteIntercept();
    assert.equal(interceptRes.success, true);

    // Switch to another route
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);

    // Switch back
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 2, c: 1 });
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 6);
});

// F. 既存SKIP routeを開くと cellなし/allocation 0
test("F. 既存SKIP routeを開くと cellなし/allocation 0", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    const skipRes = ui.setTrialActiveRouteSkip();
    assert.equal(skipRes.success, true);
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);

    // Switch away and back
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);
});

// G. 合法cell + allocation>=1 → 「迎撃指定」成功
test("G. 合法cell + allocation>=1 → 「迎撃指定」成功", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_SOUTH");
    const ok = ui.selectTrialInterceptionCell(1, 3);
    assert.equal(ok, true);
    ui.setTrialDefenseAllocation(4);
    const res = ui.setTrialActiveRouteIntercept();
    assert.equal(res.success, true);
});

// H. Draft成功後status = INTERCEPT
test("H. Draft成功後status = INTERCEPT", () => {
    const decision = ui.trialPresentationState.getRouteDecision("TERRAIN_COMPARE_ROUTE_SOUTH");
    assert.equal(decision.status, "INTERCEPT");
    assert.deepEqual(decision.interceptCell, { r: 1, c: 3 });
    assert.equal(decision.defenseAllocation, 4);
});

// I. Draft成功後planned overlay表示
test("I. Draft成功後planned overlay表示", () => {
    const cellState = ui.getTrialInterceptionCellState(1, 3);
    assert.equal(cellState.isPlanned, true);
    assert.equal(cellState.isPlannedActive, true);
});

// J. SKIP成功
test("J. SKIP成功", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_SOUTH");
    const res = ui.setTrialActiveRouteSkip();
    assert.equal(res.success, true);
    const decision = ui.trialPresentationState.getRouteDecision("TERRAIN_COMPARE_ROUTE_SOUTH");
    assert.equal(decision.status, "SKIP");
    assert.equal(decision.defenseAllocation, 0);
});

// K. INTERCEPT→SKIPでplanned defenseが解放される
test("K. INTERCEPT→SKIPでplanned defenseが解放される", () => {
    // Only Commander route has 6 allocated now
    assert.equal(ui.getTrialPlannedDefenseTotal(), 6);
    assert.equal(ui.getTrialRemainingDefense(), 14); // 20 - 6 = 14
});

// L. clearでUNDECIDEDへ戻る
test("L. clearでUNDECIDEDへ戻る", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    const res = ui.clearTrialActiveRouteDecision();
    assert.equal(res.success, true);
    const decision = ui.trialPresentationState.getRouteDecision("TERRAIN_COMPARE_ROUTE");
    assert.equal(decision.status, "UNDECIDED");
    assert.equal(ui.getTrialPlannedDefenseTotal(), 0);
    assert.equal(ui.getTrialRemainingDefense(), 20);
});

// M. Draft編集時GameFact 0
test("M. Draft編集時GameFact 0", () => {
    const hub = ui.trialController.gameFactHub;
    assert.equal(hub.facts.length, 0, "No GameFact must be emitted during Draft operations");
});

// N. 他route使用済みblockが選択不可
test("N. 他route使用済みblockが選択不可", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(5);
    ui.setTrialActiveRouteIntercept();

    assert.equal(ui.trialPresentationState.isBlockPlannedByOtherRoute("TERRAIN_COMPARE_ROUTE_EAST", "placement:block_2_1"), true);
});

// O. 他route使用済みblockが盤面上から消えない
test("O. 他route使用済みblockが盤面上から消えない", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    const state = ui.getTrialInterceptionCellState(1, 2);
    assert.equal(state.onRoute, true);
});

// P. unfavorable合法cellは選択可能
test("P. unfavorable合法cellは選択可能", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE");
    const cellState = ui.getTrialInterceptionCellState(2, 1);
    assert.equal(cellState.onRoute, true);
    assert.equal(cellState.canIntercept, true, "Forest with deployment limit must remain selectable as intercept candidate");
    const ok = ui.selectTrialInterceptionCell(2, 1);
    assert.equal(ok, true);
});

// Q. Preview 0🛡維持
test("Q. Preview 0🛡維持", () => {
    const alloc = ui.setTrialDefenseAllocation(0);
    assert.equal(alloc, 0);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);
});

// R. INTERCEPT 0🛡は保存不可
test("R. INTERCEPT 0🛡は保存不可", () => {
    ui.setTrialDefenseAllocation(0);
    const res = ui.setTrialActiveRouteIntercept();
    assert.equal(res.success, false);
    assert.equal(res.reason, "INVALID_DEFENSE_ALLOCATION");
});

// S. route切替で別route一時selectionが混入しない
test("S. route切替で別route一時selectionが混入しない", () => {
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    ui.selectTrialInterceptionCell(2, 2);
    ui.setTrialDefenseAllocation(3);
    // Switch away without setting intercept
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_SOUTH");
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);
});

// T. planned total / remaining defenseがService値と一致
test("T. planned total / remaining defenseがService値と一致", () => {
    const svcTotal = TrialPlanningDraftService.getPlannedDefenseTotal(ui.trialPresentationState.routePlanDrafts);
    const svcRemaining = TrialPlanningDraftService.getRemainingDefense(ui.trialPresentationState.routePlanDrafts, 20);
    assert.equal(ui.getTrialPlannedDefenseTotal(), svcTotal);
    assert.equal(ui.getTrialRemainingDefense(), svcRemaining);
});

ui.stopDevelopmentTrialPreview();
console.log(`\n🎉 All ${passed}/${passed} Phase 2.7C-D Route Decision UI tests PASSED!\n`);
