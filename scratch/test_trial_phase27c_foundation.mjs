import assert from "node:assert/strict";
import {
    GAME_FACT_TYPES,
    GAME_FEEL,
    GameFactHub,
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES
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
    return { controller, gameFactHub };
}

console.log("🧭 Trial Phase 2.7C planning foundation tests");

test("経路順は指揮官を先頭、残りを制圧力降順にする", () => {
    const { controller } = createFixture();
    assert.deepEqual(controller.getPlanningRoutes().map(route => route.id), ["R_COMMANDER", "R_HIGH", "R_LOW"]);
});

test("同一土地ブロックの別セルを別経路へ重複計画できない", () => {
    const { controller } = createFixture();
    assert.equal(controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 0 }, 4).success, true);
    const rejected = controller.setRouteInterceptPlan("R_COMMANDER", { r: 0, c: 1 }, 3);
    assert.equal(rejected.success, false);
    assert.equal(rejected.reason, TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED);
});

test("異なる土地ブロックなら別経路へ計画できる", () => {
    const { controller } = createFixture();
    assert.equal(controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 4).success, true);
    assert.equal(controller.setRouteInterceptPlan("R_COMMANDER", { r: 1, c: 0 }, 3).success, true);
});

test("重複拒否時は既存計画を変更しない", () => {
    const { controller } = createFixture();
    controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 0 }, 4);
    controller.setRouteInterceptPlan("R_COMMANDER", { r: 1, c: 0 }, 3);
    const before = structuredClone(controller.state.plannedInterceptions);
    controller.setRouteInterceptPlan("R_COMMANDER", { r: 0, c: 1 }, 2);
    assert.deepEqual(controller.state.plannedInterceptions, before);
});

test("route外セルと未知routeをDraft API自身が拒否する", () => {
    const { controller } = createFixture();
    assert.equal(controller.setRouteInterceptPlan("R_LOW", { r: 1, c: 2 }, 2).reason, TRIAL_PLAN_REASONS.CELL_NOT_ON_ROUTE);
    assert.equal(controller.setRouteInterceptPlan("UNKNOWN", { r: 0, c: 0 }, 2).reason, TRIAL_PLAN_REASONS.UNKNOWN_ROUTE);
});

test("迎撃不可湿原をDraft API自身が拒否する", () => {
    const { controller } = createFixture();
    const result = controller.setRouteInterceptPlan("R_HIGH", { r: 1, c: 1 }, 2);
    assert.equal(result.reason, TRIAL_PLAN_REASONS.INTERCEPTION_NOT_ALLOWED);
});

test("不利な地形補正でも迎撃合法なら計画できる", () => {
    const { controller } = createFixture();
    const result = controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 1);
    assert.equal(result.success, true);
    assert.equal(result.preview.success, true);
});

test("正式INTERCEPTの0配備は禁止しPreviewの0配備は許す", () => {
    const { controller } = createFixture();
    assert.equal(controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 0).reason, TRIAL_PLAN_REASONS.INVALID_DEFENSE_ALLOCATION);
    const preview = controller.validateRouteInterception("R_LOW", { r: 0, c: 2 }, 0);
    assert.equal(preview.success, true);
    assert.equal(preview.preview.human.basePower, 0);
});

test("SKIPは配備0の明示的決定として保存する", () => {
    const { controller } = createFixture();
    const result = controller.setRouteSkipped("R_LOW");
    assert.equal(result.plan.status, TRIAL_ROUTE_PLAN_STATUSES.SKIP);
    assert.equal(result.plan.defenseAllocation, 0);
});

test("全経路共通予算を超える変更を拒否する", () => {
    const { controller } = createFixture();
    controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 8);
    const rejected = controller.setRouteInterceptPlan("R_COMMANDER", { r: 1, c: 0 }, 5);
    assert.equal(rejected.reason, TRIAL_PLAN_REASONS.DEFENSE_BUDGET_EXCEEDED);
    assert.equal(controller.getPlannedDefenseTotal(), 8);
    assert.equal(controller.getRemainingDefense(), 4);
});

test("選択だけではGameFactを発行しない", () => {
    const { gameFactHub } = createFixture();
    const presentation = new TrialPresentationState();
    presentation.selectInterceptCell({ r: 0, c: 0 });
    assert.equal(gameFactHub.getFacts().length, 0);
});

test("迎撃計画とSKIPだけが意思決定GameFactを発行する", () => {
    const { controller, gameFactHub } = createFixture();
    controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteSkipped("R_COMMANDER");
    assert.deepEqual(gameFactHub.getFacts().map(fact => fact.type), [
        GAME_FACT_TYPES.TRIAL_INTERCEPTION_PLANNED,
        GAME_FACT_TYPES.TRIAL_ROUTE_SKIPPED
    ]);
});

test("未決定とSKIPを区別し、決定解除で未決定へ戻す", () => {
    const { controller } = createFixture();
    assert.equal(controller.getRouteDecision("R_LOW").status, TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED);
    controller.setRouteSkipped("R_LOW");
    assert.equal(controller.getRouteDecision("R_LOW").status, TRIAL_ROUTE_PLAN_STATUSES.SKIP);
    controller.clearRouteDecision("R_LOW");
    assert.equal(controller.getRouteDecision("R_LOW").status, TRIAL_ROUTE_PLAN_STATUSES.UNDECIDED);
});

test("全経路決定後のみDraftをvalidとする", () => {
    const { controller } = createFixture();
    controller.setRouteInterceptPlan("R_LOW", { r: 0, c: 2 }, 4);
    controller.setRouteInterceptPlan("R_COMMANDER", { r: 1, c: 0 }, 3);
    assert.equal(controller.validatePlanningDraft().valid, false);
    controller.setRouteSkipped("R_HIGH");
    assert.equal(controller.validatePlanningDraft().valid, true);
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

console.log(`\n✅ Trial Phase 2.7C foundation: ${passed}/${passed} tests passed`);
