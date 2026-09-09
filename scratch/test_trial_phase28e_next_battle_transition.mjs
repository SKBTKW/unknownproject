import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialBattleSequenceService,
    TRIAL_PLAN_REASONS,
    TRIAL_BATTLE_STATUSES,
    TRIAL_OUTCOMES,
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

console.log("🔄 Starting Phase 2.8E Next Battle Transition Tests...\n");

function createTraversedHarness(scenarioId = "TERRAIN_COMPARE_BASIC", multiRoute = false) {
    elementRegistry.clear();
    mockBody.children = [];
    mockBody._innerText = "";
    mockBody._innerHTML = "";
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview(scenarioId);
    const routes = ui.getTrialPlanningRoutes();

    if (multiRoute && routes.length >= 2) {
        // Route 0 Intercept
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(1, 0);
        ui.setTrialDefenseAllocation(10);
        ui.setTrialActiveRouteIntercept();

        // Route 1 Intercept (2 battles in queue)
        ui.selectTrialRoute(routes[1].id);
        ui.selectTrialInterceptionCell(0, 2);
        ui.setTrialDefenseAllocation(6);
        ui.setTrialActiveRouteIntercept();

        for (let i = 2; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    } else {
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(1, 0);
        ui.setTrialDefenseAllocation(16);
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
    const advRes = ui.trialController.advanceAfterCurrentBattle();
    assert.equal(advRes.success, true, "Setup: advanceAfterCurrentBattle");

    return { engine, ui, controller: ui.trialController };
}

// =========================================================================
// Group A: Preconditions & Validation & Atomicity
// =========================================================================

test("A1: Trial未開始での遷移拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    const controller = ui.trialController;

    const result = controller.transitionAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, ["TRIAL_NOT_STARTED"]);
});

test("A2: plan未activationでの遷移拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const controller = ui.trialController;

    assert.equal(controller.state.planActivated, false);
    const result = controller.transitionAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED]);
});

test("A3: active battleなし（currentBattleIndex === null）での遷移拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(1, 0);
    ui.setTrialDefenseAllocation(16);
    ui.setTrialActiveRouteIntercept();
    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    const controller = ui.trialController;

    assert.equal(controller.state.currentBattleIndex, null);
    const result = controller.transitionAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE]);
});

test("A4: ACTIVE状態（未RESOLVED）での遷移拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(1, 0);
    ui.setTrialDefenseAllocation(16);
    ui.setTrialActiveRouteIntercept();
    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    ui.trialController.startNextBattle();

    const result = ui.trialController.transitionAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_RESOLVED_BATTLE]);
});

test("A5: RESOLVEDだがTraversal未適用での遷移拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(1, 0);
    ui.setTrialDefenseAllocation(16);
    ui.setTrialActiveRouteIntercept();
    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    ui.trialController.startNextBattle();
    ui.trialController.resolveCurrentBattle();

    // Traversal 未実行
    const result = ui.trialController.transitionAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.TRAVERSAL_NOT_APPLIED]);
});

test("A6: 重複遷移の拒否 (BATTLE_TRANSITION_ALREADY_APPLIED)", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", false);

    // 1回目遷移
    const firstTrans = controller.transitionAfterCurrentBattle();
    assert.equal(firstTrans.success, true);

    // 1回目遷移後、currentBattleIndex は null なので NO_ACTIVE_BATTLE になる
    const secondTrans = controller.transitionAfterCurrentBattle();
    assert.equal(secondTrans.success, false);
    assert.deepEqual(secondTrans.errors, [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE]);

    // もし直接 sequenceService.transitionAfterTraversal で同じ battleIndex を指定した場合
    controller.state.currentBattleIndex = 0;
    const directTrans = controller.sequenceService.transitionAfterTraversal(controller.state);
    assert.equal(directTrans.success, false);
    assert.deepEqual(directTrans.errors, [TRIAL_PLAN_REASONS.BATTLE_TRANSITION_ALREADY_APPLIED]);
    controller.state.currentBattleIndex = null;
});

test("A7: 失敗時の状態不変性 (Atomicity)", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", false);

    // 不正な呼び出しを試行（active battle なしにする）
    controller.state.currentBattleIndex = null;
    const initialBattleQueue = JSON.parse(JSON.stringify(controller.state.battleQueue));
    const initialFactsCount = controller.gameFactHub.getFacts().length;

    const failedTrans = controller.transitionAfterCurrentBattle();
    assert.equal(failedTrans.success, false);

    assert.deepEqual(controller.state.battleQueue, initialBattleQueue);
    assert.equal(controller.gameFactHub.getFacts().length, initialFactsCount);
});

// =========================================================================
// Group B: Next Battle Exists Case (複数迎撃時)
// =========================================================================

test("B1: 複数バトル時、遷移後にhasNextBattle=true, nextBattleIndex=1, currentBattleIndex=nullとなる", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", true);
    assert.equal(controller.state.battleQueue.length, 2);
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.RESOLVED);
    assert.equal(controller.state.battleQueue[1].status, TRIAL_BATTLE_STATUSES.PENDING);

    const transRes = controller.transitionAfterCurrentBattle();
    assert.equal(transRes.success, true);
    assert.equal(transRes.transitionResult.completedBattleIndex, 0);
    assert.equal(transRes.transitionResult.hasNextBattle, true);
    assert.equal(transRes.transitionResult.nextBattleIndex, 1);

    // Formal state 検査
    assert.equal(controller.state.currentBattleIndex, null);
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.RESOLVED);
    assert.equal(controller.state.battleQueue[0].sequenceAdvanced, true);
    assert.equal(controller.state.battleQueue[1].status, TRIAL_BATTLE_STATUSES.PENDING); // まだ ACTIVE にしない

    // GameFact 発行検査
    const facts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_SEQUENCE_ADVANCED);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].payload.completedBattleIndex, 0);
    assert.equal(facts[0].payload.hasNextBattle, true);
    assert.equal(facts[0].payload.nextBattleIndex, 1);
});

test("B2: 遷移後に startNextBattle() を別呼び出しして次のバトルが正常に ACTIVE 化される", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", true);

    controller.transitionAfterCurrentBattle();
    assert.equal(controller.state.currentBattleIndex, null);

    // 別呼び出しで startNextBattle()
    const startRes = controller.startNextBattle();
    assert.equal(startRes.success, true);
    assert.equal(startRes.battleIndex, 1);
    assert.equal(controller.state.currentBattleIndex, 1);
    assert.equal(controller.state.battleQueue[1].status, TRIAL_BATTLE_STATUSES.ACTIVE);
});

// =========================================================================
// Group C: No Next Battle Case (単一迎撃 / 全バトル終了時)
// =========================================================================

test("C1: 次バトルがない場合、hasNextBattle=false, nextBattleIndex=null となり Completion は発生しない", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", false);
    assert.equal(controller.state.battleQueue.length, 1);

    const transRes = controller.transitionAfterCurrentBattle();
    assert.equal(transRes.success, true);
    assert.equal(transRes.transitionResult.completedBattleIndex, 0);
    assert.equal(transRes.transitionResult.hasNextBattle, false);
    assert.equal(transRes.transitionResult.nextBattleIndex, null);

    // Completion / Damage は発生しない
    assert.equal(controller.state.currentBattleIndex, null);
    assert.equal(controller.state.isCompleted?.() || false, false);
    assert.equal(controller.state.trialCompleted || false, false);
});

// =========================================================================
// Group D: Route End & Out-of-Scope Integrity
// =========================================================================

test("D1: reachedRouteEnd=true の場合でも HQ/Ember damage は発生せず snapshot のみ伝達される", () => {
    elementRegistry.clear();
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const routes = ui.getTrialPlanningRoutes();
    const route0 = routes[0];
    const lastCellIndex = route0.cells.length - 2; // 終端1つ手前
    const interceptCell = route0.cells[lastCellIndex];

    ui.selectTrialRoute(route0.id);
    ui.selectTrialInterceptionCell(interceptCell.r, interceptCell.c);
    ui.setTrialDefenseAllocation(1); // 敗北確実
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    ui.trialController.startNextBattle();
    ui.trialController.resolveCurrentBattle();
    const advRes = ui.trialController.advanceAfterCurrentBattle();
    assert.equal(advRes.traversalResult.reachedRouteEnd, true);

    const initialHqHp = engine.state.hqHp || engine.state.defenseHp || 0;
    const initialEmber = engine.state.ember || 0;

    const transRes = ui.trialController.transitionAfterCurrentBattle();
    assert.equal(transRes.success, true);
    assert.equal(transRes.transitionResult.reachedRouteEnd, true);

    // Out-of-Scope: HQ/Ember damage 0
    const currentHqHp = engine.state.hqHp || engine.state.defenseHp || 0;
    const currentEmber = engine.state.ember || 0;
    assert.equal(currentHqHp, initialHqHp);
    assert.equal(currentEmber, initialEmber);
});

// =========================================================================
// Group E: Snapshot Immutability
// =========================================================================

test("E1: 返却スナップショットや GameFact payload を書き換えても内部状態は保護される", () => {
    const { controller } = createTraversedHarness("TERRAIN_COMPARE_BASIC", true);

    const transRes = controller.transitionAfterCurrentBattle();
    assert.equal(transRes.success, true);

    // 返却オブジェクト改変
    transRes.transitionResult.nextBattleIndex = 999;
    transRes.transitionResult.hasNextBattle = false;

    assert.equal(controller.state.battleQueue[0].sequenceTransition.nextBattleIndex, 1);
    assert.equal(controller.state.battleQueue[0].sequenceTransition.hasNextBattle, true);

    // Fact payload 改変
    const fact = controller.gameFactHub.getFacts().find(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_SEQUENCE_ADVANCED);
    fact.payload.nextBattleIndex = 888;
    assert.equal(controller.state.battleQueue[0].sequenceTransition.nextBattleIndex, 1);
});

// =========================================================================
// Group F: UI Integration
// =========================================================================

test("F1: UI上で Traversal 後に「次の戦闘へ」ボタンが表示され、クリックで遷移が実行される", () => {
    const { ui } = createTraversedHarness("TERRAIN_COMPARE_BASIC", true);

    ui.render();
    const btnNext = mockBody.querySelector("#btnTrialNextBattle");
    assert.ok(btnNext, "#btnTrialNextBattle should exist in UI after traversal");

    // クリック実行
    btnNext.onclick();

    // 遷移後: currentBattleIndex は null となり、PENDING のバトルがあるので #btnTrialStartBattle が表示される
    ui.render();
    const btnNextAfter = mockBody.querySelector("#btnTrialNextBattle");
    assert.equal(btnNextAfter, null, "#btnTrialNextBattle should disappear after transition");

    const btnStartAfter = mockBody.querySelector("#btnTrialStartBattle");
    assert.ok(btnStartAfter, "#btnTrialStartBattle should appear after transition because 1 pending battle remains");
});

console.log(`\n🎉 All ${passed} Phase 2.8E Next Battle Transition Tests Passed!`);
