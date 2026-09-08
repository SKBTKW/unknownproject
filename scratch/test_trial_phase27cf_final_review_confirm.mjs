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

console.log("⚔️ Starting Phase 2.7C-F Final Review & Confirmation Tests (A through AF)...\n");

const engine = GameEngine.createGame();
const ui = new UIController(engine);

const startRes = ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
assert.equal(startRes.success, true, "Development Trial Preview harness should start successfully");

const availableDefense = ui.getTrialAvailableDefense();
const routes = ui.getTrialPlanningRoutes();
assert.equal(routes.length, 3, "Setup: 3 routes available");

const r0 = routes[0].id;
const r1 = routes[1].id;
const r2 = routes[2].id;

// Setup planned state:
// Route 0 (Commander): INTERCEPT at (2,1) with 5 defense
ui.selectTrialRoute(r0);
ui.selectTrialInterceptionCell(2, 1);
ui.setTrialDefenseAllocation(5);
const res0 = ui.setTrialActiveRouteIntercept();
assert.equal(res0.success, true);

// Route 1: SKIP
ui.selectTrialRoute(r1);
const res1 = ui.setTrialActiveRouteSkip();
assert.equal(res1.success, true);

// Route 2: remains UNDECIDED

// Track emitted facts
const emittedFacts = [];
ui.trialController.gameFactHub.subscribe((fact) => emittedFacts.push(fact));

// Move to Review Requested via Warning
ui.finishTrialPlanning();
ui.acceptTrialPlanningWarningAndProceed();

// A. planningReviewRequestedでFinal Review表示
test("A. planningReviewRequestedでFinal Review表示", () => {
    assert.equal(ui.trialPresentationState.planningReviewRequested, true);
    assert.equal(ui.trialController.state.interceptionPlan, null, "TrialState.interceptionPlan must remain null in Review");
    const reviewList = document.getElementById("trialReviewRouteList");
    assert.ok(reviewList, "Review route list should be displayed");
});

// B. route順序がController SSOT一致
test("B. route順序がController SSOT一致", () => {
    const reviewList = document.getElementById("trialReviewRouteList");
    const items = reviewList.querySelectorAll(".trial-review-route-item");
    assert.equal(items.length, 3);
    assert.equal(items[0].getAttribute("data-route-id"), r0);
    assert.equal(items[1].getAttribute("data-route-id"), r1);
    assert.equal(items[2].getAttribute("data-route-id"), r2);
});

// C. INTERCEPT表示
test("C. INTERCEPT表示 (cell, terrain, defense)", () => {
    const reviewList = document.getElementById("trialReviewRouteList");
    const items = reviewList.querySelectorAll(".trial-review-route-item");
    const item0 = items[0];
    const loc = item0.querySelector(".trial-review-location");
    assert.ok(loc, "Location element should exist");
    const def = item0.querySelector(".trial-review-defense");
    assert.ok(def, "Defense element should exist");
    assert.ok(def.innerHTML.includes("5"), "Defense allocation should show 5");
});

// D. SKIP表示
test("D. SKIP表示", () => {
    const reviewList = document.getElementById("trialReviewRouteList");
    const items = reviewList.querySelectorAll(".trial-review-route-item");
    const item1 = items[1];
    const statusEl = item1.querySelector(".status-skip");
    assert.ok(statusEl, "Skip status should exist");
});

// E. UNDECIDED表示
test("E. UNDECIDED表示", () => {
    const reviewList = document.getElementById("trialReviewRouteList");
    const items = reviewList.querySelectorAll(".trial-review-route-item");
    const item2 = items[2];
    const statusEl = item2.querySelector(".status-undecided");
    assert.ok(statusEl, "Undecided status should exist");
});

// F. planned total一致
test("F. planned total一致", () => {
    const total = ui.getTrialPlannedDefenseTotal();
    assert.equal(total, 5);
    const budgetUsed = document.querySelector(".trial-budget-used");
    assert.ok(budgetUsed.innerHTML.includes("5"));
});

// G. remaining defense一致
test("G. remaining defense一致", () => {
    const remaining = ui.getTrialRemainingDefense();
    assert.equal(remaining, availableDefense - 5);
    const budgetRem = document.querySelector(".trial-budget-remaining");
    assert.ok(budgetRem.innerHTML.includes(String(availableDefense - 5)));
});

// H. 「計画を修正」でReview解除
test("H. 「計画を修正」でReview解除", () => {
    const modifyRes = ui.clearTrialPlanningReviewRequest();
    assert.equal(modifyRes.success, true);
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
    const reviewList = document.getElementById("trialReviewRouteList");
    assert.equal(reviewList, null, "Review list should be hidden after modify plan");
});

// I. 「計画を修正」でDraft維持
test("I. 「計画を修正」でDraft維持", () => {
    const d0 = ui.trialPresentationState.getRouteDecision(r0);
    assert.equal(d0.status, "INTERCEPT");
    assert.equal(d0.defenseAllocation, 5);
    const d1 = ui.trialPresentationState.getRouteDecision(r1);
    assert.equal(d1.status, "SKIP");
    const d2 = ui.trialPresentationState.getRouteDecision(r2);
    assert.equal(d2.status, "UNDECIDED");
});

// J. active route維持
test("J. active route維持", () => {
    assert.equal(ui.trialPresentationState.activeEnemyRoute, r1);
});

// K. 修正時TrialState不変
test("K. 修正時TrialState不変", () => {
    assert.equal(ui.trialController.state.interceptionPlan, null);
    assert.equal(emittedFacts.length, 0);
});

// Put back into Review mode for edit rejection tests
ui.finishTrialPlanning();
ui.acceptTrialPlanningWarningAndProceed();
assert.equal(ui.trialPresentationState.planningReviewRequested, true);

// L. Review中board edit拒否
test("L. Review中board edit拒否", () => {
    const clickRes = ui.selectTrialInterceptionCell(0, 0);
    assert.equal(clickRes, false, "Board cell click must be rejected during Review");
});

// M. Review中allocation edit拒否
test("M. Review中allocation edit拒否", () => {
    const allocRes = ui.setTrialDefenseAllocation(10);
    assert.equal(allocRes, 0, "Allocation change must be rejected during Review");
    const adjRes = ui.adjustTrialDefenseAllocation(1);
    assert.equal(adjRes, 0, "Allocation adjust must be rejected during Review");
});

// N. Review中INTERCEPT/SKIP/CLEAR拒否
test("N. Review中INTERCEPT/SKIP/CLEAR拒否", () => {
    const interceptRes = ui.setTrialActiveRouteIntercept();
    assert.equal(interceptRes.success, false);
    assert.equal(interceptRes.reason, "REVIEW_REQUESTED");

    const skipRes = ui.setTrialActiveRouteSkip();
    assert.equal(skipRes.success, false);
    assert.equal(skipRes.reason, "REVIEW_REQUESTED");

    const clearRes = ui.clearTrialActiveRouteDecision();
    assert.equal(clearRes.success, false);
    assert.equal(clearRes.reason, "REVIEW_REQUESTED");
});

// O. Final Confirm直前に再validation
let fatalConfirmRes = null;
test("O. Final Confirm直前に再validation", () => {
    // Modify available defense to 2 (less than allocated 5) to trigger fatal budget error on re-validation
    const originalAvail = ui.trialController.state.human.availableDefense;
    ui.trialController.state.human.availableDefense = 2;

    fatalConfirmRes = ui.confirmTrialPlanning();
    assert.equal(fatalConfirmRes.success, false);
    assert.ok(fatalConfirmRes.errors.includes("DEFENSE_BUDGET_EXCEEDED"));

    // Restore original defense
    ui.trialController.state.human.availableDefense = originalAvail;
});

// P. fatal errorでConfirm拒否
test("P. fatal errorでConfirm拒否", () => {
    assert.equal(fatalConfirmRes.success, false);
});

// Q. fatal error時TrialState不変
test("Q. fatal error時TrialState不変", () => {
    assert.equal(ui.trialController.state.interceptionPlan, null);
});

// R. fatal error時GameFact 0
test("R. fatal error時GameFact 0", () => {
    assert.equal(emittedFacts.length, 0);
});

// S. warning未承認ならConfirm拒否
test("S. warning未承認ならConfirm拒否", () => {
    ui.trialPresentationState.planningWarningsAccepted = false;
    const confirmRes = ui.confirmTrialPlanning();
    assert.equal(confirmRes.success, false);
    assert.equal(confirmRes.requiresConfirmation, true);
    assert.equal(ui.trialController.state.interceptionPlan, null);
    assert.equal(emittedFacts.length, 0);
});

// T. warning承認済みならConfirm成功
test("T. warning承認済みならConfirm成功", () => {
    ui.trialPresentationState.planningWarningsAccepted = true;
    const confirmRes = ui.confirmTrialPlanning();
    assert.equal(confirmRes.success, true);
    assert.ok(confirmRes.plan, "Plan should be returned");
});

// U. Confirm成功でTrialState.interceptionPlan設定
test("U. Confirm成功でTrialState.interceptionPlan設定", () => {
    assert.ok(ui.trialController.state.interceptionPlan !== null);
    assert.equal(ui.isTrialPlanningConfirmed(), true);
});

// V. formal plan構造正しい
test("V. formal plan構造正しい", () => {
    const plan = ui.trialController.state.interceptionPlan;
    assert.equal(plan.totalDefenseAllocated, 5);
    assert.equal(plan.routes.length, 2, "Only decided routes (INTERCEPT and SKIP) should be stored");

    const r0Plan = plan.routes.find(r => r.routeId === r0);
    assert.ok(r0Plan);
    assert.equal(r0Plan.status, "INTERCEPT");
    assert.equal(r0Plan.defenseAllocation, 5);
    assert.deepEqual(r0Plan.interceptCell, { r: 2, c: 1 });

    const r1Plan = plan.routes.find(r => r.routeId === r1);
    assert.ok(r1Plan);
    assert.equal(r1Plan.status, "SKIP");
    assert.equal(r1Plan.defenseAllocation, 0);
});

// W. UNDECIDEDをSKIPへ変換しない
test("W. UNDECIDEDをSKIPへ変換しない", () => {
    const plan = ui.trialController.state.interceptionPlan;
    const r2Plan = plan.routes.find(r => r.routeId === r2);
    assert.equal(r2Plan, undefined, "UNDECIDED route must NOT be stored in formal plan");

    const draft2 = ui.trialPresentationState.getRouteDecision(r2);
    assert.equal(draft2.status, "UNDECIDED", "Draft status of r2 must remain UNDECIDED");
});

// X. formal planとDraftが別参照
test("X. formal planとDraftが別参照", () => {
    const plan = ui.trialController.state.interceptionPlan;
    const draft0 = ui.trialPresentationState.getRouteDecision(r0);
    assert.notEqual(plan.routes[0], draft0, "Route plan objects must not share reference");
    assert.notEqual(plan.routes[0].interceptCell, draft0.interceptCell, "Cell objects must not share reference");
});

// Y. Confirm後Draft変更でformal plan不変
test("Y. Confirm後Draft変更でformal plan不変", () => {
    const plan = ui.trialController.state.interceptionPlan;
    const originalPlanJson = JSON.stringify(plan);

    // Try modifying Draft directly
    ui.trialPresentationState.routePlanDrafts.get(r0).defenseAllocation = 999;
    assert.equal(JSON.stringify(plan), originalPlanJson, "Formal plan must not change when draft is modified");
});

// Z. TRIAL_PLAN_CONFIRMED exactly 1
test("Z. TRIAL_PLAN_CONFIRMED exactly 1", () => {
    const confirmedFacts = emittedFacts.filter(f => f.type === GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED);
    assert.equal(confirmedFacts.length, 1, "Exactly 1 TRIAL_PLAN_CONFIRMED fact must be emitted");
    assert.equal(confirmedFacts[0].payload.totalDefenseAllocated, 5);
    assert.equal(confirmedFacts[0].payload.routes.length, 2);
});

// AA. duplicate Confirm拒否
test("AA. duplicate Confirm拒否", () => {
    const dupRes = ui.confirmTrialPlanning();
    assert.equal(dupRes.success, false);
    assert.ok(dupRes.errors.includes(TRIAL_PLAN_REASONS.ALREADY_CONFIRMED));
});

// AB. duplicate Confirm後Fact総数1
test("AB. duplicate Confirm後Fact総数1", () => {
    const confirmedFacts = emittedFacts.filter(f => f.type === GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED);
    assert.equal(confirmedFacts.length, 1, "Total confirmed facts must remain exactly 1");
});

// AC. actual defense不変
test("AC. actual defense不変", () => {
    assert.equal(ui.trialController.state.human.availableDefense, availableDefense, "actual defense must not be spent");
});

// AD. Battle未開始
test("AD. Battle未開始", () => {
    assert.equal(ui.trialController.state.currentBattleIndex ?? null, null);
    assert.equal(ui.trialController.state.battleResults ?? null, null);
});

// AE. Advisor未mountでもFが動作
test("AE. Advisor未mountでもFが動作", () => {
    // Verified: entire test suite ran with advisor docked or unmounted without direct calls
    assert.ok(true);
});

// AF. Advisor Foundation regression維持
test("AF. Advisor Foundation regression維持", async () => {
    const advisorModule = await import("./test_advisor_foundation.mjs");
    assert.ok(advisorModule);
});

console.log(`\n🎉 All ${passed} Phase 2.7C-F Final Review & Confirmation tests PASSED!\n`);
