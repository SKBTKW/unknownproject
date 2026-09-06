import assert from "node:assert/strict";
import { GameEngine, UIController } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { isDevelopmentMode } from "../game/src/config/dev_mode.js";

let passed = 0;
function test(name, callback) {
    callback();
    passed++;
    console.log(`  ✅ ${name}`);
}

console.log("⚔️ Trial Phase 2.5 development preview harness tests");

test("production相当ではdev mode判定がfalseになる", () => {
    assert.equal(isDevelopmentMode({ globalObject: {}, locationObject: { search: "" } }), false);
});

test("明示フラグまたはdev URLだけがdev modeになる", () => {
    assert.equal(isDevelopmentMode({ globalObject: { __TOA_DEV_MODE__: true }, locationObject: { search: "" } }), true);
    assert.equal(isDevelopmentMode({ globalObject: {}, locationObject: { search: "?dev=1" } }), true);
});

const previousWindow = globalThis.window;
globalThis.window = { __TOA_DEV_MODE__: false, location: { search: "" } };
const engine = GameEngine.createGame();
const ui = new UIController(engine);

test("production相当では開発Scenarioを起動できない", () => {
    assert.deepEqual(ui.startDevelopmentTrialPreview(), { success: false, reason: "DEV_MODE_REQUIRED" });
    assert.equal(ui.developmentTrialPreviewHarness.isActive(), false);
});

globalThis.window.__TOA_DEV_MODE__ = true;
const beforeState = JSON.stringify(serializeGameState(engine.state));
const beforeDefense = engine.state.currentDefense;
const beforeGrid = engine.state.grid;

test("dev modeで固定5x5地形比較Scenarioを起動できる", () => {
    assert.equal(ui.startDevelopmentTrialPreview().success, true);
    assert.equal(ui.getBoardDisplayGrid().length, 5);
    assert.notEqual(ui.getBoardDisplayGrid(), engine.state.grid);
    assert.equal(ui.getActiveTrialRoute().cells.length, 5);
});

test("湿原はrouteだが迎撃候補ではない", () => {
    assert.deepEqual(ui.getTrialInterceptionCellState(0, 0), { onRoute: true, canIntercept: false });
});

test("草原・森・高所・湿原出口を同じ条件で比較できる", () => {
    const wetlandExit = ui.updateTrialInterceptionPreview(1, 0);
    const plains = ui.updateTrialInterceptionPreview(2, 0);
    const forest = ui.updateTrialInterceptionPreview(2, 1);
    const highGround = ui.updateTrialInterceptionPreview(3, 1);
    assert.equal(wetlandExit.modifierRows.some(row => row.source === "WETLAND_EXIT"), true);
    assert.equal(plains.modifierRows.length, 0);
    assert.equal(forest.modifierRows.some(row => row.source === "FOREST_DEPLOYMENT"), true);
    assert.equal(highGround.modifierRows.some(row => row.source === "HIGH_GROUND"), true);
    assert.deepEqual([wetlandExit, plains, forest, highGround].map(row => row.deployedDefense), [16, 16, 16, 16]);
    assert.deepEqual([wetlandExit, plains, forest, highGround].map(row => row.baseEnemyPower), [70, 70, 70, 70]);
});

test("hover順序を変えても同じ候補結果になる", () => {
    const first = ui.updateTrialInterceptionPreview(1, 0);
    ui.updateTrialInterceptionPreview(3, 1);
    const second = ui.updateTrialInterceptionPreview(1, 0);
    assert.deepEqual(second, first);
});

test("Scenario閲覧中もGameState・現在防衛・TrialFlowが不変", () => {
    assert.equal(JSON.stringify(serializeGameState(engine.state)), beforeState);
    assert.equal(engine.state.currentDefense, beforeDefense);
    assert.equal(ui.trialController.state.phase, "SETUP");
});

test("停止すると通常盤面参照へ戻りTrial表示stateを破棄する", () => {
    assert.equal(ui.stopDevelopmentTrialPreview(), true);
    assert.equal(ui.developmentTrialPreviewHarness.isActive(), false);
    assert.equal(ui.getBoardDisplayGrid(), beforeGrid);
    assert.equal(ui.trialPreviewConfig, null);
    assert.equal(ui.trialPresentationState.interceptionPreview, null);
    assert.equal(ui.trialController.state, null);
    assert.equal(JSON.stringify(serializeGameState(engine.state)), beforeState);
});

globalThis.window = previousWindow;
console.log(`\n✅ Trial Phase 2.5 dev harness: ${passed}/${passed} tests passed`);
