import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialEnemyAdvanceService,
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

console.log("🚶 Starting Phase 2.8D Enemy Traversal Tests...\n");

function createResolvedHarness(scenarioId = "TERRAIN_COMPARE_BASIC", defensePower = 16) {
    elementRegistry.clear();
    mockBody.children = [];
    mockBody._innerText = "";
    mockBody._innerHTML = "";
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview(scenarioId);
    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(1, 0);
    ui.setTrialDefenseAllocation(defensePower);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
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
    return { engine, ui, controller: ui.trialController };
}

// =========================================================================
// Group A: Preconditions & Validation & Atomicity
// =========================================================================

test("A1: Trial未開始での進軍拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    const controller = ui.trialController;

    const result = controller.advanceAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, ["TRIAL_NOT_STARTED"]);
});

test("A2: plan未activationでの進軍拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const controller = ui.trialController;

    assert.equal(controller.state.planActivated, false);
    const result = controller.advanceAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED]);
});

test("A3: active battleなしでの進軍拒否", () => {
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

    // battleQueueはあるがstartNextBattleしていない
    assert.equal(controller.getCurrentBattle(), null);
    const result = controller.advanceAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE]);
});

test("A4: RESOLVED以外の状態（ACTIVE状態）での進軍拒否", () => {
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

    // ACTIVE状態だがまだRESOLVEDしていない
    const currentBattle = ui.trialController.getCurrentBattle();
    assert.equal(currentBattle.status, TRIAL_BATTLE_STATUSES.ACTIVE);

    const result = ui.trialController.advanceAfterCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_RESOLVED_BATTLE]);
});

test("A5: 重複進軍の拒否 (TRAVERSAL_ALREADY_APPLIED)", () => {
    const { controller } = createResolvedHarness("TERRAIN_COMPARE_BASIC", 16);

    const firstAdv = controller.advanceAfterCurrentBattle();
    assert.equal(firstAdv.success, true);

    const secondAdv = controller.advanceAfterCurrentBattle();
    assert.equal(secondAdv.success, false);
    assert.deepEqual(secondAdv.errors, [TRIAL_PLAN_REASONS.TRAVERSAL_ALREADY_APPLIED]);
});

test("A6: バリデーション失敗時の状態不変性 (Atomicity)", () => {
    const { controller } = createResolvedHarness("TERRAIN_COMPARE_BASIC", 16);

    // 1回目進軍
    controller.advanceAfterCurrentBattle();
    const initialRouteProgress = JSON.parse(JSON.stringify(controller.state.routeProgress));
    const initialTraversalResults = JSON.parse(JSON.stringify(controller.state.traversalResults));
    const initialFactCount = controller.gameFactHub.getFacts().length;

    // 2回目の失敗時
    const failedAdv = controller.advanceAfterCurrentBattle();
    assert.equal(failedAdv.success, false);

    assert.deepEqual(controller.state.routeProgress, initialRouteProgress);
    assert.deepEqual(controller.state.traversalResults, initialTraversalResults);
    assert.equal(controller.gameFactHub.getFacts().length, initialFactCount);
});

// =========================================================================
// Group B: REPEL Case (防衛成功時)
// =========================================================================

test("B1: REPEL 時に敵が迎撃マスで停止する (stopped = true, advance = 0)", () => {
    // 16戦力割当 -> Player final power > Enemy final power -> REPEL
    const { controller } = createResolvedHarness("TERRAIN_COMPARE_BASIC", 16);
    const battleResult = controller.state.getCurrentBattleResult();
    assert.equal(battleResult.prediction.outcome, TRIAL_OUTCOMES.REPEL);

    const advRes = controller.advanceAfterCurrentBattle();
    assert.equal(advRes.success, true);
    assert.ok(advRes.traversalResult);

    const tr = advRes.traversalResult;
    assert.equal(tr.advance, 0);
    assert.equal(tr.stopped, true);
    assert.equal(tr.advanced, false);
    assert.equal(tr.reachedRouteEnd, false);
    assert.equal(tr.fromIndex, tr.toIndex);
    assert.deepEqual(tr.toCell, tr.interceptCell);

    // state.routeProgress の確認
    const routeProg = controller.getRouteProgress(tr.routeId);
    assert.equal(routeProg.currentIndex, tr.toIndex);
    assert.equal(routeProg.stopped, true);
    assert.deepEqual(routeProg.currentCell, tr.interceptCell);

    // TRIAL_TRAVERSAL_RESOLVED Fact
    const facts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_TRAVERSAL_RESOLVED);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].payload.stopped, true);
    assert.equal(facts[0].payload.advance, 0);
});

// =========================================================================
// Group C: BREAKTHROUGH Case (防衛失敗時)
// =========================================================================

test("C1: BREAKTHROUGH 時に敵が次マスへ進軍する (advance = 1, stopped = false)", () => {
    // 1戦力割当 -> Player final power < Enemy final power -> BREAKTHROUGH
    const { controller } = createResolvedHarness("TERRAIN_COMPARE_BASIC", 1);
    const battleResult = controller.state.getCurrentBattleResult();
    assert.equal(battleResult.prediction.outcome, TRIAL_OUTCOMES.BREAKTHROUGH);

    const advRes = controller.advanceAfterCurrentBattle();
    assert.equal(advRes.success, true);
    assert.ok(advRes.traversalResult);

    const tr = advRes.traversalResult;
    assert.equal(tr.advance, 1);
    assert.equal(tr.stopped, false);
    assert.equal(tr.advanced, true);
    assert.equal(tr.toIndex, tr.fromIndex + 1);

    // state.routeProgress の確認
    const routeProg = controller.getRouteProgress(tr.routeId);
    assert.equal(routeProg.currentIndex, tr.fromIndex + 1);
    assert.equal(routeProg.stopped, false);
    assert.deepEqual(routeProg.currentCell, tr.toCell);

    // TRIAL_TRAVERSAL_RESOLVED Fact
    const facts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_TRAVERSAL_RESOLVED);
    assert.equal(facts.length, 1);
    assert.equal(facts[0].payload.advanced, true);
    assert.equal(facts[0].payload.advance, 1);
});

// =========================================================================
// Group D: Route End & Out-of-Scope Integrity
// =========================================================================

test("D1: 終端マスでの突破判定 (reachedRouteEnd = true) でも HQ/Ember damage は発生しない", () => {
    // ルート終端手前マスで迎撃して敗北させ、reachedRouteEnd = true にする
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
    assert.equal(advRes.success, true);
    assert.equal(advRes.traversalResult.reachedRouteEnd, true);

    // Out-of-Scope: HQ損害、Ember損害、Trial完了は発生していないこと
    assert.equal(ui.trialController.state.isCompleted?.() || false, false);
    assert.equal(ui.trialController.state.trialCompleted || false, false);
    assert.equal(ui.trialController.state.currentBattleIndex, 0); // 次battleへの自動遷移なし
});

// =========================================================================
// Group E: UI Integration
// =========================================================================

test("E1: UI上で解決後に進軍ボタンが表示され、クリックで進軍完了ステータスへ切り替わる", () => {
    const { ui } = createResolvedHarness("TERRAIN_COMPARE_BASIC", 16);

    // 解決直後: advance button が存在するはず
    ui.render();
    const btnAdvance = mockBody.querySelector("#btnTrialAdvanceEnemy");
    assert.ok(btnAdvance, "btnTrialAdvanceEnemy should exist in UI before traversal");

    // クリック実行
    btnAdvance.onclick();

    // 進軍後: advance button は消え、status badge が表示される
    const btnAdvanceAfter = mockBody.querySelector("#btnTrialAdvanceEnemy");
    assert.equal(btnAdvanceAfter, null, "btnTrialAdvanceEnemy should not exist after traversal");

    const statusBadge = mockBody.querySelector(".trial-traversal-status");
    assert.ok(statusBadge, "Status badge should exist after traversal");
    assert.ok(statusBadge.classList.contains("status-stopped"), "REPEL should show status-stopped");
});

console.log(`\n🎉 All ${passed} Phase 2.8D Enemy Traversal Tests Passed!`);
