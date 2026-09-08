import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialPlanningDraftService,
    TRIAL_PLAN_REASONS,
    GAME_FACT_TYPES
} from "../game/src/app.js";
import { I18n } from "../game/src/i18n.js";

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log("  ✅ " + name);
}

const elementRegistry = new Map();

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

    get innerHTML() {
        if (this.children.length === 0 && this._innerText) return this._innerText;
        return this._innerHTML;
    }
    set innerHTML(html) {
        const unregister = (node) => {
            if (node._id) elementRegistry.delete(node._id);
            for (const c of node.children) unregister(c);
        };
        for (const c of this.children) unregister(c);
        this._innerHTML = String(html);
        this.children = [];
        const tokenRegex = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
        const stack = [this];
        let match;
        const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
        while ((match = tokenRegex.exec(html)) !== null) {
            const full = match[0];
            const tagName = match[1];
            const attrs = match[2];
            const text = match[3];
            if (text) {
                if (stack.length > 0) {
                    stack[stack.length - 1]._innerText += text;
                }
                continue;
            }
            if (full.startsWith("</")) {
                if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tagName.toLowerCase()) {
                    stack.pop();
                }
            } else {
                const idMatch = attrs ? attrs.match(/id=["']([^"']+)["']/i) : null;
                const classMatch = attrs ? attrs.match(/class=["']([^"']+)["']/i) : null;
                const childId = idMatch ? idMatch[1] : "";
                const childClass = classMatch ? classMatch[1] : "";
                const child = new MockElement(childId, childClass, tagName);
                if (attrs) {
                    const routeIdMatch = attrs.match(/data-route-id=["']([^"']+)["']/i);
                    if (routeIdMatch) child.setAttribute("data-route-id", routeIdMatch[1]);
                    if (attrs.includes("disabled")) child.disabled = true;
                }
                if (stack.length > 0) {
                    stack[stack.length - 1].appendChild(child);
                }
                if (!voidTags.has(tagName.toLowerCase()) && !full.endsWith("/>")) {
                    stack.push(child);
                }
            }
        }
    }

    get innerText() { return this._innerText; }
    set innerText(v) { this._innerText = String(v); }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        if (child._id) elementRegistry.delete(child._id);
        return child;
    }

    querySelectorAll(selector) {
        const results = [];
        const match = (el, isRoot = false) => {
            if (!isRoot) {
                if (selector.startsWith(".")) {
                    const cls = selector.slice(1);
                    if (el.classList.contains(cls)) results.push(el);
                } else if (selector.startsWith("#")) {
                    const id = selector.slice(1);
                    if (el.id === id) results.push(el);
                }
            }
            for (const c of el.children) match(c, false);
        };
        match(this, true);
        return results;
    }

    querySelector(selector) {
        const list = this.querySelectorAll(selector);
        return list[0] || null;
    }
}

const mockHead = new MockElement("head", "", "head");
const mockBody = new MockElement("body", "", "body");
const mockDoc = {
    createElement: (tag) => new MockElement("", "", tag),
    getElementById: (id) => elementRegistry.get(id) || null,
    querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
    querySelector: (sel) => mockBody.querySelector(sel),
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

console.log("⚔️ Starting Phase 2.8A Plan Activation Tests (A through AB)...\n");

// Setup environment
const engine = GameEngine.createGame();
const ui = new UIController(engine);

const startRes = ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
assert.equal(startRes.success, true, "Setup: Preview harness started");

const initialDefense = ui.getTrialAvailableDefense();
const routes = ui.getTrialPlanningRoutes();
assert.equal(routes.length, 3, "Setup: 3 routes available");

const r0 = routes[0].id;
const r1 = routes[1].id;
const r2 = routes[2].id;

const emittedFacts = [];
ui.trialController.gameFactHub.subscribe(fact => emittedFacts.push(fact));

// ==========================================
// Phase 1: Failures before plan is confirmed
// ==========================================

// A. confirmed plan無しでactivation拒否
test("A. confirmed plan無しでactivation拒否", () => {
    assert.equal(ui.trialController.state.interceptionPlan, null);
    const res = ui.activateTrialPlan();
    assert.equal(res.success, false);
    assert.ok(res.errors.includes(TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN));
});

// B. activation失敗時defense不変
test("B. activation失敗時defense不変", () => {
    assert.equal(ui.getTrialAvailableDefense(), initialDefense);
    assert.equal(ui.trialController.state.human.availableDefense, initialDefense);
});

// C. activation失敗時queue生成なし
test("C. activation失敗時queue生成なし", () => {
    assert.equal(ui.trialController.state.battleQueue, null);
    assert.equal(ui.getTrialBattleQueue(), null);
    assert.equal(ui.isTrialPlanActivated(), false);
});

// D. activation失敗時GameFact 0
test("D. activation失敗時GameFact 0", () => {
    const activatedFacts = emittedFacts.filter(f => f.type === GAME_FACT_TYPES.TRIAL_PLAN_ACTIVATED);
    assert.equal(activatedFacts.length, 0);
});

// ==========================================
// Setup: Build and Confirm formal plan
// ==========================================
ui.selectTrialRoute(r0);
ui.selectTrialInterceptionCell(2, 1);
ui.setTrialDefenseAllocation(5);
ui.setTrialActiveRouteIntercept();

ui.selectTrialRoute(r1);
ui.setTrialActiveRouteSkip();

ui.selectTrialRoute(r2);
ui.setTrialActiveRouteSkip();

// Proceed through warning and confirm
ui.finishTrialPlanning();
ui.confirmTrialPlanning();

assert.ok(ui.trialController.state.interceptionPlan !== null, "Plan should now be confirmed");
assert.equal(ui.isTrialPlanningConfirmed(), true);
assert.equal(ui.trialController.state.interceptionPlan.totalDefenseAllocated, 5);

// ==========================================
// Phase 2: Successful Activation
// ==========================================

// E. valid formal planでactivation成功
test("E. valid formal planでactivation成功", () => {
    const res = ui.activateTrialPlan();
    assert.equal(res.success, true);
    assert.equal(ui.isTrialPlanActivated(), true);
    assert.equal(ui.trialController.state.planActivated, true);
});

// F. totalDefenseAllocated分だけ実defense減少
test("F. totalDefenseAllocated分だけ実defense減少", () => {
    const expected = initialDefense - 5;
    assert.equal(ui.getTrialAvailableDefense(), expected);
    assert.equal(ui.trialController.state.human.availableDefense, expected);
});

// G. INTERCEPT routeのみqueue化
test("G. INTERCEPT routeのみqueue化", () => {
    const queue = ui.getTrialBattleQueue();
    assert.ok(Array.isArray(queue));
    assert.equal(queue.length, 1);
    assert.equal(queue[0].routeId, r0);
    assert.equal(queue[0].defenseAllocation, 5);
    assert.deepEqual(queue[0].interceptCell, { r: 2, c: 1 });
    assert.equal(queue[0].status, "PENDING");
});

// H. SKIP routeはqueue化しない
test("H. SKIP routeはqueue化しない", () => {
    const queue = ui.getTrialBattleQueue();
    const hasSkip = queue.some(b => b.routeId === r1 || b.routeId === r2);
    assert.equal(hasSkip, false, "SKIP routes must not be in battleQueue");
});

// I. queue順序がformal plan順と一致
test("I. queue順序がformal plan順と一致", () => {
    const queue = ui.getTrialBattleQueue();
    const formalInterceptRoutes = ui.trialController.state.interceptionPlan.routes
        .filter(r => r.status === "INTERCEPT");
    assert.equal(queue.length, formalInterceptRoutes.length);
    for (let i = 0; i < queue.length; i++) {
        assert.equal(queue[i].routeId, formalInterceptRoutes[i].routeId);
    }
});

// J. queue itemが独立snapshot
test("J. queue itemが独立snapshot", () => {
    const queue = ui.getTrialBattleQueue();
    const formalR0 = ui.trialController.state.interceptionPlan.routes.find(r => r.routeId === r0);
    assert.notStrictEqual(queue[0], formalR0, "Queue item must not be identical object reference to formal plan item");
    assert.notStrictEqual(queue[0].interceptCell, formalR0.interceptCell, "interceptCell must be independent clone");
});

// K. formal plan変更がqueueへ波及しない
test("K. formal plan変更がqueueへ波及しない", () => {
    const queue = ui.getTrialBattleQueue();
    const formalR0 = ui.trialController.state.interceptionPlan.routes.find(r => r.routeId === r0);
    const originalQueueAllocation = queue[0].defenseAllocation;
    formalR0.defenseAllocation = 999;
    assert.equal(queue[0].defenseAllocation, originalQueueAllocation, "Queue allocation must remain unchanged");
    formalR0.defenseAllocation = 5; // restore
});

// L. queue変更がformal planへ波及しない
test("L. queue変更がformal planへ波及しない", () => {
    const queue = ui.getTrialBattleQueue();
    const formalR0 = ui.trialController.state.interceptionPlan.routes.find(r => r.routeId === r0);
    queue[0].defenseAllocation = 777;
    assert.equal(formalR0.defenseAllocation, 5, "Formal plan must remain unchanged");
    queue[0].defenseAllocation = 5; // restore
});

// ==========================================
// Phase 3: All-SKIP Plan Activation Test
// ==========================================

// M, N, O: all-SKIP plan test in fresh trial preview
const engineSkip = GameEngine.createGame();
const uiSkip = new UIController(engineSkip);
uiSkip.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
const routesSkip = uiSkip.getTrialPlanningRoutes();
for (const r of routesSkip) {
    uiSkip.selectTrialRoute(r.id);
    uiSkip.setTrialActiveRouteSkip();
}
uiSkip.finishTrialPlanning();
uiSkip.confirmTrialPlanning();

const defenseBeforeSkipActivate = uiSkip.getTrialAvailableDefense();

test("M. all-SKIP planでもactivation成功", () => {
    const res = uiSkip.activateTrialPlan();
    assert.equal(res.success, true);
    assert.equal(uiSkip.isTrialPlanActivated(), true);
});

test("N. all-SKIPでdefense消費0", () => {
    assert.equal(uiSkip.getTrialAvailableDefense(), defenseBeforeSkipActivate);
});

test("O. all-SKIPでqueue []", () => {
    const queue = uiSkip.getTrialBattleQueue();
    assert.ok(Array.isArray(queue));
    assert.equal(queue.length, 0);
});

// ==========================================
// Phase 4: Duplicate Activation Prevention
// ==========================================

const currentDefense = ui.getTrialAvailableDefense();
let dupRes = null;

test("P. duplicate activation拒否", () => {
    dupRes = ui.activateTrialPlan();
    assert.equal(dupRes.success, false);
    assert.ok(dupRes.errors.includes(TRIAL_PLAN_REASONS.PLAN_ALREADY_ACTIVATED));
});

test("Q. duplicate activationでdefense再消費なし", () => {
    assert.equal(ui.getTrialAvailableDefense(), currentDefense);
    assert.equal(ui.trialController.state.human.availableDefense, currentDefense);
});

test("R. duplicate activationでqueue再生成なし", () => {
    const queue = ui.getTrialBattleQueue();
    assert.equal(queue.length, 1);
});

test("S. duplicate activationでGameFact追加なし", () => {
    const activatedFacts = emittedFacts.filter(f => f.type === GAME_FACT_TYPES.TRIAL_PLAN_ACTIVATED);
    assert.equal(activatedFacts.length, 1, "Exactly 1 TRIAL_PLAN_ACTIVATED fact must exist");
});

// ==========================================
// Phase 5: Battle state non-committal
// ==========================================

test("T. currentBattleIndexはまだnull", () => {
    assert.equal(ui.trialController.state.currentBattleIndex, null);
});

test("U. battleResults未生成または未解決状態", () => {
    assert.equal(ui.trialController.state.battleResults, null);
});

test("V. Battle resolver未呼出し", () => {
    assert.equal(ui.trialController.state.interceptions.length, 0);
    assert.equal(ui.trialController.state.result, null);
});

test("W. enemy traversal未実行", () => {
    for (const r of ui.trialController.state.routes) {
        assert.equal(r.currentStepIndex ?? null, null);
    }
});

test("X. HQ damage未実行", () => {
    const hqDefense = engine.state?.hqDefense ?? engine.state?.defense;
    assert.ok(hqDefense !== 0, "HQ should not have taken damage");
});

test("Y. Ember damage未実行", () => {
    assert.equal(engine.state.ember, 20, "Ember should remain unpenalized");
});

// ==========================================
// Phase 6: Advisor & Regression Integrity
// ==========================================

test("Z. Advisor未mountでもactivation成功", () => {
    // Verified across tests: UIController is operating without Advisor mounted
    assert.equal(ui.isTrialPlanActivated(), true);
});

test("AA. Advisor Foundation regression維持", async () => {
    const advisorModule = await import("./test_advisor_foundation.mjs");
    assert.ok(advisorModule);
});

test("AB. Settings regression維持", async () => {
    const settingsModule = await import("./test_settings_modal_system.mjs");
    assert.ok(settingsModule);
});

console.log(`\n🎉 All ${passed} Phase 2.8A Plan Activation tests PASSED!\n`);
