import assert from "node:assert/strict";
import { I18n, TrialInterceptionPreviewComponent, resolveModifierTag } from "../game/src/app.js";
import { MODIFIER_TARGETS, TRIAL_OUTCOMES, TRIAL_TERRAIN_EFFECTS } from "../game/src/trial/domain/trial_types.js";
import { TrialTerrainEffectResolver } from "../game/src/trial/systems/trial_terrain_effect_resolver.js";
import { TrialCombatResolver } from "../game/src/trial/systems/trial_combat_resolver.js";
import { createBattleContext } from "../game/src/trial/domain/battle_context.js";
import { TrialModifierCalculator } from "../game/src/trial/systems/trial_modifier_calculator.js";

console.log("=== Running Updated Trial Modifier Tags Test Suite (Requirements A-J) ===\n");

let passed = 0;
let total = 0;
function test(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`  ✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
        process.exitCode = 1;
    }
}

// [Req A] 湿原E0 → 草原E1迎撃: 自軍80(補正なし), 敵56(泥濘0.8), 戦力差+24, 青 泥濘 のみ(高所なし)
test("Req A: 湿原E0 → 草原E1迎撃 ➔ ドメイン計算・表示完全一致 (自軍80, 敵56, margin +24, 青 泥濘のみ)", () => {
    const combat = new TrialCombatResolver();

    const interceptCell = { cellId: "c_1_0", terrain: { id: "GL1_PLAINS", e: 1 } };
    const approachCell = { cellId: "c_0_0", terrain: { id: "E0_WETLAND", e: 0 } };
    const context = createBattleContext({
        interceptCell,
        approachCell,
        baseInterceptionPower: 80,
        enemySuppression: 70
    });

    const combatResult = combat.resolve(context);
    assert.equal(combatResult.success, true);
    assert.equal(combatResult.human.basePower, 80);
    assert.equal(combatResult.human.finalPower, 80, "Human power should remain 80 without high ground");
    assert.equal(combatResult.enemy.basePower, 70);
    assert.equal(combatResult.enemy.finalPower, 56, "Enemy power reduced to 56 by mud");
    assert.equal(combatResult.prediction.margin, 24, "Margin must be 80 - 56 = 24");
    assert.equal(combatResult.prediction.outcome, TRIAL_OUTCOMES.REPEL);
    assert.ok(!combatResult.appliedModifiers.some(m => m.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND), "Must NOT contain HIGH_GROUND");

    const modifierRows = combatResult.appliedModifiers.map(m => ({
        labelKey: "UI_TRIAL_MOD_WETLAND_EXIT",
        source: m.source,
        target: m.target,
        before: m.before,
        after: m.after
    }));

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: combatResult.human.finalPower,
        baseEnemyPower: 70,
        finalEnemyPower: combatResult.enemy.finalPower,
        modifierRows,
        prediction: combatResult.prediction
    }, I18n);

    assert.ok(html.includes("泥濘"), "HTML should contain 泥濘");
    assert.ok(html.includes("is-advantage"), "HTML should contain advantage class");
    assert.ok(!html.includes("高所"), "HTML should NOT contain 高所");
    assert.ok(html.includes("80"), "HTML should show human power 80");
    assert.ok(html.includes("70 → 56"), "HTML should show enemy power 70 → 56");
    assert.ok(html.includes("24"), "HTML should show margin 24");
});

// [Req A2] 湿原E0 → 丘陵E2迎撃: 泥濘 + 高所が両方適用 (自軍96, 敵56, margin +40)
test("Req A2: 湿原E0 → 丘陵E2迎撃 ➔ 泥濘＋高所の双方が適用 (自軍96, 敵56, margin +40)", () => {
    const combat = new TrialCombatResolver();

    const interceptCell = { cellId: "c_hills", terrain: { id: "GL3_HILLS", e: 2 } };
    const approachCell = { cellId: "c_wetland", terrain: { id: "E0_WETLAND", e: 0 } };
    const context = createBattleContext({
        interceptCell,
        approachCell,
        baseInterceptionPower: 80,
        enemySuppression: 70
    });

    const combatResult = combat.resolve(context);
    assert.equal(combatResult.success, true);
    assert.equal(combatResult.human.finalPower, 96, "Human power boosted to 96 (80 * 1.2)");
    assert.equal(combatResult.enemy.finalPower, 56, "Enemy power reduced to 56 (70 * 0.8)");
    assert.equal(combatResult.prediction.margin, 40, "Margin must be 96 - 56 = 40");
    assert.ok(combatResult.appliedModifiers.some(m => m.source === TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT));
    assert.ok(combatResult.appliedModifiers.some(m => m.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND));
});

// [Req B] 通常の丘陵高所有利: 青 高所
test("Req B: 通常の丘陵高所有利 ➔ 青 高所", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        labelKey: "UI_TRIAL_MOD_HIGH_GROUND",
        before: 80,
        after: 96,
        interceptElevation: 2,
        approachElevation: 1,
        isStandardPlainsTransition: false
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_HIGH_GROUND");
    assert.equal(I18n.t(tag.labelKey), "高所");
    assert.equal(tag.isAdvantage, true);
    assert.equal(tag.polarityClass, "is-advantage");

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 96,
        baseEnemyPower: 70,
        finalEnemyPower: 70,
        modifierRows: [row],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 26 }
    }, I18n);
    assert.ok(html.includes("高所"), "HTML should contain 高所");
    assert.ok(html.includes("is-advantage"), "HTML should contain advantage class");
});

// [Req C] 通常の低所有利: 赤 低所
test("Req C: 通常の低所 (敵が高所) ➔ 赤 低所", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_HIGH_GROUND",
        before: 70,
        after: 84,
        interceptElevation: 1,
        approachElevation: 2,
        isStandardPlainsTransition: false
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_LOW_GROUND");
    assert.equal(I18n.t(tag.labelKey), "低所");
    assert.equal(tag.isAdvantage, false);
    assert.equal(tag.polarityClass, "is-disadvantage");

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 80,
        baseEnemyPower: 70,
        finalEnemyPower: 84,
        modifierRows: [row],
        prediction: { outcome: TRIAL_OUTCOMES.BREAKTHROUGH, margin: -4 }
    }, I18n);
    assert.ok(html.includes("低所"), "HTML should contain 低所");
    assert.ok(html.includes("is-disadvantage"), "HTML should contain disadvantage class");
});

// [Req D] 森・自軍40 / 敵40: 双方減衰なし、展開制限tagなし
test("Req D: 森・自軍40 / 敵40 ➔ 双方減衰なし、展開制限tagなし", () => {
    const calc = new TrialModifierCalculator();
    const forestMod = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    };
    const humanRes = calc.apply(40, [{ ...forestMod, target: MODIFIER_TARGETS.HUMAN_INTERCEPTION }]);
    const enemyRes = calc.apply(40, [{ ...forestMod, target: MODIFIER_TARGETS.ENEMY_SUPPRESSION }]);
    assert.equal(humanRes.value, 40);
    assert.equal(enemyRes.value, 40);
    assert.equal(humanRes.breakdown.length, 0);
    assert.equal(enemyRes.breakdown.length, 0);

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 8,
        baseHumanPower: 40,
        finalHumanPower: 40,
        baseEnemyPower: 40,
        finalEnemyPower: 40,
        modifierRows: [],
        prediction: { outcome: TRIAL_OUTCOMES.EXACT, margin: 0 }
    }, I18n);
    assert.ok(!html.includes("展開制限"), "Should NOT render 展開制限 tag");
});

// [Req E] 森・自軍30 / 敵70: 自軍30、敵55、青 展開制限
test("Req E: 森・自軍30 / 敵70 ➔ 自軍30, 敵55, 青 展開制限", () => {
    const calc = new TrialModifierCalculator();
    const forestMod = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    };
    const humanRes = calc.apply(30, [{ ...forestMod, target: MODIFIER_TARGETS.HUMAN_INTERCEPTION }]);
    const enemyRes = calc.apply(70, [{ ...forestMod, target: MODIFIER_TARGETS.ENEMY_SUPPRESSION }]);
    assert.equal(humanRes.value, 30);
    assert.equal(enemyRes.value, 55);
    assert.equal(humanRes.breakdown.length, 0);
    assert.equal(enemyRes.breakdown.length, 1);

    const enemyRow = {
        ...enemyRes.breakdown[0],
        labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT"
    };
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 6,
        baseHumanPower: 30,
        finalHumanPower: 30,
        baseEnemyPower: 70,
        finalEnemyPower: 55,
        modifierRows: [enemyRow],
        prediction: { outcome: TRIAL_OUTCOMES.BREAKTHROUGH, margin: -25 }
    }, I18n);
    assert.ok(html.includes("trial-modifier-tag is-advantage"), "Should contain advantage tag");
    assert.ok(html.includes("展開制限"), "Should contain 展開制限");
    assert.ok(!html.includes("is-disadvantage"), "Should NOT contain disadvantage tag");
});

// [Req F] 森・自軍80 / 敵70: 自軍60、敵55、赤 展開制限、青 展開制限
test("Req F: 森・自軍80 / 敵70 ➔ 自軍60, 敵55, 赤 展開制限 & 青 展開制限", () => {
    const calc = new TrialModifierCalculator();
    const forestMod = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    };
    const humanRes = calc.apply(80, [{ ...forestMod, target: MODIFIER_TARGETS.HUMAN_INTERCEPTION }]);
    const enemyRes = calc.apply(70, [{ ...forestMod, target: MODIFIER_TARGETS.ENEMY_SUPPRESSION }]);
    assert.equal(humanRes.value, 60);
    assert.equal(enemyRes.value, 55);

    const humanRow = { ...humanRes.breakdown[0], labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT" };
    const enemyRow = { ...enemyRes.breakdown[0], labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT" };
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 60,
        baseEnemyPower: 70,
        finalEnemyPower: 55,
        modifierRows: [humanRow, enemyRow],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 5 }
    }, I18n);
    assert.ok(html.includes("trial-modifier-tag is-disadvantage"), "Should contain disadvantage tag");
    assert.ok(html.includes("trial-modifier-tag is-advantage"), "Should contain advantage tag");
});

// [Req G] 森・自軍80 / 敵30: 自軍60、敵30、赤 展開制限
test("Req G: 森・自軍80 / 敵30 ➔ 自軍60, 敵30, 赤 展開制限", () => {
    const calc = new TrialModifierCalculator();
    const forestMod = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    };
    const humanRes = calc.apply(80, [{ ...forestMod, target: MODIFIER_TARGETS.HUMAN_INTERCEPTION }]);
    const enemyRes = calc.apply(30, [{ ...forestMod, target: MODIFIER_TARGETS.ENEMY_SUPPRESSION }]);
    assert.equal(humanRes.value, 60);
    assert.equal(enemyRes.value, 30);
    assert.equal(humanRes.breakdown.length, 1);
    assert.equal(enemyRes.breakdown.length, 0);

    const humanRow = { ...humanRes.breakdown[0], labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT" };
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 60,
        baseEnemyPower: 30,
        finalEnemyPower: 30,
        modifierRows: [humanRow],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 30 }
    }, I18n);
    assert.ok(html.includes("trial-modifier-tag is-disadvantage"), "Should contain disadvantage tag");
    assert.ok(html.includes("展開制限"), "Should contain 展開制限");
    assert.ok(!html.includes("is-advantage"), "Should NOT contain advantage tag");
});

// [Req H] 森・自軍50 ➔ 45
test("Req H: 森・自軍50 ➔ 45", () => {
    const calc = new TrialModifierCalculator();
    const res = calc.apply(50, [{
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    }]);
    assert.equal(res.value, 45);
});

// [Req I] 森・自軍100 ➔ 70
test("Req I: 森・自軍100 ➔ 70", () => {
    const calc = new TrialModifierCalculator();
    const res = calc.apply(100, [{
        phase: 100,
        operation: "LIMIT_OVERFLOW",
        threshold: 40,
        overflowEfficiency: 0.5
    }]);
    assert.equal(res.value, 70);
});

// [Req J] 通常草原: 展開制限なし
test("Req J: 通常草原 ➔ 展開制限なし", () => {
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 80,
        baseEnemyPower: 70,
        finalEnemyPower: 70,
        modifierRows: [],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 10 }
    }, I18n);
    assert.ok(!html.includes("展開制限"), "Plains should NOT contain 展開制限");
    assert.ok(!html.includes("trial-modifier-tag"), "Plains should NOT contain tags");
});

console.log("\n========================================");
console.log(`Results: ${passed} / ${total} tests passed.`);
console.log("========================================\n");
