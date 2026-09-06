import assert from "node:assert/strict";
import { I18n, TrialInterceptionPreviewComponent, resolveModifierTag } from "../game/src/app.js";
import { MODIFIER_TARGETS, TRIAL_OUTCOMES, TRIAL_TERRAIN_EFFECTS } from "../game/src/trial/domain/trial_types.js";

console.log("=== Running Trial Modifier Tags Test Suite (Requirements A-J) ===\n");

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

// [Req A] 湿原通過で敵が弱体 ➔ 泥濘 ➔ advantage class
test("Req A: 湿原通過で敵が弱体 ➔ 泥濘 (is-advantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_WETLAND_EXIT",
        before: 70,
        after: 56
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_MUD");
    assert.equal(I18n.t(tag.labelKey), "泥濘");
    assert.equal(tag.isAdvantage, true);
    assert.equal(tag.polarityClass, "is-advantage");

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 80,
        baseEnemyPower: 70,
        finalEnemyPower: 56,
        modifierRows: [row],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 24 }
    }, I18n);
    assert.ok(html.includes("trial-modifier-tag is-advantage"), "HTML should contain advantage tag class");
    assert.ok(html.includes("泥濘"), "HTML should contain 泥濘 text");
});

// [Req B] 砂漠通過で敵が弱体 ➔ 疲弊 ➔ advantage class
test("Req B: 砂漠通過で敵が弱体 ➔ 疲弊 (is-advantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.DESERT_EXIT,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_DESERT_EXIT",
        before: 70,
        after: 63
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_FATIGUE");
    assert.equal(I18n.t(tag.labelKey), "疲弊");
    assert.equal(tag.isAdvantage, true);
    assert.equal(tag.polarityClass, "is-advantage");

    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 80,
        baseEnemyPower: 70,
        finalEnemyPower: 63,
        modifierRows: [row],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 17 }
    }, I18n);
    assert.ok(html.includes("trial-modifier-tag is-advantage"), "HTML should contain advantage tag class");
    assert.ok(html.includes("疲弊"), "HTML should contain 疲弊 text");
});

// [Req C] 自軍が高所 ➔ 高所 ➔ advantage class
test("Req C: 自軍が高所 ➔ 高所 (is-advantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        labelKey: "UI_TRIAL_MOD_HIGH_GROUND",
        before: 80,
        after: 96
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
    assert.ok(html.includes("trial-modifier-tag is-advantage"), "HTML should contain advantage tag class");
    assert.ok(html.includes("高所"), "HTML should contain 高所 text");
});

// [Req D] 自軍が低所（敵が高所） ➔ 低所 ➔ disadvantage class
test("Req D: 自軍が低所 (敵が高所で強化) ➔ 低所 (is-disadvantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_HIGH_GROUND",
        before: 70,
        after: 84
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
    assert.ok(html.includes("trial-modifier-tag is-disadvantage"), "HTML should contain disadvantage tag class");
    assert.ok(html.includes("低所"), "HTML should contain 低所 text");
});

// [Req E] 森林で自軍が展開制限 ➔ 展開制限 ➔ disadvantage class
test("Req E: 森林で自軍が展開制限 ➔ 展開制限 (is-disadvantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT",
        before: 80,
        after: 60
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_DEPLOYMENT_LIMIT");
    assert.equal(I18n.t(tag.labelKey), "展開制限");
    assert.equal(tag.isAdvantage, false);
    assert.equal(tag.polarityClass, "is-disadvantage");
});

// [Req F] 森林で敵が展開制限 ➔ 展開制限 ➔ advantage class
test("Req F: 森林で敵が展開制限 ➔ 展開制限 (is-advantage)", () => {
    const row = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT",
        before: 70,
        after: 55
    };
    const tag = resolveModifierTag(row);
    assert.ok(tag, "Tag should be resolved");
    assert.equal(tag.labelKey, "UI_TRIAL_MODIFIER_DEPLOYMENT_LIMIT");
    assert.equal(I18n.t(tag.labelKey), "展開制限");
    assert.equal(tag.isAdvantage, true);
    assert.equal(tag.polarityClass, "is-advantage");
});

// [Req G] 森林で両者に作用する場合 ➔ advantage / disadvantage 双方が描画される
test("Req G: 森林で両者に作用する場合 ➔ advantage/disadvantage 双方が描画される", () => {
    const humanRow = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT",
        before: 80,
        after: 60
    };
    const enemyRow = {
        source: TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_FOREST_DEPLOYMENT",
        before: 70,
        after: 55
    };
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
    const count = (html.match(/展開制限/g) || []).length;
    assert.ok(count >= 2, "Should display at least two occurrences of 展開制限");
});

// [Req H] modifierなし草原 ➔ tagを表示しない
test("Req H: modifierなし草原 ➔ tagを表示しない", () => {
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
    assert.ok(!html.includes("trial-modifier-tag"), "Should not contain trial-modifier-tag");
    assert.ok(!html.includes("trial-preview-tags"), "Should not contain trial-preview-tags container");
});

// [Req I] 既存のbefore/after数値表示が壊れない
test("Req I: 既存のbefore/after数値表示が壊れない", () => {
    const humanRow = {
        source: TRIAL_TERRAIN_EFFECTS.HIGH_GROUND,
        target: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
        labelKey: "UI_TRIAL_MOD_HIGH_GROUND",
        before: 80,
        after: 96
    };
    const enemyRow = {
        source: TRIAL_TERRAIN_EFFECTS.WETLAND_EXIT,
        target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
        labelKey: "UI_TRIAL_MOD_WETLAND_EXIT",
        before: 70,
        after: 56
    };
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: true,
        deployedDefense: 16,
        baseHumanPower: 80,
        finalHumanPower: 96,
        baseEnemyPower: 70,
        finalEnemyPower: 56,
        modifierRows: [humanRow, enemyRow],
        prediction: { outcome: TRIAL_OUTCOMES.REPEL, margin: 40 }
    }, I18n);
    assert.ok(html.includes("80 → 96"), "Should preserve human before/after");
    assert.ok(html.includes("70 → 56"), "Should preserve enemy before/after");
    assert.ok(html.includes("⚔96"), "Should preserve final human power");
    assert.ok(html.includes("56"), "Should preserve final enemy power");
    assert.ok(html.includes("撃退可能"), "Should preserve outcome text");
    assert.ok(html.includes("40"), "Should preserve margin value");
});

// [Req J] 迎撃不可湿原 ➔ 前回追加した「湿原では迎撃部隊を展開できません」が維持される
test("Req J: 迎撃不可湿原 ➔ 湿原では迎撃部隊を展開できません が維持される", () => {
    const html = TrialInterceptionPreviewComponent.renderHtml({
        canIntercept: false,
        terrainNameKey: "TERRAIN_WETLAND"
    }, I18n);
    assert.ok(html.includes("湿原では迎撃部隊を展開できません"), "Should display terrain-specific forbidden message");
    assert.ok(html.includes("is-forbidden"), "Should have is-forbidden class");
    assert.ok(!html.includes("trial-modifier-tag"), "Forbidden state should not render modifier tags");
});

console.log("\n========================================");
console.log(`Results: ${passed} / ${total} tests passed.`);
console.log("========================================\n");
