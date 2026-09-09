import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialPlanningDraftService,
    TRIAL_PLAN_REASONS,
    TRIAL_BATTLE_STATUSES,
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

console.log("⚔️ Starting Phase 2.8B Battle Sequence Start Tests (A through AB)...\n");

function createFreshHarness() {
    const engine = GameEngine.createGame();
    const ui = new UIController(engine);
    const startRes = ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
    assert.equal(startRes.success, true, "Setup: Preview harness started");
    return { engine, ui };
}

// --- A. plan未activationでStart拒否 ---
test("A. plan未activationでStart拒否", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    assert.equal(controller.state.planActivated, false);
    const result = controller.startNextBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED]);
    assert.equal(controller.state.currentBattleIndex, null);
});

// --- B. battleQueue無しでStart拒否 ---
test("B. battleQueue無しでStart拒否", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    controller.state.planActivated = true;
    controller.state.battleQueue = null;

    const result = controller.startNextBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_CONFIRMED_PLAN]);
    assert.equal(controller.state.currentBattleIndex, null);
});

// --- C. battleQueue [] でNO_PENDING_BATTLES ---
test("C. battleQueue [] でNO_PENDING_BATTLES", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    // all-SKIP
    const routes = ui.getTrialPlanningRoutes();
    for (const r of routes) {
        ui.selectTrialRoute(r.id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    const actResult = ui.activateTrialPlan();
    assert.equal(actResult.success, true);
    assert.equal(controller.state.battleQueue.length, 0);

    const result = controller.startNextBattle();
    assert.equal(result.success, false);
    assert.deepEqual(result.errors, [TRIAL_PLAN_REASONS.NO_PENDING_BATTLES]);
});

// --- D. queue empty時currentBattleIndex null維持 ---
test("D. queue empty時currentBattleIndex null維持", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    for (const r of routes) {
        ui.selectTrialRoute(r.id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(controller.state.currentBattleIndex, null);
});

// --- E. queue empty時Fact 0 ---
test("E. queue empty時Fact 0", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    for (const r of routes) {
        ui.selectTrialRoute(r.id);
        ui.setTrialActiveRouteSkip();
    }
    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    const factsBefore = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_STARTED);
    assert.equal(factsBefore.length, 0);

    controller.startNextBattle();

    const factsAfter = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_STARTED);
    assert.equal(factsAfter.length, 0);
});

// --- F. valid queueでStart成功 ---
test("F. valid queueでStart成功", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    const result = controller.startNextBattle();
    assert.equal(result.success, true);
    assert.equal(result.battleIndex, 0);
    assert.equal(result.currentBattle.routeId, routes[0].id);
});

// --- G. currentBattleIndexが0になる ---
test("G. currentBattleIndexが0になる", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(controller.state.currentBattleIndex, 0);
});

// --- H. current battleがqueue先頭と一致 ---
test("H. current battleがqueue先頭と一致", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(15);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    const current = controller.getCurrentBattle();
    assert.notEqual(current, null);
    assert.equal(current.routeId, routes[0].id);
    assert.equal(current.defenseAllocation, 15);
    assert.deepEqual(current.interceptCell, { r: 2, c: 1 });
});

// --- I. 先頭queue statusがACTIVEになる ---
test("I. 先頭queue statusがACTIVEになる", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.PENDING);
    controller.startNextBattle();
    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.ACTIVE);
});

// --- J. 他queue itemはPENDING維持 ---
test("J. 他queue itemはPENDING維持", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    ui.selectTrialRoute(routes[1].id);
    ui.selectTrialInterceptionCell(0, 2);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 2; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    assert.equal(controller.state.battleQueue.length, 2);
    controller.startNextBattle();

    assert.equal(controller.state.battleQueue[0].status, TRIAL_BATTLE_STATUSES.ACTIVE);
    assert.equal(controller.state.battleQueue[1].status, TRIAL_BATTLE_STATUSES.PENDING);
});

// --- K. Battle result未生成 ---
test("K. Battle result未生成", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    assert.equal(controller.state.battleResults, null);
    controller.startNextBattle();
    assert.equal(controller.state.battleResults, null);
});

// --- L. Combat resolver未呼出し ---
test("L. Combat resolver未呼出し", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    let resolverCalled = false;
    const originalResolve = controller.combatResolver.resolve;
    controller.combatResolver.resolve = function() {
        resolverCalled = true;
        return originalResolve.apply(controller.combatResolver, arguments);
    };

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    resolverCalled = false;
    controller.startNextBattle();
    assert.equal(resolverCalled, false);
});

// --- M. terrain modifier未計算 ---
test("M. terrain modifier未計算", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    const battle = controller.state.battleQueue[0];
    assert.equal(battle.modifiers, undefined);
    assert.equal(battle.finalHumanPower, undefined);
    assert.equal(battle.finalEnemyPower, undefined);
});

// --- N. enemy traversal未実行 ---
test("N. enemy traversal未実行", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    const initialRouteSnapshot = JSON.stringify(routes);

    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(JSON.stringify(ui.getTrialPlanningRoutes()), initialRouteSnapshot);
});

// --- O. HQ damage未実行 ---
test("O. HQ damage未実行", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(controller.state.result, null);
});

// --- P. Ember damage未実行 ---
test("P. Ember damage未実行", () => {
    const { engine, ui } = createFreshHarness();
    const initialEmber = engine.state.ember;
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(engine.state.ember, initialEmber);
});

// --- Q. TRIAL_BATTLE_STARTED exactly 1 ---
test("Q. TRIAL_BATTLE_STARTED exactly 1", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(12);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();

    const facts = controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_STARTED);
    assert.equal(facts.length, 1);
    const fact = facts[0];
    assert.deepEqual(fact.payload, {
        battleIndex: 0,
        routeId: routes[0].id,
        interceptCell: { r: 2, c: 1 },
        defenseAllocation: 12
    });
});

// --- R. duplicate Start拒否 ---
test("R. duplicate Start拒否", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    const firstResult = controller.startNextBattle();
    assert.equal(firstResult.success, true);

    const secondResult = controller.startNextBattle();
    assert.equal(secondResult.success, false);
    assert.deepEqual(secondResult.errors, [TRIAL_PLAN_REASONS.BATTLE_ALREADY_ACTIVE]);
});

// --- S. duplicate StartでFact追加なし ---
test("S. duplicate StartでFact追加なし", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    const factsCountBefore = controller.gameFactHub.getFacts().length;

    controller.startNextBattle();
    const factsCountAfter = controller.gameFactHub.getFacts().length;
    assert.equal(factsCountAfter, factsCountBefore);
});

// --- T. duplicate Startでindex不変 ---
test("T. duplicate Startでindex不変", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    controller.startNextBattle();
    assert.equal(controller.state.currentBattleIndex, 0);

    controller.startNextBattle();
    assert.equal(controller.state.currentBattleIndex, 0);
});

// --- U. UIからStart可能 ---
test("U. UIからStart可能", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    const btnStartBattle = document.getElementById("btnTrialStartBattle");
    assert.notEqual(btnStartBattle, null);

    btnStartBattle.onclick();

    assert.equal(ui.isTrialBattleActive(), true);
    assert.equal(controller.state.currentBattleIndex, 0);
});

// --- V. Start後UIがactive battle表示 ---
test("V. Start後UIがactive battle表示", () => {
    const { ui } = createFreshHarness();

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(20);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    ui.startTrialBattle();

    const banner = document.getElementById("trialBattleActiveBanner");
    assert.notEqual(banner, null);
    assert.equal(banner.textContent.includes(I18n.t("UI_TRIAL_BATTLE_ACTIVE")), true);
    assert.equal(banner.textContent.includes("20"), true);
});

// --- W. current battle snapshotをUI側からmutateしてもDomain stateが壊れない ---
test("W. current battle snapshotをUI側からmutateしてもDomain stateが壊れない", () => {
    const { ui } = createFreshHarness();
    const controller = ui.trialController;

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();
    ui.startTrialBattle();

    const snapshot = ui.getCurrentTrialBattle();
    assert.notEqual(snapshot, null);
    snapshot.defenseAllocation = 9999;
    snapshot.status = "MUTATED";
    snapshot.interceptCell.r = 999;

    const domainItem = controller.state.battleQueue[0];
    assert.equal(domainItem.defenseAllocation, 10);
    assert.equal(domainItem.status, TRIAL_BATTLE_STATUSES.ACTIVE);
    assert.equal(domainItem.interceptCell.r, 2);
});

// --- X. Advisor未mountでもStart成功 ---
test("X. Advisor未mountでもStart成功", () => {
    const { ui } = createFreshHarness();
    assert.equal(ui.advisorDock, undefined);

    const routes = ui.getTrialPlanningRoutes();
    ui.selectTrialRoute(routes[0].id);
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    ui.setTrialActiveRouteIntercept();

    for (let i = 1; i < routes.length; i++) {
        ui.selectTrialRoute(routes[i].id);
        ui.setTrialActiveRouteSkip();
    }

    ui.finishTrialPlanning();
    ui.confirmTrialPlanning();
    ui.activateTrialPlan();

    const res = ui.startTrialBattle();
    assert.equal(res.success, true);
    assert.equal(ui.isTrialBattleActive(), true);
});


// --- Y. Advisor Foundation regression維持 ---
test("Y. Advisor Foundation regression維持", () => {
    
    execSync("node scratch/test_advisor_foundation.mjs", { stdio: "pipe" });
});

// --- Z. Settings regression維持 ---
test("Z. Settings regression維持", () => {
    
    execSync("node scratch/test_settings_modal_system.mjs", { stdio: "pipe" });
});

// --- AA. Phase 2.8A regression維持 ---
test("AA. Phase 2.8A regression維持", () => {
    
    execSync("node scratch/test_trial_phase28a_plan_activation.mjs", { stdio: "pipe" });
});

// --- AB. Phase 2.7C-F regression維持 ---
test("AB. Phase 2.7C-F regression維持", () => {
    
    execSync("node scratch/test_trial_phase27cf_final_review_confirm.mjs", { stdio: "pipe" });
});

console.log(`\nAll ${passed} Phase 2.8B tests passed!`);

