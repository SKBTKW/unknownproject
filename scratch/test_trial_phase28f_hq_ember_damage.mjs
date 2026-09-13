import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialHqDamageResolver,
    TRIAL_PLAN_REASONS,
    TRIAL_BATTLE_STATUSES,
    TRIAL_OUTCOMES,
    TRIAL_COMPLETION_OUTCOMES,
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
        this.dataset = {};
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
                    const dataRouteId = attrs.match(/data-route-id=["']([^"']+)["']/i);
                    if (dataRouteId) child.setAttribute("data-route-id", dataRouteId[1]);
                }
                stack[stack.length - 1].appendChild(child);
                if (!voidTags.has(tagName.toLowerCase()) && !full.endsWith("/>")) {
                    stack.push(child);
                }
            }
        }
    }

    get innerText() { return this.textContent; }
    set innerText(v) { this._innerText = String(v); }
    get textContent() {
        let text = this._innerText || "";
        for (const c of this.children) {
            text += c.textContent;
        }
        return text;
    }
    set textContent(v) { this._innerText = String(v); }

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

    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
    removeAttribute(k) { delete this.attributes[k]; }

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

    getBoundingClientRect() {
        return { top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 };
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

function createTraversedHarness({
    interceptCell = { r: 1, c: 0 },
    defenseAlloc = 16,
    multiRoute = false,
    initialEmber = 20
} = {}) {
    elementRegistry.clear();
    mockBody.children = [];
    mockBody._innerText = "";
    mockBody._innerHTML = "";
    const engine = GameEngine.createGame();
    engine.state.ember = initialEmber;
    if (engine.emberSystem) engine.emberSystem.current = initialEmber;

    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const routes = ui.getTrialPlanningRoutes();

    if (multiRoute && routes.length >= 2) {
        // Route 0 Intercept at specified cell
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(interceptCell.r, interceptCell.c);
        ui.setTrialDefenseAllocation(defenseAlloc);
        ui.setTrialActiveRouteIntercept();

        // Route 1 Intercept at end cell with 1 alloc
        const route1 = routes[1];
        const lastCell1 = route1.cells[route1.cells.length - 1];
        ui.selectTrialRoute(route1.id);
        ui.selectTrialInterceptionCell(lastCell1.r, lastCell1.c);
        ui.setTrialDefenseAllocation(1);
        ui.setTrialActiveRouteIntercept();

        for (let i = 2; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    } else {
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(interceptCell.r, interceptCell.c);
        ui.setTrialDefenseAllocation(defenseAlloc);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    }

    const finishRes = ui.finishTrialPlanning();
    assert.equal(finishRes.success, true, "Setup: finishTrialPlanning");
    const confirmRes = ui.confirmTrialPlanning();
    assert.equal(confirmRes.success, true, "Setup: confirmTrialPlanning");
    const actRes = ui.activateTrialPlan();
    assert.equal(actRes.success, true, "Setup: activateTrialPlan");
    const startRes = ui.trialController.startNextBattle();
    assert.equal(startRes.success, true, "Setup: startNextBattle");
    const resolveRes = ui.trialController.resolveCurrentBattle();
    assert.equal(resolveRes.success, true, "Setup: resolveCurrentBattle");
    const advRes = ui.advanceCurrentTrialBattle();
    assert.equal(advRes.success, true, "Setup: advanceCurrentTrialBattle");

    return { engine, ui, controller: ui.trialController };
}

function completeRemainingTrialBattles({ ui, controller }) {
    while (controller.state.currentBattleIndex !== null) {
        const transition = ui.transitionTrialAfterCurrentBattle();
        assert.equal(transition.success, true, "Setup: transition resolved battle");
    }

    while (controller.state.battleQueue.some(battle => battle.status === TRIAL_BATTLE_STATUSES.PENDING)) {
        const start = controller.startNextBattle();
        assert.equal(start.success, true, "Setup: start remaining battle");
        const resolve = controller.resolveCurrentBattle();
        assert.equal(resolve.success, true, "Setup: resolve remaining battle");
        const traversal = ui.advanceCurrentTrialBattle();
        assert.equal(traversal.success, true, "Setup: advance remaining battle");
        const transition = ui.transitionTrialAfterCurrentBattle();
        assert.equal(transition.success, true, "Setup: transition remaining battle");
    }

    assert.equal(controller.canCompleteTrial(), true, "Setup: aggregate HQ resolution is ready");
    const completion = ui.completeTrial();
    assert.equal(completion.success, true, "Setup: complete Trial");
    return completion;
}

console.log("⚔️ Starting Phase 2.8F HQ / Ember Damage Resolution Tests...");

// 1. Pure Resolver tests
test("TrialHqDamageResolver: pure calculation and scaling formula", () => {
    const resolver = new TrialHqDamageResolver({ suppressionConversionRate: 5 });
    assert.equal(resolver.calculateDamage(0), 0);
    assert.equal(resolver.calculateDamage(1), 1); // ceil(1/5) = 1
    assert.equal(resolver.calculateDamage(5), 1); // ceil(5/5) = 1
    assert.equal(resolver.calculateDamage(6), 2); // ceil(6/5) = 2
    assert.equal(resolver.calculateDamage(15), 3); // ceil(15/5) = 3
    assert.equal(resolver.calculateDamage(20), 4); // ceil(20/5) = 4

    // Custom rate
    const customResolver = new TrialHqDamageResolver({ suppressionConversionRate: 10 });
    assert.equal(customResolver.calculateDamage(15), 2); // ceil(15/10) = 2
});

test("TrialHqDamageResolver: validation preconditions", () => {
    const resolver = new TrialHqDamageResolver();

    // Missing traversalResult
    const res1 = resolver.resolve({});
    assert.equal(res1.success, false);
    assert.equal(res1.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);

    // reachedRouteEnd === false
    const res2 = resolver.resolve({
        traversalResult: { reachedRouteEnd: false },
        battleResult: { remainingSuppression: 10 }
    });
    assert.equal(res2.success, false);
    assert.equal(res2.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);

    // damageAlreadyApplied
    const res3 = resolver.resolve({
        traversalResult: { reachedRouteEnd: true, damageApplied: true },
        battleResult: { remainingSuppression: 10 }
    });
    assert.equal(res3.success, false);
    assert.equal(res3.errors[0], TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED);

    // Missing battleResult
    const res4 = resolver.resolve({
        traversalResult: { reachedRouteEnd: true },
        battleResult: null
    });
    assert.equal(res4.success, false);
    assert.equal(res4.errors[0], TRIAL_PLAN_REASONS.INVALID_DAMAGE_SOURCE);
});

test("TrialHqDamageResolver: successful damage calculation snapshot", () => {
    const resolver = new TrialHqDamageResolver({ suppressionConversionRate: 5 });
    const res = resolver.resolve({
        battleIndex: 0,
        routeId: "ROUTE_NORTH",
        traversalResult: { battleIndex: 0, routeId: "ROUTE_NORTH", reachedRouteEnd: true },
        battleResult: { remainingSuppression: 20 },
        emberBefore: 20
    });

    assert.equal(res.success, true);
    assert.equal(res.damageResult.battleIndex, 0);
    assert.equal(res.damageResult.routeId, "ROUTE_NORTH");
    assert.equal(res.damageResult.reachedRouteEnd, true);
    assert.equal(res.damageResult.sourcePower, 20);
    assert.equal(res.damageResult.emberDamage, 4); // ceil(20/5)
    assert.equal(res.damageResult.emberBefore, 20);
    assert.equal(res.damageResult.emberAfter, 16);
    assert.equal(res.damageResult.damageApplied, true);
});

// 2. Controller & Flow Integration tests
test("TrialController: No route end produces NO_ROUTE_END_DAMAGE and 0 Fact", () => {
    // Intercept at cell (1,0) with 16 defense -> REPEL -> stopped -> reachedRouteEnd === false
    const { ui, controller } = createTraversedHarness({
        interceptCell: { r: 1, c: 0 },
        defenseAlloc: 16
    });

    const traversal = controller.getCurrentTraversalResult();
    assert.equal(traversal.stopped, true);
    assert.equal(traversal.reachedRouteEnd, false);

    // Attempt route end damage resolution
    const damageResult = controller.resolveRouteEndDamage(0);
    assert.equal(damageResult.success, false);
    assert.equal(damageResult.errors[0], TRIAL_PLAN_REASONS.NO_ROUTE_END_DAMAGE);

    // Facts check
    const damageFacts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED);
    assert.equal(damageFacts.length, 0);
});

test("TrialController: Route end breakthrough waits for aggregate completion and emits 1 Fact", () => {
    // Intercept at cell (3,1) (final cell) with 1 defense -> BREAKTHROUGH -> reachedRouteEnd === true
    const { ui, controller, engine } = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1
    });

    const traversal = controller.getCurrentTraversalResult();
    assert.equal(traversal.reachedRouteEnd, true);

    const pending = controller.resolveRouteEndDamage(0);
    assert.equal(pending.success, true);
    assert.equal(pending.pendingAggregation, true);
    assert.equal(controller.state.hqDamageResolution, null);
    assert.equal(engine.state.ember, 20);
    assert.equal(controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED).length, 0);

    const completion = completeRemainingTrialBattles({ ui, controller });
    const damageResult = completion.hqDamage;
    assert.ok(damageResult, "Aggregate DamageResult should exist");
    assert.equal(damageResult.aggregate, true);
    assert.equal(damageResult.damageApplied, true);
    assert.ok(damageResult.emberDamage > 0, "Should inflict damage");
    assert.equal(damageResult.emberAfter, 20 - damageResult.emberDamage);

    // Ember state updated on controller and engine
    assert.equal(controller.state.ember, damageResult.emberAfter);
    assert.equal(engine.state.ember, damageResult.emberAfter);

    // Exactly 1 GameFact
    const damageFacts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED);
    assert.equal(damageFacts.length, 1);
    assert.equal(damageFacts[0].payload.emberDamage, damageResult.emberDamage);
});

test("TrialController: Duplicate aggregate damage resolution is rejected (Atomicity & Idempotency)", () => {
    const harness = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1
    });
    const { controller } = harness;
    completeRemainingTrialBattles(harness);

    const initialEmber = controller.state.ember;

    // Attempt a second aggregate resolution
    const secondCall = controller.resolveAggregatedHqDamage();
    assert.equal(secondCall.success, false);
    assert.equal(secondCall.errors[0], TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED);

    // Ember should not be deducted again
    assert.equal(controller.state.ember, initialEmber);

    // Fact count remains exactly 1
    const damageFacts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED);
    assert.equal(damageFacts.length, 1);
});

test("TrialController: Multiple route arrivals resolve in one aggregate", () => {
    const harness = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1,
        multiRoute: true
    });
    const { controller, engine } = harness;

    const completion = completeRemainingTrialBattles(harness);
    const damageResult = completion.hqDamage;
    assert.equal(damageResult.aggregate, true);
    assert.ok(damageResult.routeEndCount >= 2, "Aggregate should include multiple arrivals");
    assert.equal(damageResult.emberDamage, Math.ceil(damageResult.sourcePower / damageResult.conversionRate));
    assert.equal(controller.state.ember, damageResult.emberAfter);
    assert.equal(engine.state.ember, damageResult.emberAfter);

    // All arrivals produce one aggregate Fact.
    const damageFacts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_HQ_DAMAGE_RESOLVED);
    assert.equal(damageFacts.length, 1);
    assert.equal(damageFacts[0].payload.aggregate, true);
});

test("TrialController: Clamp ember at 0 without negative numbers", () => {
    const harness = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1,
        initialEmber: 2
    });
    const { controller, engine } = harness;

    const damageResult = completeRemainingTrialBattles(harness).hqDamage;
    assert.ok(damageResult.emberDamage > 2, "Damage should exceed initial 2 ember");
    assert.equal(damageResult.emberAfter, 0, "emberAfter must clamp to 0");
    assert.equal(controller.state.ember, 0);
    assert.equal(engine.state.ember, 0);
});

test("TrialController: Ember 0 completes Trial with a retained FAILED result", () => {
    const harness = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1,
        initialEmber: 1
    });
    const { controller } = harness;

    const completion = completeRemainingTrialBattles(harness);
    assert.equal(controller.state.ember, 0);
    assert.equal(completion.result.outcome, TRIAL_COMPLETION_OUTCOMES.FAILED);
    assert.equal(controller.state.result.outcome, TRIAL_COMPLETION_OUTCOMES.FAILED);
    assert.equal(controller.state.phase, "RESULT");
});

test("TrialController: Snapshot mutation does not corrupt internal state", () => {
    const harness = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1
    });
    const { controller } = harness;

    const snapshot = completeRemainingTrialBattles(harness).hqDamage;
    snapshot.emberDamage = 99999;
    snapshot.aggregate = false;

    const freshSnapshot = controller.state.hqDamageResolution;
    assert.notEqual(freshSnapshot.emberDamage, 99999);
    assert.equal(freshSnapshot.aggregate, true);
});

test("TrialController: Non-damage resource integrity", () => {
    const { controller } = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1
    });

    const initialDefense = 20; // from scenario
    // Defense budget used was 1
    assert.equal(controller.state.human.availableDefense, initialDefense - 1);
    assert.equal(controller.state.human.mystic, 0);
});

test("UI Integration: Aggregate damage is withheld at route end and Next Battle button is present", () => {
    const { ui } = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1
    });

    ui.render();
    // Per-route damage is no longer rendered before aggregate completion.
    const badge = mockBody.querySelector("#trialHqDamageBadge");
    assert.equal(badge, null, "#trialHqDamageBadge should wait for aggregate completion");

    // Check next battle button
    const nextBtn = mockBody.querySelector("#btnTrialNextBattle");
    assert.ok(nextBtn, "#btnTrialNextBattle should be rendered");

    // Clicking next battle button performs sequence transition only
    nextBtn.onclick();
    assert.equal(ui.trialController.state.currentBattleIndex, null);
});

test("Phase 2.8E UI boundary regression: Next battle click does NOT start battle", () => {
    const { ui, controller } = createTraversedHarness({
        interceptCell: { r: 3, c: 1 },
        defenseAlloc: 1,
        multiRoute: true
    });

    // After battle 0 traversal and damage, currentBattleIndex is 0
    assert.equal(controller.state.currentBattleIndex, 0);

    const nextBtn = document.getElementById("btnTrialNextBattle");
    assert.ok(nextBtn);
    nextBtn.onclick();

    // Boundary check: transition only!
    assert.equal(controller.state.currentBattleIndex, null);
    const battle1 = controller.state.battleQueue[1];
    assert.equal(battle1.status, TRIAL_BATTLE_STATUSES.PENDING);
});

console.log("\n🎉 All " + passed + " Phase 2.8F HQ / Ember Damage tests PASSED!");
