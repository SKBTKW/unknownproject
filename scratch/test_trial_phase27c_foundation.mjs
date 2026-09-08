import assert from "node:assert/strict";
import {
    GAME_FACT_TYPES,
    GAME_FEEL,
    GameFactHub,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES,
    TrialPlanningDraftService
} from "../game/src/app.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TrialPresentationState } from "../game/src/trial/presentation/trial_presentation_state.js";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

const terrain = (id, e = 1, gl = 1) => ({ id, terrainId: id, e, gl });
const plains = terrain("GL1_PLAINS");
const hill = terrain("E2_HILL", 2, 1);
const wetland = terrain("E0_WETLAND", 0, 1);
const makeCell = (r, c, value, placementGroupId) => ({
    r, c, placed: true, isHQ: false, terrain: value, placementGroupId
});

function createFixture() {
    const cells = new Map([
        ["0:0", makeCell(0, 0, plains, "BLOCK_A")],
        ["0:1", makeCell(0, 1, plains, "BLOCK_A")],
        ["0:2", makeCell(0, 2, plains, "BLOCK_B")],
        ["1:0", makeCell(1, 0, hill, "BLOCK_C")],
        ["1:1", makeCell(1, 1, wetland, "BLOCK_D")],
        ["1:2", makeCell(1, 2, plains, "BLOCK_E")]
    ]);
    const gameFactHub = new GameFactHub();
    const controller = new TrialController({ gameFactHub });
    controller.startScenario({
        id: "PHASE_27C",
        enemySuppression: 14,
        availableDefense: 12,
        routes: [
            { id: "R_LOW", suppression: 4, cells: [{ r: 0, c: 0 }, { r: 0, c: 2 }] },
            { id: "R_COMMANDER", isCommanderRoute: true, suppression: 1, cells: [{ r: 0, c: 1 }, { r: 1, c: 0 }] },
            { id: "R_HIGH", suppression: 8, cells: [{ r: 1, c: 2 }, { r: 1, c: 1 }] }
        ]
    }, { cellResolver: (r, c) => cells.get(`${r}:${c}`) || null });
    const presentation = new TrialPresentationState();
    return { controller, gameFactHub, presentation, cells };
}

console.log("🧭 Trial Phase 2.7C Foundation Responsibility Fix tests");

// A. TrialStateにplannedInterceptionsが存在しない
test("A. TrialStateにplannedInterceptionsが存在しない", () => {
    const { controller } = createFixture();
    assert.equal(controller.state.plannedInterceptions, undefined);
    assert.equal("plannedInterceptions" in controller.state, false);
});

// B. TrialState.interceptionPlan初期値は未確定
test("B. TrialState.interceptionPlan初期値は未確定 (null)", () => {
    const { controller } = createFixture();
    assert.equal(controller.state.interceptionPlan, null);
});

// C. routePlanDraftsはPresentation側に存在
test("C. routePlanDraftsはPresentation側に存在", () => {
    const { presentation } = createFixture();
    assert.ok(presentation.routePlanDrafts instanceof Map);
    assert.equal(presentation.routePlanDrafts.size, 0);
});

// D. INTERCEPT Draft保存 → TrialState不変
test("D. INTERCEPT Draft保存 → TrialState不変", () => {
    const { controller, presentation } = createFixture();
    const stateSnapshotBefore = JSON.stringify(controller.state);
    const result = controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    assert.equal(result.success, true);
    assert.equal(presentation.routePlanDrafts.size, 1);
    assert.equal(JSON.stringify(controller.state), stateSnapshotBefore);
});

// E. SKIP Draft保存 → TrialState不変
test("E. SKIP Draft保存 → TrialState不変", () => {
    const { controller, presentation } = createFixture();
    const stateSnapshotBefore = JSON.stringify(controller.state);
    const result = controller.setRouteSkipped(presentation.routePlanDrafts, "R_LOW");
    assert.equal(result.success, true);
    assert.equal(result.plan.status, TRIAL_ROUTE_PLAN_STATUSES.SKIP);
    assert.equal(presentation.routePlanDrafts.size, 1);
    assert.equal(JSON.stringify(controller.state), stateSnapshotBefore);
});

// F. Draft変更時GameFact = 0
test("F. Draft変更時GameFact = 0", () => {
    const { controller, gameFactHub, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteSkipped(presentation.routePlanDrafts, "R_COMMANDER");
    assert.equal(gameFactHub.getFacts().length, 0);
});

// G. clearDecisionでDraftのみ変更
test("G. clearDecisionでDraftのみ変更しTrialState不変", () => {
    const { controller, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    assert.equal(presentation.routePlanDrafts.size, 1);
    const stateSnapshot = JSON.stringify(controller.state);
    controller.clearRouteDecision(presentation.routePlanDrafts, "R_LOW");
    assert.equal(presentation.routePlanDrafts.size, 0);
    assert.equal(JSON.stringify(controller.state), stateSnapshot);
});

// H. UNDECIDEDあり → valid true → warningsにROUTES_UNDECIDED
test("H. UNDECIDEDあり → valid true → warningsにROUTES_UNDECIDED", () => {
    const { controller, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    const validation = controller.validatePlanningDraft(presentation.routePlanDrafts);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);
    assert.deepEqual(validation.warnings, ["ROUTES_UNDECIDED"]);
});

// I. fatal errorあり → valid false → errorsにreason
test("I. fatal errorあり → valid false → errorsにreason", () => {
    const { controller, presentation } = createFixture();
    // DEFENSE_BUDGET_EXCEEDED (available is 12)
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 8);
    // Over budget attempt via service/draft
    presentation.routePlanDrafts.set("R_COMMANDER", {
        routeId: "R_COMMANDER",
        status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
        interceptCell: { r: 1, c: 0 },
        interceptBlockId: "placement:BLOCK_C",
        defenseAllocation: 10
    });
    const validation = controller.validatePlanningDraft(presentation.routePlanDrafts);
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes(TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED));
});

// J. Confirm前GameFactなし
test("J. Confirm前GameFactなし", () => {
    const { controller, gameFactHub, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteSkipped(presentation.routePlanDrafts, "R_COMMANDER");
    presentation.selectInterceptCell({ r: 0, c: 0 });
    presentation.setHoveredCell({ r: 0, c: 1 });
    assert.equal(gameFactHub.getFacts().length, 0);
});

// K. Confirm warning未承認 → requiresConfirmation
test("K. Confirm warning未承認 → requiresConfirmation", () => {
    const { controller, gameFactHub, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    // R_HIGH is still UNDECIDED -> triggers warning
    const result = controller.confirmInterceptionPlan(presentation.routePlanDrafts, { allowWarnings: false });
    assert.equal(result.success, false);
    assert.equal(result.requiresConfirmation, true);
    assert.deepEqual(result.warnings, ["ROUTES_UNDECIDED"]);
    assert.equal(controller.state.interceptionPlan, null);
    assert.equal(gameFactHub.getFacts().length, 0);
});

// L. Confirm warning承認後 → TrialState.interceptionPlanへcopy
test("L. Confirm warning承認後 → TrialState.interceptionPlanへcopy", () => {
    const { controller, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    const result = controller.confirmInterceptionPlan(presentation.routePlanDrafts, { allowWarnings: true });
    assert.equal(result.success, true);
    assert.ok(controller.state.interceptionPlan != null);
    assert.equal(controller.state.interceptionPlan.totalDefenseAllocated, 7);
    assert.equal(controller.state.interceptionPlan.routes.length, 2);
    assert.equal(controller.state.interceptionPlan.routes[0].routeId, "R_LOW");
    assert.equal(controller.state.interceptionPlan.routes[1].routeId, "R_COMMANDER");
});

// M. Confirm成功 → TRIAL_PLAN_CONFIRMED 1件
test("M. Confirm成功 → TRIAL_PLAN_CONFIRMED 1件", () => {
    const { controller, gameFactHub, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    controller.setRouteSkipped(presentation.routePlanDrafts, "R_HIGH");
    const result = controller.confirmInterceptionPlan(presentation.routePlanDrafts);
    assert.equal(result.success, true);
    const facts = gameFactHub.getFacts();
    assert.equal(facts.length, 1);
    assert.equal(facts[0].type, GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED);
    assert.equal(facts[0].payload.totalDefenseAllocated, 7);
    assert.equal(facts[0].payload.routes.length, 3);
});

// N. Confirm後もactual defense resource不変
test("N. Confirm後もactual defense resource不変 (実🛡未消費)", () => {
    const { controller, presentation } = createFixture();
    const defenseBefore = controller.state.human.availableDefense;
    assert.equal(defenseBefore, 12);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    controller.setRouteSkipped(presentation.routePlanDrafts, "R_HIGH");
    controller.confirmInterceptionPlan(presentation.routePlanDrafts);
    assert.equal(controller.state.human.availableDefense, defenseBefore);
    assert.equal(controller.state.human.defense, defenseBefore);
});

// O. Presentation hover/preview stateはTrialStateへ入らない
test("O. Presentation hover/preview stateはTrialStateへ入らない", () => {
    const { controller, presentation } = createFixture();
    presentation.selectInterceptCell({ r: 0, c: 0 });
    presentation.setHoveredCell({ r: 0, c: 2 });
    presentation.setPreviewDefenseAllocation(5, 12);
    presentation.setActiveEnemyRoute("R_LOW");
    assert.equal(controller.state.selectedInterceptCell, undefined);
    assert.equal(controller.state.hoveredCell, undefined);
    assert.equal(controller.state.previewDefenseAllocation, undefined);
    assert.equal(controller.state.activeEnemyRoute, undefined);
});

// 既存ルール維持の検証
test("経路順は指揮官を先頭、残りを制圧力降順にする", () => {
    const { controller } = createFixture();
    assert.deepEqual(controller.getPlanningRoutes().map(route => route.id), ["R_COMMANDER", "R_HIGH", "R_LOW"]);
});

test("同一土地ブロックの別セルを別経路へ重複計画できない", () => {
    const { controller, presentation } = createFixture();
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 0 }, 4).success, true);
    const rejected = controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 0, c: 1 }, 3);
    assert.equal(rejected.success, false);
    assert.equal(rejected.reason, TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED);
});

test("異なる土地ブロックなら別経路へ計画できる", () => {
    const { controller, presentation } = createFixture();
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 4).success, true);
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3).success, true);
});

test("重複拒否時は既存計画を変更しない", () => {
    const { controller, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 0 }, 4);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 3);
    const before = new Map(presentation.routePlanDrafts);
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 0, c: 1 }, 2);
    assert.deepEqual(presentation.routePlanDrafts, before);
});

test("route外セルと未知routeをDraft API自身が拒否する", () => {
    const { controller, presentation } = createFixture();
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 1, c: 2 }, 2).reason, TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE);
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "UNKNOWN", { r: 0, c: 0 }, 2).reason, TRIAL_PLAN_REASONS.UNKNOWN_ROUTE);
});

test("迎撃不可湿原をDraft API自身が拒否する", () => {
    const { controller, presentation } = createFixture();
    const result = controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_HIGH", { r: 1, c: 1 }, 2);
    assert.equal(result.reason, TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED);
});

test("不利な地形補正でも迎撃合法なら計画できる", () => {
    const { controller, presentation } = createFixture();
    const result = controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 1);
    assert.equal(result.success, true);
    assert.equal(result.preview.success, true);
});

test("正式INTERCEPTの0配備は禁止しPreviewの0配備は許す", () => {
    const { controller, presentation } = createFixture();
    assert.equal(controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 0).reason, TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION);
    const preview = controller.validateRouteInterception("R_LOW", { r: 0, c: 2 }, 0);
    assert.equal(preview.success, true);
    assert.equal(preview.preview.human.basePower, 0);
});

test("全経路共通予算を超える変更を拒否する", () => {
    const { controller, presentation } = createFixture();
    controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_LOW", { r: 0, c: 2 }, 8);
    const rejected = controller.setRouteInterceptPlan(presentation.routePlanDrafts, "R_COMMANDER", { r: 1, c: 0 }, 5);
    assert.equal(rejected.reason, TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED);
    assert.equal(controller.getPlannedDefenseTotal(presentation.routePlanDrafts), 8);
    assert.equal(controller.getRemainingDefense(presentation.routePlanDrafts), 4);
});

test("GAME_FEELはUI未接続の固定設定値として公開される", () => {
    assert.deepEqual(GAME_FEEL, {
        uiResponseMs: 0,
        minorResultHoldMs: 180,
        trialDecisionHoldMs: 450,
        majorImpactHoldMs: 900,
        uiAnimationSpeed: 1,
        trialAnimationSpeed: 1
    });
});

console.log(`\n✅ Trial Phase 2.7C Foundation Responsibility Fix: ${passed}/${passed} tests passed`);
