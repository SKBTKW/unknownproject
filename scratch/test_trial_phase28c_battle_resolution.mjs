import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialPlanningDraftService,
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

console.log("⚔️ Starting Phase 2.8C Battle Resolution Tests...\n");

function createActivatedAndStartedHarness(scenarioId = "TERRAIN_COMPARE_BASIC", customSetupFn = null) {
    elementRegistry.clear();
    mockBody.children = [];
    mockBody._innerText = "";
    mockBody._innerHTML = "";
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview(scenarioId);
    if (customSetupFn) {
        customSetupFn(ui);
    } else {
        const routes = ui.getTrialPlanningRoutes();
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
    return { engine, ui, controller: ui.trialController };
}

// =========================================================================
// Group A: Preconditions & Validation & Atomicity
// =========================================================================

test("A1: Trial未開始での解決拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    const controller = ui.trialController;

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, ["TRIAL_NOT_STARTED"]);
});

test("A2: plan未activationでの解決拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const controller = ui.trialController;

    assert.equal(controller.state.planActivated, false);
    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED]);
});

test("A3: active battleなし（戦闘未開始）での解決拒否", () => {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    const controller = ui.trialController;

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

    // planActivated = true, but startNextBattle NOT called
    assert.equal(controller.state.currentBattleIndex, null);
    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_ACTIVE_BATTLE]);
});

test("A4: battleQueue空での解決拒否", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.state.battleQueue = [];
    controller.state.currentBattleIndex = 0;

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE]);
});

test("A5: 既に解決済みの戦闘に対する重複解決拒否 (BATTLE_ALREADY_RESOLVED)", () => {
    const { controller } = createActivatedAndStartedHarness();

    // 1st resolution
    const firstRes = controller.resolveCurrentBattle();
    assert.equal(firstRes.success, true);
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.RESOLVED);

    // 2nd resolution attempt
    const secondRes = controller.resolveCurrentBattle();
    assert.equal(secondRes.success, false);
    assert.deepEqual(secondRes.errors, [TRIAL_PLAN_REASONS.BATTLE_ALREADY_RESOLVED]);
});

test("A6: 不正/範囲外のcurrentBattleIndexでの解決拒否", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.state.currentBattleIndex = 999;

    const result = controller.resolveCurrentBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.INVALID_CURRENT_BATTLE]);
});

test("A7: 失敗時のAtomicity (state mutation なし、GameFact 発行 0)", () => {
    const { engine, controller } = createActivatedAndStartedHarness();
    // Resolve successfully first
    controller.resolveCurrentBattle();
    const factsCountBefore = controller.gameFactHub.getFacts().length;
    const battleResultsBefore = JSON.stringify(controller.state.battleResults);
    const battleQueueBefore = JSON.stringify(controller.state.battleQueue);

    // Attempt duplicate resolution (must fail)
    const failRes = controller.resolveCurrentBattle();
    assert.equal(failRes.success, false);

    // Verify atomicity
    assert.equal(controller.gameFactHub.getFacts().length, factsCountBefore, "No new facts emitted on failure");
    assert.equal(JSON.stringify(controller.state.battleResults), battleResultsBefore, "battleResults unchanged");
    assert.equal(JSON.stringify(controller.state.battleQueue), battleQueueBefore, "battleQueue unchanged");
});

// =========================================================================
// Group B: Normal Resolution Lifecycle & State Transition
// =========================================================================

test("B1: 正常解決実行で success: true が返る", () => {
    const { controller } = createActivatedAndStartedHarness();
    const res = controller.resolveCurrentBattle();
    assert.equal(res.success, true);
    assert.equal(res.battleIndex, 0);
    assert.ok(res.combatResult, "Includes combatResult");
});

test("B2: currentBattle.status が ACTIVE -> RESOLVED に遷移する", () => {
    const { controller } = createActivatedAndStartedHarness();
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.ACTIVE);

    controller.resolveCurrentBattle();
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.RESOLVED);
});

test("B3: currentBattleIndex は不変 (auto-advance しない、0 のまま)", () => {
    const { controller } = createActivatedAndStartedHarness();
    assert.equal(controller.state.currentBattleIndex, 0);

    controller.resolveCurrentBattle();
    assert.equal(controller.state.currentBattleIndex, 0, "currentBattleIndex remains 0");
});

test("B4: controller.getCurrentBattleResult() / state.getCurrentBattleResult() で CombatResult が取得できる", () => {
    const { controller } = createActivatedAndStartedHarness();
    assert.equal(controller.getCurrentBattleResult(), null);
    assert.equal(controller.state.getCurrentBattleResult(), null);

    controller.resolveCurrentBattle();
    const resultFromCtrl = controller.getCurrentBattleResult();
    const resultFromState = controller.state.getCurrentBattleResult();

    assert.ok(resultFromCtrl);
    assert.deepEqual(resultFromCtrl, resultFromState);
    assert.equal(resultFromCtrl.battleIndex, 0);
});

test("B5: controller.state.battleResults に battleIndex をキーとする記録が保存される", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.resolveCurrentBattle();

    assert.ok(controller.state.battleResults[0]);
    assert.equal(controller.state.battleResults[0].battleIndex, 0);
    assert.equal(controller.state.getBattleResults()[0].battleIndex, 0);
});

test("B6: controller.isCurrentBattleResolved() が true を返す", () => {
    const { controller } = createActivatedAndStartedHarness();
    assert.equal(controller.isCurrentBattleResolved(), false);

    controller.resolveCurrentBattle();
    assert.equal(controller.isCurrentBattleResolved(), true);
});

test("B7: TRIAL_BATTLE_RESOLVED GameFact が exactly 1 回発行される", () => {
    const { controller } = createActivatedAndStartedHarness();
    const factsBefore = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED);
    assert.equal(factsBefore.length, 0);

    controller.resolveCurrentBattle();
    const factsAfter = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED);
    assert.equal(factsAfter.length, 1);
});

test("B8: TRIAL_BATTLE_RESOLVED の payload が完全であること", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.resolveCurrentBattle();

    const fact = controller.gameFactHub.getFacts().find(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED);
    assert.ok(fact);
    assert.equal(fact.payload.battleIndex, 0);
    assert.equal(fact.payload.routeId, "TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(fact.payload.interceptCell, { r: 1, c: 0 });
    assert.equal(fact.payload.outcome, TRIAL_OUTCOMES.REPEL);
    assert.equal(fact.payload.playerActualPower, 80);
    assert.equal(fact.payload.enemyActualPower, 56);
    assert.equal(fact.payload.margin, 24);
});

// =========================================================================
// Group C: TERRAIN_COMPARE_BASIC 4 地点の CombatResult 数値検証
// =========================================================================

test("C1: Route 0: (1, 0) wetland exit: 80 vs 56, margin +24, REPEL", () => {
    const { controller } = createActivatedAndStartedHarness();
    const res = controller.resolveCurrentBattle();
    assert.equal(res.success, true);
    const cr = res.combatResult;

    assert.equal(cr.routeId, "TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(cr.interceptCell, { r: 1, c: 0 });
    assert.equal(cr.human.finalPower, 80);
    assert.equal(cr.enemy.finalPower, 56);
    assert.equal(cr.prediction.margin, 24);
    assert.equal(cr.prediction.outcome, TRIAL_OUTCOMES.REPEL);
});

test("C2: Route 1: (2, 0) plains: 80 vs 70, margin +10, REPEL", () => {
    const { controller } = createActivatedAndStartedHarness("TERRAIN_COMPARE_BASIC", (ui) => {
        const routes = ui.getTrialPlanningRoutes();
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(2, 0);
        ui.setTrialDefenseAllocation(16);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    });

    const res = controller.resolveCurrentBattle();
    assert.equal(res.success, true);
    const cr = res.combatResult;

    assert.equal(cr.routeId, "TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(cr.interceptCell, { r: 2, c: 0 });
    assert.equal(cr.human.finalPower, 80);
    assert.equal(cr.enemy.finalPower, 70);
    assert.equal(cr.prediction.margin, 10);
    assert.equal(cr.prediction.outcome, TRIAL_OUTCOMES.REPEL);
});

test("C3: Route 2: (2, 1) forest: 60 vs 55, margin +5, REPEL", () => {
    const { controller } = createActivatedAndStartedHarness("TERRAIN_COMPARE_BASIC", (ui) => {
        const routes = ui.getTrialPlanningRoutes();
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(2, 1);
        ui.setTrialDefenseAllocation(16);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    });

    const res = controller.resolveCurrentBattle();
    assert.equal(res.success, true);
    const cr = res.combatResult;

    assert.equal(cr.routeId, "TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(cr.interceptCell, { r: 2, c: 1 });
    assert.equal(cr.human.finalPower, 60);
    assert.equal(cr.enemy.finalPower, 55);
    assert.equal(cr.prediction.margin, 5);
    assert.equal(cr.prediction.outcome, TRIAL_OUTCOMES.REPEL);
});

test("C4: Route 3: (3, 1) forest hill: 72 vs 55, margin +17, REPEL", () => {
    const { controller } = createActivatedAndStartedHarness("TERRAIN_COMPARE_BASIC", (ui) => {
        const routes = ui.getTrialPlanningRoutes();
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(3, 1);
        ui.setTrialDefenseAllocation(16);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    });

    const res = controller.resolveCurrentBattle();
    assert.equal(res.success, true);
    const cr = res.combatResult;

    assert.equal(cr.routeId, "TERRAIN_COMPARE_ROUTE");
    assert.deepEqual(cr.interceptCell, { r: 3, c: 1 });
    assert.equal(cr.human.finalPower, 72);
    assert.equal(cr.enemy.finalPower, 55);
    assert.equal(cr.prediction.margin, 17);
    assert.equal(cr.prediction.outcome, TRIAL_OUTCOMES.REPEL);
});

// =========================================================================
// Group D: Modifier タグ & プレイヤー視点カラー判定
// =========================================================================

test("D1: CombatResult.modifiers に地勢/高低差補正が反映されていること", () => {
    // (1,0) wetland exit: wetland exit transition penalty for enemy (-20%)
    const { controller } = createActivatedAndStartedHarness();
    const res = controller.resolveCurrentBattle();
    const cr = res.combatResult;

    assert.ok(cr.modifiers);
    assert.ok(cr.modifiers.length > 0);
    const wetlandMod = cr.modifiers.find(m => m.source === "WETLAND_EXIT" || (m.value && m.value < 1));
    assert.ok(wetlandMod, "Found wetland exit penalty modifier");
});

test("D2: 高低差補正 (Elevation Modifier) の反映確認", () => {
    // (3,1) forest hill: player on hill (elevation 1), attacker from plains (elevation 0)
    const { controller } = createActivatedAndStartedHarness("TERRAIN_COMPARE_BASIC", (ui) => {
        const routes = ui.getTrialPlanningRoutes();
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(3, 1);
        ui.setTrialDefenseAllocation(16);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    });

    const res = controller.resolveCurrentBattle();
    const cr = res.combatResult;
    assert.ok(cr.modifiers);
    const elevMod = cr.modifiers.find(m => m.source === "HIGH_GROUND" || (m.value && m.value > 1));
    assert.ok(elevMod, "Found elevation high ground advantage");
});

// =========================================================================
// Group E: Snapshot 独立性 & 防御的コピー (Immutability)
// =========================================================================

test("E1: resolveCurrentBattle() の返却オブジェクトを書き換えても state.battleResults は影響を受けない", () => {
    const { controller } = createActivatedAndStartedHarness();
    const res = controller.resolveCurrentBattle();

    // Mutate returned object
    res.combatResult.human.finalPower = 99999;
    res.combatResult.prediction.outcome = "DEFEAT";

    // Check internal state
    const saved = controller.state.getCurrentBattleResult();
    assert.equal(saved.human.finalPower, 80, "Internal human.finalPower not corrupted");
    assert.equal(saved.prediction.outcome, TRIAL_OUTCOMES.REPEL, "Internal outcome not corrupted");
});

test("E2: getCurrentBattleResult() の返却オブジェクトを書き換えても内部状態は保護される", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.resolveCurrentBattle();

    const retrieved = controller.getCurrentBattleResult();
    retrieved.prediction.margin = -500;

    const again = controller.getCurrentBattleResult();
    assert.equal(again.prediction.margin, 24, "Subsequent getCurrentBattleResult() returns pristine data");
});

test("E3: GameFact の payload を書き換えても内部状態は保護される", () => {
    const { controller } = createActivatedAndStartedHarness();
    controller.resolveCurrentBattle();

    const fact = controller.gameFactHub.getFacts().find(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED);
    fact.payload.playerActualPower = 0;

    const saved = controller.state.getCurrentBattleResult();
    assert.equal(saved.human.finalPower, 80, "Internal state unaffected by fact mutation");
});

// =========================================================================
// Group F: UI 連携 & 描画
// =========================================================================

test("F1: UIController.isTrialBattleResolved() がドメイン状態を反映する", () => {
    const { ui } = createActivatedAndStartedHarness();
    assert.equal(ui.isTrialBattleResolved(), false);

    ui.resolveCurrentTrialBattle();
    assert.equal(ui.isTrialBattleResolved(), true);
});

test("F2: UIController.resolveCurrentTrialBattle() が正常に呼び出せる", () => {
    const { ui } = createActivatedAndStartedHarness();
    const res = ui.resolveCurrentTrialBattle();
    assert.equal(res.success, true);
    assert.equal(res.combatResult.outcome, TRIAL_OUTCOMES.REPEL);
});

test("F3: 解決前: #btnTrialResolveBattle が存在し、#trialBattleResolvedBanner は存在しない", () => {
    const { ui } = createActivatedAndStartedHarness();
    ui.render();

    const resolveBtn = mockBody.querySelector("#btnTrialResolveBattle");
    const banner = mockBody.querySelector("#trialBattleResolvedBanner");

    assert.ok(resolveBtn, "#btnTrialResolveBattle should exist before resolution");
    assert.equal(banner, null, "#trialBattleResolvedBanner should NOT exist before resolution");
});

test("F4: 解決後: #trialBattleResolvedBanner が描画され、Outcome / Power Comparison / Modifier Tags が表示される", () => {
    const { ui } = createActivatedAndStartedHarness();
    ui.resolveCurrentTrialBattle();
    ui.render();

    const banner = mockBody.querySelector("#trialBattleResolvedBanner");
    assert.ok(banner, "#trialBattleResolvedBanner must exist after resolution");

    const text = banner.textContent;
    assert.ok(text.includes("REPEL") || text.includes("撃退"), "Contains outcome text");
    assert.ok(text.includes("80"), "Contains player power");
    assert.ok(text.includes("56"), "Contains enemy power");

    // Modifier tags
    const tags = banner.querySelector(".trial-battle-tags");
    assert.ok(tags, ".trial-battle-tags container exists");
});

test("F5: 解決後: #btnTrialResolveBattle は非表示になる", () => {
    const { ui } = createActivatedAndStartedHarness();
    ui.resolveCurrentTrialBattle();
    ui.render();

    const resolveBtn = mockBody.querySelector("#btnTrialResolveBattle");
    assert.equal(resolveBtn, null, "#btnTrialResolveBattle should be removed after resolution");
});

test("F6: UI上の戦力表示 (Player Power / Enemy Power) がドメイン計算値と一致する", () => {
    const { ui } = createActivatedAndStartedHarness();
    ui.resolveCurrentTrialBattle();
    ui.render();

    const cr = ui.getCurrentTrialBattleResult();
    const banner = mockBody.querySelector("#trialBattleResolvedBanner");

    assert.ok(banner.textContent.includes(String(cr.playerActualPower)));
    assert.ok(banner.textContent.includes(String(cr.enemyActualPower)));
});

console.log(`\n🎉 All Phase 2.8C Tests Passed! (${passed} tests)`);
