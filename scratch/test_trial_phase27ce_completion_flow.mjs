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
        const unregister = (node) => {
            if (node._id) elementRegistry.delete(node._id);
            for (const c of node.children) unregister(c);
        };
        for (const c of this.children) unregister(c);
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

console.log("⚔️ Starting Phase 2.7C-E Planning Completion Warning Flow Tests (A through R)...\n");

const engine = GameEngine.createGame();
const ui = new UIController(engine);

const startRes = ui.startDevelopmentTrialPreview("TERRAIN_COMPARE_BASIC");
assert.equal(startRes.success, true, "Development Trial Preview harness should start successfully");

const factHub = ui.trialController.gameFactHub;
assert.equal(factHub.facts.length, 0, "Initial facts should be 0");

const initialDefense = ui.getTrialAvailableDefense();
assert.equal(initialDefense, 20, "Initial available defense should be 20");

// A. 「迎撃計画を終了」ボタンが存在する
test("A. 「迎撃計画を終了」ボタンが存在する", () => {
    const btnFinish = document.getElementById("btnTrialFinishPlanning");
    assert.ok(btnFinish, "Finish Planning button should be in DOM");
});

// B. 未判断ルートが存在する場合、終了ボタンクリックで未判断warningが表示される
test("B. 未判断ルートが存在する場合、終了ボタンクリックで未判断warningが表示される", () => {
    // All 3 routes are currently undecided
    const finishRes = ui.finishTrialPlanning();
    assert.equal(finishRes.success, false, "Finish planning should not succeed directly with undecided routes");
    assert.equal(finishRes.warning, "ROUTES_UNDECIDED");
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, true);
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
});

// C. 未判断警告UI（#trialPlanWarningModal）が表示され、未判断件数が正しく表示される
test("C. 未判断警告UI（#trialPlanWarningModal）が表示され、未判断件数が正しく表示される", () => {
    const modal = document.getElementById("trialPlanWarningModal");
    assert.ok(modal, "Warning modal should be rendered in DOM");
    assert.equal(ui.trialPresentationState.planningWarningInfo.count, 3);
    const btnBack = document.getElementById("btnTrialWarningBack");
    const btnContinue = document.getElementById("btnTrialWarningContinue");
    assert.ok(btnBack, "Back button should exist in warning modal");
    assert.ok(btnContinue, "Continue button should exist in warning modal");
});

// D. 警告表示中の「戻る」（#btnTrialWarningBack）で警告モーダルが閉じる
test("D. 警告表示中の「戻る」（#btnTrialWarningBack）で警告モーダルが閉じる", () => {
    const backRes = ui.dismissTrialPlanningWarning();
    assert.equal(backRes.success, true);
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, false);
    const modal = document.getElementById("trialPlanWarningModal");
    assert.equal(modal, null, "Modal should no longer exist after dismiss");
});

// E. 「戻る」後も active route, Draft 状態, 選択中 cell は不変
test("E. 「戻る」後も active route, Draft 状態, 選択中 cell は不変", () => {
    assert.equal(ui.getActiveTrialRoute().id, "TERRAIN_COMPARE_ROUTE");
    const decision = ui.trialPresentationState.getRouteDecision("TERRAIN_COMPARE_ROUTE");
    assert.equal(decision.status, "UNDECIDED");
});

// F. 「戻る」後も planningReviewRequested === false
test("F. 「戻る」後も planningReviewRequested === false", () => {
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
});

// G. 「このまま進む」（#btnTrialWarningContinue）で reviewRequested === true
test("G. 「このまま進む」（#btnTrialWarningContinue）で reviewRequested === true", () => {
    // Re-trigger warning
    ui.finishTrialPlanning();
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, true);

    const proceedRes = ui.acceptTrialPlanningWarningAndProceed();
    assert.equal(proceedRes.success, true);
    assert.equal(proceedRes.reviewRequested, true);
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, false);
    assert.equal(ui.trialPresentationState.planningWarningsAccepted, true);
    assert.equal(ui.trialPresentationState.planningReviewRequested, true);
});

// H. 最重要: 「このまま進む」を実行しても UNDECIDED は SKIP に変換されない
test("H. 最重要: 「このまま進む」を実行しても UNDECIDED は SKIP に変換されない", () => {
    const routes = ui.getTrialPlanningRoutes();
    for (const r of routes) {
        const d = ui.trialPresentationState.getRouteDecision(r.id);
        assert.equal(d.status, "UNDECIDED", `Route ${r.id} must remain UNDECIDED and NOT auto-converted to SKIP`);
    }
});

// I. Review Requested 状態の確認中バナー（#trialPlanReviewRequestedBanner）と修正ボタンが表示される
test("I. Review Requested 状態の確認中バナー（#trialPlanReviewRequestedBanner）と修正ボタンが表示される", () => {
    const banner = document.getElementById("trialPlanReviewRequestedBanner");
    assert.ok(banner, "Review requested banner should be rendered");
    const btnModify = document.getElementById("btnTrialModifyPlan");
    assert.ok(btnModify, "Modify button should be rendered");
});

// J. 「計画を修正する」をクリックすると Review Requested 状態が解除される
test("J. 「計画を修正する」をクリックすると Review Requested 状態が解除される", () => {
    const clearRes = ui.clearTrialPlanningReviewRequest();
    assert.equal(clearRes.success, true);
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
    assert.equal(ui.trialPresentationState.planningWarningsAccepted, false);
    const banner = document.getElementById("trialPlanReviewRequestedBanner");
    assert.equal(banner, null, "Review banner should be removed");
});

// K. Review Requested 状態では Draft 変更が拒否され、「計画を修正する」経由で編集可能になる
test("K. Review Requested 状態では Draft 変更が拒否され、「計画を修正する」経由で編集可能になる", () => {
    // Put into review requested state again
    ui.finishTrialPlanning();
    ui.acceptTrialPlanningWarningAndProceed();
    assert.equal(ui.trialPresentationState.planningReviewRequested, true);

    // Phase 2.7C-F: Review中の裏編集は拒否される
    const skipRes = ui.setTrialActiveRouteSkip();
    assert.equal(skipRes.success, false);
    assert.equal(skipRes.reason, "REVIEW_REQUESTED");
    assert.equal(ui.trialPresentationState.planningReviewRequested, true);

    // 「計画を修正する」で戻った後に変更可能
    ui.clearTrialPlanningReviewRequest();
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
    const validSkip = ui.setTrialActiveRouteSkip();
    assert.equal(validSkip.success, true);
    assert.equal(ui.trialPresentationState.planningWarningsAccepted, false);
});

// L. 全ルート決定完了時は警告モーダルを経由せず直接 reviewRequested === true
test("L. 全ルート決定完了時は警告モーダルを経由せず直接 reviewRequested === true", () => {
    // Route 1 was skipped in K.
    // Route 2: intercept
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_EAST");
    ui.selectTrialInterceptionCell(2, 2);
    ui.setTrialDefenseAllocation(4);
    const res2 = ui.setTrialActiveRouteIntercept();
    assert.equal(res2.success, true);

    // Route 3: skip
    ui.selectTrialRoute("TERRAIN_COMPARE_ROUTE_SOUTH");
    const res3 = ui.setTrialActiveRouteSkip();
    assert.equal(res3.success, true);

    // All 3 routes are now decided (SKIP, INTERCEPT, SKIP)
    const finishRes = ui.finishTrialPlanning();
    assert.equal(finishRes.success, true, "Should succeed directly with all routes decided");
    assert.equal(finishRes.reviewRequested, true);
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, false, "No warning should be opened");
    assert.equal(ui.trialPresentationState.planningReviewRequested, true);
});

// M. 致命的エラー（Fatal Error）時は終了不可
test("M. 致命的エラー（Fatal Error）時は終了不可", () => {
    // Clear review requested first
    ui.clearTrialPlanningReviewRequest();

    // Cause a fatal error by manually inserting an overbudget draft
    ui.trialPresentationState.routePlanDrafts.set("TERRAIN_COMPARE_ROUTE", {
        routeId: "TERRAIN_COMPARE_ROUTE",
        status: "INTERCEPT",
        interceptCell: { r: 2, c: 1 },
        defenseAllocation: 999 // Over available defense 20!
    });

    const finishRes = ui.finishTrialPlanning();
    assert.equal(finishRes.success, false, "Finish planning must fail on fatal errors");
    assert.ok(finishRes.errors.includes("DEFENSE_BUDGET_EXCEEDED"));
});

// N. 致命的エラー時、エラーメッセージ領域（#trialPlanErrorsBox）に表示される
test("N. 致命的エラー時、エラーメッセージ領域（#trialPlanErrorsBox）に表示される", () => {
    const errorBox = document.getElementById("trialPlanErrorsBox");
    assert.ok(errorBox, "Error box should be rendered");
    assert.ok(ui.trialPresentationState.planningValidationErrors.length > 0);
});

// O. 致命的エラー時、planningReviewRequested は false、警告モーダルも開かない
test("O. 致命的エラー時、planningReviewRequested は false、警告モーダルも開かない", () => {
    assert.equal(ui.trialPresentationState.planningReviewRequested, false);
    assert.equal(ui.trialPresentationState.planningCompletionWarningOpen, false);
});

// P. 致命的エラー時、Draft の内容は改変されない
test("P. 致命的エラー時、Draft の内容は改変されない", () => {
    const draft = ui.trialPresentationState.routePlanDrafts.get("TERRAIN_COMPARE_ROUTE");
    assert.equal(draft.defenseAllocation, 999);
    // Fix the draft back
    ui.trialPresentationState.routePlanDrafts.set("TERRAIN_COMPARE_ROUTE", {
        routeId: "TERRAIN_COMPARE_ROUTE",
        status: "SKIP",
        interceptCell: null,
        defenseAllocation: 0
    });
});

// Q. 全フローを通じて GameFact の発行数は厳格に 0 件
test("Q. 全フローを通じて GameFact の発行数は厳格に 0 件", () => {
    assert.equal(factHub.facts.length, 0, "No new GameFacts should be emitted during planning completion flow");
});

// R. 全フローを通じて TrialState.interceptionPlan === null かつ human.availableDefense は不変
test("R. 全フローを通じて TrialState.interceptionPlan === null かつ human.availableDefense は不変", () => {
    assert.equal(ui.trialController.state.interceptionPlan, null, "TrialState.interceptionPlan must remain null");
    assert.equal(ui.trialController.state.human.availableDefense, initialDefense, "TrialState available defense must be untouched");
});

console.log(`\n🎉 All ${passed}/18 Phase 2.7C-E Planning Completion Flow Tests Passed!`);
