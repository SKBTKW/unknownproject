import assert from "node:assert/strict";
import { GameEngine, UIController } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { normalizeDefenseAllocation } from "../game/src/trial/presentation/trial_presentation_state.js";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log("🛡️ Trial Phase 2.7B defense allocation tests");

test("配備量normalizerは不正値・範囲・小数を一箇所で処理する", () => {
    assert.equal(normalizeDefenseAllocation(-1, 20), 0);
    assert.equal(normalizeDefenseAllocation(21, 20), 20);
    assert.equal(normalizeDefenseAllocation(9.8, 20), 9);
    assert.equal(normalizeDefenseAllocation(Number.POSITIVE_INFINITY, 20), 20);
    assert.equal(normalizeDefenseAllocation(Number.NaN, 20, 7), 7);
    assert.equal(normalizeDefenseAllocation(5, Number.NaN), 0);
});

const previousWindow = globalThis.window;
globalThis.window = { __TOA_DEV_MODE__: true, location: { search: "?dev=1" } };
const engine = GameEngine.createGame();
const ui = new UIController(engine);
const serializedBefore = JSON.stringify(serializeGameState(engine.state));
const currentDefenseBefore = engine.state.currentDefense;

test("Scenario初期値だけをPresentationStateの配分SSOTへ移す", () => {
    assert.equal(ui.startDevelopmentTrialPreview().success, true);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 16);
    assert.equal(Object.hasOwn(ui.trialPreviewConfig, "deployedDefense"), false);
    assert.equal(ui.getTrialAvailableDefense(), 20);
});

test("±1・MAX・clampは同じ配分更新APIを通る", () => {
    assert.equal(ui.adjustTrialDefenseAllocation(1), 17);
    assert.equal(ui.adjustTrialDefenseAllocation(-1), 16);
    assert.equal(ui.setTrialDefenseAllocation(-10), 0);
    assert.equal(ui.setTrialDefenseAllocation(999), 20);
    assert.equal(ui.setTrialDefenseAllocation(Number.NaN), 20);
});

test("配分変更ごとにDomain Previewを再計算する", () => {
    ui.selectTrialInterceptionCell(2, 1);
    ui.setTrialDefenseAllocation(10);
    const forestPreview = ui.trialPresentationState.interceptionPreview;
    assert.equal(forestPreview.deployedDefense, 10);
    assert.equal(forestPreview.baseHumanPower, 50);
    assert.equal(forestPreview.finalHumanPower, 45);
    ui.setTrialDefenseAllocation(8);
    assert.equal(ui.trialPresentationState.interceptionPreview.baseHumanPower, 40);
    assert.equal(ui.trialPresentationState.interceptionPreview.finalHumanPower, 40);
});

test("selected・hover間で同じ配分値を維持する", () => {
    ui.setTrialDefenseAllocation(10);
    ui.updateTrialInterceptionPreview(1, 0);
    assert.equal(ui.trialPresentationState.interceptionPreview.deployedDefense, 10);
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 2, c: 1 });
    ui.clearCellPreviews();
    assert.deepEqual(ui.trialPresentationState.interceptionPreview.cell, { r: 2, c: 1, cellId: "2:1" });
    assert.equal(ui.trialPresentationState.interceptionPreview.deployedDefense, 10);
});

test("selected地点を変えても配分値を維持する", () => {
    ui.selectTrialInterceptionCell(3, 1);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 10);
    assert.equal(ui.trialPresentationState.interceptionPreview.deployedDefense, 10);
});

test("計画値変更ではGameStateとTrialStateの実🛡を消費しない", () => {
    ui.setTrialDefenseAllocation(0);
    ui.setTrialDefenseAllocation(20);
    assert.equal(engine.state.currentDefense, currentDefenseBefore);
    assert.equal(ui.trialController.state.human.availableDefense, 20);
    assert.equal(JSON.stringify(serializeGameState(engine.state)), serializedBefore);
});

test("停止で計画をclearし、再開始時はScenario初期値へ戻る", () => {
    ui.stopDevelopmentTrialPreview();
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 0);
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.startDevelopmentTrialPreview().success, true);
    assert.equal(ui.trialPresentationState.previewDefenseAllocation, 16);
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    ui.stopDevelopmentTrialPreview();
});

globalThis.window = previousWindow;
console.log(`\n✅ Trial Phase 2.7B allocation: ${passed}/${passed} tests passed`);
