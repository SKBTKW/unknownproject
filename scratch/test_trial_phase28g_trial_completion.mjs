import assert from "node:assert/strict";
import {
    GameEngine,
    UIController,
    TrialCompletionService,
    TRIAL_PLAN_REASONS,
    TRIAL_BATTLE_STATUSES,
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
                    const attrRegex = /([a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi;
                    let am;
                    while ((am = attrRegex.exec(attrs)) !== null) {
                        const aname = am[1].toLowerCase();
                        if (aname !== "id" && aname !== "class") {
                            child.attributes[aname] = am[2] !== undefined ? am[2] : "";
                        }
                    }
                }
                stack[stack.length - 1].children.push(child);
                if (!voidTags.has(tagName.toLowerCase()) && !full.endsWith("/>")) {
                    stack.push(child);
                }
            }
        }
    }

    get innerText() {
        if (this._innerText) return this._innerText;
        return this.children.map(c => c.innerText).join(" ");
    }
    set innerText(v) {
        this._innerText = String(v);
        this._innerHTML = String(v);
        this.children = [];
    }

    setAttribute(name, val) {
        this.attributes[name] = String(val);
        if (name === "id") this.id = String(val);
        if (name === "class") this.className = String(val);
    }
    getAttribute(name) {
        if (name === "id") return this.id || null;
        if (name === "class") return this.className || null;
        return this.attributes[name] !== undefined ? this.attributes[name] : null;
    }
    hasAttribute(name) {
        if (name === "id") return Boolean(this.id);
        if (name === "class") return Boolean(this.className);
        return this.attributes[name] !== undefined;
    }
    removeAttribute(name) {
        delete this.attributes[name];
    }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
    querySelector(sel) {
        const results = this.querySelectorAll(sel);
        return results.length > 0 ? results[0] : null;
    }
    querySelectorAll(sel) {
        const matched = [];
        const matchElement = (el) => {
            if (sel.startsWith("#")) {
                if (el.id === sel.slice(1)) matched.push(el);
            } else if (sel.startsWith(".")) {
                if (el.classList.contains(sel.slice(1))) matched.push(el);
            } else {
                if (el.tagName.toLowerCase() === sel.toLowerCase()) matched.push(el);
            }
            for (const c of el.children) matchElement(c);
        };
        for (const c of this.children) matchElement(c);
        return matched;
    }
    click() {
        if (this.disabled) return;
        if (typeof this.onclick === "function") this.onclick({ currentTarget: this });
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

/**
 * Setup test harness where all routes are resolved and transitioned.
 * If allIntercept is true, sets up interception for all 3 routes.
 */
function createCompletedHarness({
    allIntercept = true,
    defenseAllocPerRoute = [6, 6, 6],
    initialEmber = 20,
    simulateRouteEndDamage = false
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

    if (allIntercept) {
        // Intercept all routes
        for (let i = 0; i < routes.length; i++) {
            const r = routes[i];
            const interceptCell = simulateRouteEndDamage
                ? r.cells[r.cells.length - 1]
                : (r.cells[1] || r.cells[0]);
            const alloc = defenseAllocPerRoute[i] !== undefined ? defenseAllocPerRoute[i] : 10;
            ui.selectTrialRoute(r.id);
            ui.selectTrialInterceptionCell(interceptCell.r, interceptCell.c);
            ui.setTrialDefenseAllocation(alloc);
            ui.setTrialActiveRouteIntercept();
        }
    } else {
        // First route INTERCEPT, remaining SKIP
        ui.selectTrialRoute(routes[0].id);
        ui.selectTrialInterceptionCell(routes[0].cells[1].r, routes[0].cells[1].c);
        ui.setTrialDefenseAllocation(10);
        ui.setTrialActiveRouteIntercept();

        for (let i = 1; i < routes.length; i++) {
            ui.selectTrialRoute(routes[i].id);
            ui.setTrialActiveRouteSkip();
        }
    }

    const finishRes = ui.finishTrialPlanning();
    assert.equal(finishRes.success, true, "Setup finishTrialPlanning");
    const confirmRes = ui.confirmTrialPlanning();
    assert.equal(confirmRes.success, true, "Setup confirmTrialPlanning");
    const actRes = ui.activateTrialPlan();
    assert.equal(actRes.success, true, "Setup activateTrialPlan");

    const battleCount = ui.getTrialBattleQueue()?.length || 0;

    // Process all battles
    for (let i = 0; i < battleCount; i++) {
        const startRes = ui.trialController.startNextBattle();
        assert.equal(startRes.success, true, `Battle ${i}: startNextBattle`);
        const resolveRes = ui.trialController.resolveCurrentBattle();
        assert.equal(resolveRes.success, true, `Battle ${i}: resolveCurrentBattle`);
        const advRes = ui.trialController.advanceAfterCurrentBattle();
        assert.equal(advRes.success, true, `Battle ${i}: advanceAfterCurrentBattle`);

        if (advRes.traversalResult?.reachedRouteEnd) {
            const dmgRes = ui.trialController.resolveRouteEndDamage(advRes.traversalResult.battleIndex);
            assert.equal(dmgRes.success, true, `Battle ${i}: resolveRouteEndDamage`);
        }

        const transRes = ui.trialController.transitionAfterCurrentBattle();
        assert.equal(transRes.success, true, `Battle ${i}: transitionAfterCurrentBattle`);
    }

    return { engine, ui, routes, battleCount };
}

console.log("=== Phase 2.8G Trial Completion Comprehensive Test Suite ===");

// 1. Pure Unit Tests for TrialCompletionService
test("1.1 TrialCompletionService validates trial unstarted or missing state", () => {
    const service = new TrialCompletionService();
    const resNull = service.validateCompletion(null);
    assert.equal(resNull.success, false);
    assert.equal(resNull.reason, TRIAL_PLAN_REASONS.TRIAL_NOT_STARTED);
});

test("1.2 TrialCompletionService validates plan not activated", () => {
    const service = new TrialCompletionService();
    const res = service.validateCompletion({ planActivated: false });
    assert.equal(res.success, false);
    assert.equal(res.reason, TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED);
});

test("1.3 TrialCompletionService blocks if active battle exists", () => {
    const service = new TrialCompletionService();
    const res = service.validateCompletion({
        planActivated: true,
        interceptionPlan: { routes: [] },
        currentBattleIndex: 0
    });
    assert.equal(res.success, false);
    assert.equal(res.reason, TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);
});

test("1.4 TrialCompletionService blocks if unresolved SKIP route exists (temporary safety)", () => {
    const service = new TrialCompletionService();
    const res = service.validateCompletion({
        planActivated: true,
        currentBattleIndex: null,
        interceptionPlan: {
            routes: [
                { routeId: "r1", status: "INTERCEPT" },
                { routeId: "r2", status: "SKIP" }
            ]
        },
        battleQueue: [{
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            traversalApplied: true,
            sequenceAdvanced: true
        }],
        traversalResults: [{ reachedRouteEnd: false }]
    });
    assert.equal(res.success, false);
    assert.equal(res.reason, TRIAL_PLAN_REASONS.UNRESOLVED_SKIPPED_ROUTE);
});

test("1.5 TrialCompletionService blocks if battleQueue has unresolved, un-traversed, or un-advanced battle", () => {
    const service = new TrialCompletionService();

    // PENDING battle
    const resPending = service.validateCompletion({
        planActivated: true,
        currentBattleIndex: null,
        interceptionPlan: { routes: [{ status: "INTERCEPT" }] },
        battleQueue: [{ status: TRIAL_BATTLE_STATUSES.PENDING }]
    });
    assert.equal(resPending.success, false);
    assert.equal(resPending.reason, TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);

    // Missing traversal
    const resNoTrav = service.validateCompletion({
        planActivated: true,
        currentBattleIndex: null,
        interceptionPlan: { routes: [{ status: "INTERCEPT" }] },
        battleQueue: [{
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            traversalApplied: false
        }],
        traversalResults: []
    });
    assert.equal(resNoTrav.success, false);
    assert.equal(resNoTrav.reason, TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);

    // Missing sequenceAdvanced
    const resNoSeq = service.validateCompletion({
        planActivated: true,
        currentBattleIndex: null,
        interceptionPlan: { routes: [{ status: "INTERCEPT" }] },
        battleQueue: [{
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            traversalApplied: true,
            sequenceAdvanced: false
        }],
        traversalResults: [{ reachedRouteEnd: false }]
    });
    assert.equal(resNoSeq.success, false);
    assert.equal(resNoSeq.reason, TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);
});

test("1.6 TrialCompletionService blocks if routeEnd reached but damage not applied", () => {
    const service = new TrialCompletionService();
    const resNoDmg = service.validateCompletion({
        planActivated: true,
        currentBattleIndex: null,
        interceptionPlan: { routes: [{ status: "INTERCEPT" }] },
        battleQueue: [{
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            traversalApplied: true,
            sequenceAdvanced: true,
            damageApplied: false
        }],
        traversalResults: [{ reachedRouteEnd: true }],
        damageResults: []
    });
    assert.equal(resNoDmg.success, false);
    assert.equal(resNoDmg.reason, TRIAL_PLAN_REASONS.INCOMPLETE_DAMAGE);
});

test("1.7 TrialCompletionService blocks double completion", () => {
    const service = new TrialCompletionService();
    const resAlready = service.validateCompletion({
        trialCompleted: true,
        planActivated: true
    });
    assert.equal(resAlready.success, false);
    assert.equal(resAlready.reason, TRIAL_PLAN_REASONS.TRIAL_ALREADY_COMPLETED);
});

// 2. Integration Tests via TrialController
test("2.1 TrialController all-INTERCEPT complete trial with SURVIVED outcome", () => {
    const { ui, battleCount } = createCompletedHarness({
        allIntercept: true,
        defenseAllocPerRoute: [6, 6, 6],
        initialEmber: 20
    });

    assert.equal(ui.trialController.canCompleteTrial(), true, "canCompleteTrial should be true");
    assert.equal(ui.trialController.isTrialCompleted(), false, "isTrialCompleted initially false");

    const compRes = ui.trialController.completeTrial();
    assert.equal(compRes.success, true);
    assert.equal(compRes.result.completed, true);
    assert.equal(compRes.result.outcome, TRIAL_COMPLETION_OUTCOMES.SURVIVED);
    assert.equal(compRes.result.emberRemaining, 20);
    assert.equal(compRes.result.battleCount, battleCount);
    assert.equal(compRes.result.resolvedBattleCount, battleCount);
    assert.equal(compRes.result.totalEmberDamage, 0);

    // State check
    assert.equal(ui.trialController.isTrialCompleted(), true);
    assert.equal(ui.trialController.state.trialCompleted, true);
    assert.equal(ui.trialController.state.phase, "RESULT");

    // GameFact check
    const compFacts = ui.trialController.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_COMPLETED);
    assert.equal(compFacts.length, 1, "Exactly 1 TRIAL_COMPLETED GameFact emitted");
    assert.equal(compFacts[0].payload.outcome, TRIAL_COMPLETION_OUTCOMES.SURVIVED);
    assert.equal(compFacts[0].payload.emberRemaining, 20);
});

test("2.2 TrialController all-INTERCEPT complete trial with FAILED outcome when ember === 0", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        defenseAllocPerRoute: [1, 1, 1],
        initialEmber: 1,
        simulateRouteEndDamage: true
    });

    // Verify ember is 0
    assert.equal(ui.trialController.state.ember, 0);

    assert.equal(ui.trialController.canCompleteTrial(), true);

    const compRes = ui.trialController.completeTrial();
    assert.equal(compRes.success, true);
    assert.equal(compRes.result.outcome, TRIAL_COMPLETION_OUTCOMES.FAILED);
    assert.equal(compRes.result.emberRemaining, 0);
    assert.ok(compRes.result.totalEmberDamage > 0);
});

test("2.3 TrialController rejects completion if SKIP route exists (safety gate)", () => {
    const { ui } = createCompletedHarness({
        allIntercept: false,
        initialEmber: 20
    });

    assert.equal(ui.trialController.canCompleteTrial(), false);
    const compRes = ui.trialController.completeTrial();
    assert.equal(compRes.success, false);
    assert.equal(compRes.errors[0], TRIAL_PLAN_REASONS.UNRESOLVED_SKIPPED_ROUTE);
});

test("2.4 TrialController rejects second call to completeTrial (Idempotency / Guard)", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        initialEmber: 20
    });

    const first = ui.trialController.completeTrial();
    assert.equal(first.success, true);

    const second = ui.trialController.completeTrial();
    assert.equal(second.success, false);
    assert.equal(second.errors[0], TRIAL_PLAN_REASONS.TRIAL_ALREADY_COMPLETED);
});

test("2.5 TrialController outcome immutability and state snapshot defense", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        initialEmber: 20
    });

    const res = ui.trialController.completeTrial();
    assert.equal(res.success, true);

    // Mutate returned object
    res.result.outcome = "TAMPERED";
    res.result.emberRemaining = 999;

    const storedResult = ui.trialController.getTrialResult();
    assert.equal(storedResult.outcome, TRIAL_COMPLETION_OUTCOMES.SURVIVED);
    assert.equal(storedResult.emberRemaining, 20);
});

test("2.6 Precondition check order: Ember 0 cannot bypass incomplete battles", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        initialEmber: 20
    });

    // Force ember to 0, but set one battle back to PENDING
    ui.trialController.state.ember = 0;
    ui.trialController.state.battleQueue[0].status = TRIAL_BATTLE_STATUSES.PENDING;

    assert.equal(ui.trialController.canCompleteTrial(), false);
    const res = ui.trialController.completeTrial();
    assert.equal(res.success, false);
    assert.equal(res.errors[0], TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES);
});

// 3. UI Component Tests
test("3.1 UI displays Complete Trial button when all battles resolved and canCompleteTrial()", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        initialEmber: 20
    });

    ui.render();
    const btnComplete = mockDoc.getElementById("btnTrialCompleteTrial");
    assert.ok(btnComplete, "#btnTrialCompleteTrial must be rendered");

    // Click Complete Trial button
    btnComplete.click();

    // Verify trial completed
    assert.equal(ui.isTrialCompleted(), true);
    assert.equal(ui.trialController.state.phase, "RESULT");

    // Verify completion banner rendered
    ui.render();
    const banner = mockDoc.getElementById("trialCompletedBanner");
    assert.ok(banner, "#trialCompletedBanner must be rendered after completion");
    assert.ok(banner.classList.contains("trial-completed-survived"));
});

test("3.2 UI displays FAILED banner when completed with Ember 0", () => {
    const { ui } = createCompletedHarness({
        allIntercept: true,
        defenseAllocPerRoute: [1, 1, 1],
        initialEmber: 1,
        simulateRouteEndDamage: true
    });

    assert.equal(ui.trialController.state.ember, 0);
    ui.render();

    const btnComplete = mockDoc.getElementById("btnTrialCompleteTrial");
    assert.ok(btnComplete);
    btnComplete.click();

    assert.equal(ui.isTrialCompleted(), true);
    ui.render();

    const banner = mockDoc.getElementById("trialCompletedBanner");
    assert.ok(banner);
    assert.ok(banner.classList.contains("trial-completed-failed"));
});

test("3.3 UI does not show Complete Trial button when SKIP route exists", () => {
    const { ui } = createCompletedHarness({
        allIntercept: false,
        initialEmber: 20
    });

    ui.render();
    const btnComplete = mockDoc.getElementById("btnTrialCompleteTrial");
    assert.equal(btnComplete, null, "Complete Trial button must NOT render with SKIP route");
});

console.log(`\nAll ${passed} Phase 2.8G Trial Completion tests passed successfully!`);
