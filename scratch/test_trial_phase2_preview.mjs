import assert from "node:assert/strict";
import { GameEngine, I18n, UIController } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { createBattleContext } from "../game/src/trial/domain/battle_context.js";
import { MODIFIER_PHASES, TRIAL_OUTCOMES } from "../game/src/trial/domain/trial_types.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TrialPresentationState } from "../game/src/trial/presentation/trial_presentation_state.js";
import { TrialCombatResolver } from "../game/src/trial/systems/trial_combat_resolver.js";
import { TrialInterceptionPreviewComponent } from "../game/src/ui/trial_interception_preview_component.js";

let total = 0;
function test(name, callback) {
    callback();
    total++;
    console.log(`  ✅ ${name}`);
}

const terrain = (id, e, gl = null, nameKey = null) => ({ id, terrainId: id, e, gl, nameKey: nameKey || id });
const cell = (cellId, terrainValue) => ({ cellId, terrain: terrainValue });
const plains = terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS");
const wetland = terrain("E0_WETLAND", 0, 1, "TERRAIN_WETLAND");
const forest = terrain("GL2_FOREST", 1, 2, "TERRAIN_FOREST");
const forestHill = terrain("E2_FOREST_HILL", 2, 2, "TERRAIN_FOREST_HILL");

const context = ({ intercept = plains, approach = plains, human = 80, enemy = 70 } = {}) => createBattleContext({
    interceptCell: cell("INTERCEPT", intercept),
    approachCell: cell("APPROACH", approach),
    allocatedDefense: human / 5,
    baseInterceptionPower: human,
    enemySuppression: enemy
});

console.log("⚔️ Trial Phase 2 interception preview tests");

test("CombatResultが基礎値・最終値・適用内訳・予測を保持する", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forestHill, approach: wetland }));
    assert.deepEqual(result.human, { basePower: 80, finalPower: 72 });
    assert.deepEqual(result.enemy, { basePower: 70, finalPower: 44 });
    assert.deepEqual(result.appliedModifiers.map(row => [row.source, row.before, row.after]), [
        ["FOREST_DEPLOYMENT", 80, 60],
        ["FOREST_DEPLOYMENT", 70, 55],
        ["WETLAND_EXIT", 55, 44],
        ["HIGH_GROUND", 60, 72]
    ]);
    assert.deepEqual(result.appliedModifiers.map(row => row.phase), [
        MODIFIER_PHASES.DEPLOYMENT_LIMIT,
        MODIFIER_PHASES.DEPLOYMENT_LIMIT,
        MODIFIER_PHASES.MULTIPLIER,
        MODIFIER_PHASES.MULTIPLIER
    ]);
    assert.deepEqual(result.prediction, { outcome: TRIAL_OUTCOMES.REPEL, margin: 28 });
});

test("値を変えない森林Modifierは適用済み内訳とイベントに含めない", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forest, human: 30, enemy: 40 }));
    assert.equal(result.appliedModifiers.length, 0);
    assert.equal(result.events.length, 0);
});

test("草原・森・高所・湿原出口を同じ条件で比較できる", () => {
    const resolver = new TrialCombatResolver();
    const results = {
        plains: resolver.resolve(context()),
        forest: resolver.resolve(context({ intercept: forest })),
        high: resolver.resolve(context({ intercept: forestHill, approach: plains })),
        wetlandExit: resolver.resolve(context({ intercept: plains, approach: wetland }))
    };
    assert.equal(results.plains.appliedModifiers.length, 0);
    assert.equal(results.forest.appliedModifiers.some(row => row.source === "FOREST_DEPLOYMENT"), true);
    assert.equal(results.high.appliedModifiers.some(row => row.source === "HIGH_GROUND"), true);
    assert.equal(results.wetlandExit.appliedModifiers.some(row => row.source === "WETLAND_EXIT"), true);
    assert.deepEqual(Object.values(results).map(result => result.human.basePower), [80, 80, 80, 80]);
    assert.deepEqual(Object.values(results).map(result => result.enemy.basePower), [70, 70, 70, 70]);
});

test("previewInterceptionはTrialStateとFlowを変更せず同条件で決定的", () => {
    const controller = new TrialController();
    const state = controller.startScenario({ id: "PREVIEW", enemySuppression: 14, availableDefense: 20 });
    const before = JSON.stringify(state);
    const input = { allocatedDefense: 16, interceptCell: cell("I", forestHill), approachCell: cell("A", wetland) };
    const first = controller.previewInterception(input);
    const second = controller.previewInterception(input);
    assert.deepEqual(second, first);
    assert.equal(JSON.stringify(state), before);
    assert.equal(state.phase, "SETUP");
    assert.equal(state.human.availableDefense, 20);
});

test("previewと本戦が同じResolver chainから同じ戦闘値を返す", () => {
    const previewController = new TrialController();
    previewController.startScenario({ enemySuppression: 14, availableDefense: 20 });
    const battleController = new TrialController();
    battleController.startScenario({ enemySuppression: 14, availableDefense: 20 });
    const input = { allocatedDefense: 16, interceptCell: cell("I", forestHill), approachCell: cell("A", wetland) };
    const preview = previewController.previewInterception(input);
    const battle = battleController.resolveBattle(input);
    assert.deepEqual(preview.human, battle.human);
    assert.deepEqual(preview.enemy, battle.enemy);
    assert.deepEqual(preview.appliedModifiers, battle.appliedModifiers);
    assert.deepEqual(preview.prediction, battle.prediction);
});

test("PresentationStateは結果をI18Nキー付き表示モデルへ写すだけ", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forestHill, approach: wetland }));
    const presentation = new TrialPresentationState();
    const preview = presentation.setInterceptionPreview({
        cell: { r: 1, c: 2, cellId: "1:2" },
        terrainNameKey: "TERRAIN_FOREST_HILL",
        deployedDefense: 16,
        result
    });
    assert.equal(preview.baseHumanPower, result.human.basePower);
    assert.equal(preview.finalEnemyPower, result.enemy.finalPower);
    assert.equal(preview.modifierRows[0].labelKey, "UI_TRIAL_MOD_FOREST_DEPLOYMENT");
    assert.equal(JSON.stringify(presentation).includes("document"), false);
    assert.equal(JSON.stringify(presentation).includes("element"), false);
});

test("UIのBoard hover接続はGameStateと現在🛡️を変更しない", () => {
    const engine = new GameEngine();
    const routeCells = [
        { r: 0, c: 0, terrain: wetland },
        { r: 0, c: 1, terrain: plains },
        { r: 0, c: 2, terrain: forest },
        { r: 0, c: 3, terrain: forestHill }
    ];
    routeCells.forEach(({ r, c, terrain: terrainValue }) => {
        Object.assign(engine.state.grid[r][c], { placed: true, isHQ: false, terrain: { ...terrainValue } });
    });
    const ui = new UIController(engine);
    const currentDefense = engine.state.currentDefense;
    ui.startTrialInterceptionPreview({
        id: "UI_PREVIEW",
        enemySuppression: 14,
        availableDefense: currentDefense,
        routes: [{ id: "NORTH", cells: routeCells.map(({ r, c }) => ({ r, c })) }]
    }, { deployedDefense: Math.min(6, currentDefense), routeId: "NORTH" });
    const before = JSON.stringify(serializeGameState(engine.state));
    assert.deepEqual(ui.getTrialInterceptionCellState(0, 0), { onRoute: true, canIntercept: false });
    assert.deepEqual(ui.getTrialInterceptionCellState(0, 1), { onRoute: true, canIntercept: true });
    const preview = ui.updateTrialInterceptionPreview(0, 1);
    assert.equal(preview.modifierRows.some(row => row.source === "WETLAND_EXIT"), true);
    assert.equal(engine.state.currentDefense, currentDefense);
    assert.equal(JSON.stringify(serializeGameState(engine.state)), before);
    assert.equal(ui.trialController.state.phase, "SETUP");
});

test("最小UIはDomainのbefore/afterと予測をそのまま表示する", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forestHill, approach: wetland }));
    const presentation = new TrialPresentationState();
    const preview = presentation.setInterceptionPreview({
        cell: { r: 1, c: 2 },
        terrainNameKey: "TERRAIN_FOREST_HILL",
        deployedDefense: 16,
        result
    });
    const html = TrialInterceptionPreviewComponent.renderHtml(preview, I18n);
    assert.equal(html.includes("80 → 60"), true);
    assert.equal(html.includes("55 → 44"), true);
    assert.equal(html.includes("⚔72"), true);
    assert.equal(html.includes("撃退可能"), true);
});

console.log(`\n✅ Trial Phase 2 preview: ${total}/${total} tests passed`);
