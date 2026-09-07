import assert from "node:assert/strict";
import { GameEngine, UIController } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log("⚔️ Trial Phase 2.7A interception selection tests");

const previousWindow = globalThis.window;
globalThis.window = { __TOA_DEV_MODE__: true, location: { search: "?dev=1" } };
const engine = GameEngine.createGame();
const ui = new UIController(engine);
const gameStateBefore = JSON.stringify(serializeGameState(engine.state));

test("Scenario開始時は迎撃地点未選択", () => {
    assert.equal(ui.startDevelopmentTrialPreview().success, true);
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
});

test("合法候補clickは座標だけをselection SSOTへ保存する", () => {
    assert.equal(ui.selectTrialInterceptionCell(2, 1), true);
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 2, c: 1 });
    assert.deepEqual(Object.keys(ui.trialPresentationState.selectedInterceptCell).sort(), ["c", "r"]);
});

test("hoverはselectionを書き換えず表示対象だけを優先する", () => {
    ui.updateTrialInterceptionPreview(1, 0);
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 2, c: 1 });
    assert.deepEqual(ui.trialPresentationState.hoveredCell, { r: 1, c: 0 });
    assert.deepEqual(ui.trialPresentationState.interceptionPreview.cell, { r: 1, c: 0, cellId: "1:0" });
});

test("mouseleave相当でhoverを外すとselected Previewへ戻る", () => {
    ui.clearCellPreviews();
    assert.equal(ui.trialPresentationState.hoveredCell, null);
    assert.deepEqual(ui.trialPresentationState.interceptionPreview.cell, { r: 2, c: 1, cellId: "2:1" });
});

test("迎撃不可セルとroute外セルではselectionが変わらない", () => {
    assert.equal(ui.selectTrialInterceptionCell(0, 0), false);
    assert.equal(ui.selectTrialInterceptionCell(4, 0), false);
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 2, c: 1 });
});

test("Trial中の盤面clickは通常土地配置へ流れない", () => {
    ui.onCellClick(3, 1);
    assert.deepEqual(ui.trialPresentationState.selectedInterceptCell, { r: 3, c: 1 });
    assert.equal(JSON.stringify(serializeGameState(engine.state)), gameStateBefore);
});

test("停止と再開始でselectionがclearされる", () => {
    ui.stopDevelopmentTrialPreview();
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    assert.equal(ui.trialPresentationState.interceptionPreview, null);
    assert.equal(ui.startDevelopmentTrialPreview().success, true);
    assert.equal(ui.trialPresentationState.selectedInterceptCell, null);
    ui.stopDevelopmentTrialPreview();
});

globalThis.window = previousWindow;
console.log(`\n✅ Trial Phase 2.7A selection: ${passed}/${passed} tests passed`);
