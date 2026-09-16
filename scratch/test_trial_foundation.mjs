import assert from "node:assert/strict";
import { createBattleContext } from "../game/src/trial/domain/battle_context.js";
import { TrialState } from "../game/src/trial/domain/trial_state.js";
import {
    MODIFIER_OPERATIONS,
    MODIFIER_PHASES,
    MODIFIER_TARGETS,
    TRIAL_PHASES
} from "../game/src/trial/domain/trial_types.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import { TrialFlow } from "../game/src/trial/flow/trial_flow.js";
import { TrialPresentationState } from "../game/src/trial/presentation/trial_presentation_state.js";
import { InterceptionPowerResolver } from "../game/src/trial/systems/interception_power_resolver.js";
import { TrialCombatResolver } from "../game/src/trial/systems/trial_combat_resolver.js";
import { TrialModifierCalculator } from "../game/src/trial/systems/trial_modifier_calculator.js";
import { TrialTerrainEffectResolver } from "../game/src/trial/systems/trial_terrain_effect_resolver.js";

let total = 0;
function test(name, callback) {
    callback();
    total++;
    console.log(`  ✅ ${name}`);
}

const terrain = (id, e, gl = null) => ({ id, terrainId: id, e, gl });
const cell = (cellId, terrainValue) => ({ cellId, terrain: terrainValue });
const plains = terrain("GL1_PLAINS", 1, 1);
const reclaimed = terrain("E1_RECLAIMED_LAND", 1, 1);
const wetland = terrain("E0_WETLAND", 0, 1);
const desert = terrain("GL0_DESERT", 1, 0);
const forest = terrain("GL2_FOREST", 1, 2);
const deepForest = terrain("GL3_DEEP_FOREST", 1, 3);
const forestHill = terrain("E2_FOREST_HILL", 2, 2);
const hill = terrain("E2_HILL", 2, 1);
const mountain = terrain("E3_MOUNTAIN", 3, 0);

const context = ({ intercept = plains, approach = plains, human = 80, enemy = 100 } = {}) => createBattleContext({
    interceptCell: cell("INTERCEPT", intercept),
    approachCell: cell("APPROACH", approach),
    allocatedDefense: human / 5,
    baseInterceptionPower: human,
    enemySuppression: enemy
});

console.log("⚔️ Trial Phase 1 foundation tests");

test("🛡️1を⚔5へ一元変換する", () => {
    const resolver = new InterceptionPowerResolver();
    assert.equal(resolver.resolveDefense(1), 5);
    assert.equal(resolver.resolveDefense(6), 30);
    assert.equal(resolver.resolveSuppression(6), 30);
});

test("換算率はResolver注入だけで変更できる", () => {
    const resolver = new InterceptionPowerResolver({ defenseConversionRate: 6, suppressionConversionRate: 4 });
    assert.equal(resolver.resolveDefense(2), 12);
    assert.equal(resolver.resolveSuppression(3), 12);
});

test("湿原を実際に通過した敵だけが20%減衰する", () => {
    const result = new TrialCombatResolver().resolve(context({ approach: wetland }));
    assert.equal(result.enemySuppression, 80);
    assert.equal(result.enemyBreakdown[0].source, "WETLAND_EXIT");
});

test("湿原が無関係な位置にあるだけでは効果を適用しない", () => {
    const result = new TrialCombatResolver().resolve(context());
    assert.equal(result.enemySuppression, 100);
    assert.equal(result.enemyBreakdown.length, 0);
});

test("砂漠を実際に通過した敵を10%減衰する", () => {
    const result = new TrialCombatResolver().resolve(context({ approach: desert }));
    assert.equal(result.enemySuppression, 90);
});

test("森の閾値以下は双方とも変化しない", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forest, human: 30, enemy: 40 }));
    assert.equal(result.humanInterception, 30);
    assert.equal(result.enemySuppression, 40);
});

test("森は閾値超過分だけ人類・敵双方の展開効率を下げる", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forest, human: 80, enemy: 120 }));
    assert.equal(result.humanInterception, 60);
    assert.equal(result.enemySuppression, 80);
});

test("深い森の仮値は注入可能で、森より強い制限にできる", () => {
    const terrainResolver = new TrialTerrainEffectResolver({
        deepForestDeployment: { threshold: 20, overflowEfficiency: 0.25 }
    });
    const result = new TrialCombatResolver({ terrainResolver }).resolve(context({ intercept: deepForest, human: 80, enemy: 100 }));
    assert.equal(result.humanInterception, 35);
    assert.equal(result.enemySuppression, 40);
});

test("人類が高所なら展開制限後の迎撃力へ20%を適用する", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: forestHill, approach: plains, human: 80, enemy: 100 }));
    assert.equal(result.humanInterception, 72);
    assert.deepEqual(result.humanBreakdown.map(item => item.phase), [
        MODIFIER_PHASES.DEPLOYMENT_LIMIT,
        MODIFIER_PHASES.MULTIPLIER
    ]);
});

test("敵側が高所なら敵制圧力へ20%を適用する", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: plains, approach: hill }));
    assert.equal(result.enemySuppression, 120);
});

test("同高度では高度補正を適用しない", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: reclaimed, approach: plains }));
    assert.equal(result.humanInterception, 80);
    assert.equal(result.enemySuppression, 100);
});

test("Modifierの入力順に関係なく展開制限を倍率より先に適用する", () => {
    const calculator = new TrialModifierCalculator();
    const result = calculator.apply(80, [
        { source: "HIGH", target: MODIFIER_TARGETS.HUMAN_INTERCEPTION, operation: MODIFIER_OPERATIONS.MULTIPLY, value: 1.2, phase: MODIFIER_PHASES.MULTIPLIER },
        { source: "FOREST", target: MODIFIER_TARGETS.HUMAN_INTERCEPTION, operation: MODIFIER_OPERATIONS.LIMIT_OVERFLOW, threshold: 40, overflowEfficiency: 0.5, phase: MODIFIER_PHASES.DEPLOYMENT_LIMIT }
    ]);
    assert.equal(result.value, 72);
    assert.deepEqual(result.breakdown.map(item => item.source), ["FOREST", "HIGH"]);
});

test("湿原と山岳は迎撃不可、山岳は通常ルート進入不可", () => {
    const resolver = new TrialTerrainEffectResolver();
    assert.equal(resolver.canInterceptAt(cell("W", wetland)), false);
    assert.equal(resolver.canInterceptAt(cell("M", mountain)), false);
    assert.equal(resolver.canEnterNormalRoute(cell("M", mountain)), false);
    assert.equal(resolver.canEnterNormalRoute(cell("W", wetland)), true);
});

test("干拓地は標準E1戦場で湿原効果を持たない", () => {
    const result = new TrialCombatResolver().resolve(context({ intercept: reclaimed, approach: plains }));
    assert.equal(result.success, true);
    assert.equal(result.modifiers.length, 0);
});

test("TrialFlowは4フェーズだけを順番に遷移する", () => {
    const state = new TrialState({ availableDefense: 10 });
    const flow = new TrialFlow();
    assert.equal(flow.advance(state), TRIAL_PHASES.DEPLOYMENT);
    assert.equal(flow.advance(state), TRIAL_PHASES.BATTLE);
    assert.equal(flow.advance(state), TRIAL_PHASES.RESULT);
    assert.equal(flow.advance(state), TRIAL_PHASES.RESULT);
});

test("ScenarioからController実経路でCombatResultを返す", () => {
    const controller = new TrialController();
    const state = controller.startScenario({ id: "FOUNDATION", enemySuppression: 20, availableDefense: 20 });
    assert.equal(state.enemy.totalSuppression, 100);
    const result = controller.resolveBattle({
        allocatedDefense: 16,
        interceptCell: cell("I", forestHill),
        approachCell: cell("A", wetland)
    });
    assert.equal(result.humanInterception, 72);
    assert.equal(result.enemySuppression, 56);
    assert.equal(result.remainingSuppression, 0);
    assert.equal(state.phase, TRIAL_PHASES.RESULT);
});

test("TrialStateはrenderer・DOM・world座標を保持しない", () => {
    const serialized = JSON.stringify(new TrialState({ availableDefense: 10 }));
    for (const forbidden of ["renderer", "dom", "worldX", "worldY", "worldZ", "element"]) {
        assert.equal(serialized.includes(forbidden), false);
    }
});

test("表示mode切替後もPresentationStateの選択を維持する", () => {
    const presentation = new TrialPresentationState();
    presentation.selectedInterceptCell = "E6";
    presentation.previewDefenseAllocation = 7;
    presentation.setMode("2_5D");
    assert.equal(presentation.selectedInterceptCell, "E6");
    assert.equal(presentation.previewDefenseAllocation, 7);
});

console.log(`\n✅ Trial Phase 1 foundation: ${total}/${total} tests passed`);
