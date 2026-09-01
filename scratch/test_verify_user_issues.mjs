import assert from "assert";
import { readFile } from "fs/promises";
import { GameEngine } from "../game/src/core/game_engine.js";
import { CheckSystem } from "../game/src/core/check_system/check_system.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { resolvePlacementGeometry, rotatePlacementClockwise } from "../game/src/core/placement_geometry.js";
import { attachLegacyUIBridge } from "../game/src/ui/legacy_ui_bridge.js";

console.log("============================================================");
console.log("🔍 [Targeted Regression: placement / 2D6 lifecycle]");
console.log("============================================================");

const commandCard = {
    id: "CMD_ABANDONED_SETTLEMENT",
    category: "COMMAND",
    nameKey: "CMD_ABANDONED_SETTLEMENT_NAME",
    descriptionKey: "CMD_ABANDONED_SETTLEMENT_DESC",
    cost: { ember: 1 }
};

console.log("\n📐 1. 回転プレビューと実配置の一致");
const landCard = {
    id: "CARD_FOREST_1X2",
    shape: [[1, 1]],
    currentShape: [[1, 1]],
    currentAnchor: { r: 0, c: 0 },
    terrain: {
        id: "GL2_FOREST",
        terrainId: "GL2_FOREST",
        shape: [[1, 1]],
        gl: 2,
        e: 1
    }
};
const rotated = rotatePlacementClockwise(landCard.currentShape, landCard.currentAnchor);
landCard.currentShape = rotated.shape;
landCard.currentAnchor = rotated.anchor;
assert.deepStrictEqual(landCard.currentShape, [[1], [1]]);
const preview = resolvePlacementGeometry(landCard, 0, 2);
const placementEngine = GameEngine.createGame({ runSeed: 1 });
placementEngine.state.handOffering[0] = landCard;
const placeResult = placementEngine.placeLand(0, 2, landCard, 0, { type: "OFFERING", index: 0 });
assert.strictEqual(placeResult.success, true);
for (const { r, c } of preview.cells) {
    assert.strictEqual(placementEngine.state.grid[r][c].placed, true, `preview cell (${r}, ${c})`);
}
assert.strictEqual(placementEngine.state.grid[0][3].placed, false, "横方向の余分なセルへ置かれないこと");
console.log("  ✅ preview cellsと配置セルが一致");

console.log("\n🎲 2. 固定seedと同一インスタンスの連続ロール");
const deterministicA = new CheckSystem({ seed: 424242 });
const deterministicB = new CheckSystem({ seed: 424242 });
const sequenceA = [];
const sequenceB = [];
for (let i = 0; i < 24; i++) {
    sequenceA.push(deterministicA.resolve({ checkId: "standard_2d6", actionId: "A", checkSequence: i + 1 }));
    sequenceB.push(deterministicB.resolve({ checkId: "standard_2d6", actionId: "A", checkSequence: i + 1 }));
}
assert.deepStrictEqual(sequenceB, sequenceA, "同一seedが同じ系列を再現すること");
for (const result of sequenceA) {
    assert.strictEqual(result.dice.kept.length, 2);
    assert.ok(result.dice.kept.every(value => value >= 1 && value <= 6));
    assert.strictEqual(result.finalTotal, result.dice.kept[0] + result.dice.kept[1]);
    assert.ok(result.finalTotal >= 2 && result.finalTotal <= 12);
}
assert.ok(new Set(sequenceA.map(result => result.dice.kept.join(","))).size > 1, "24回が同一出目に固定されないこと");
assert.strictEqual(deterministicA.getState().rng.callCount, 48);
console.log("  ✅ deterministic series、dice.kept、callCountを確認");

console.log("\n🏛️ 3. GameEngine所有権とCMD_ABANDONED_SETTLEMENT実経路");
const commandEngine = GameEngine.createGame({ runSeed: 12345678 });
assert.strictEqual(commandEngine.checkSystem, commandEngine.state.checkSystem);
const ownedCheckSystem = commandEngine.checkSystem;
commandEngine.state.ember = 100;
const commandResults = [];
for (let i = 0; i < 24; i++) {
    commandEngine.state.hasPickedThisTurn = false;
    const result = commandEngine.playCommandCard(commandCard, { type: "OFFERING", index: -1 });
    assert.strictEqual(result.success, true);
    assert.ok(result.diceCheck?.result?.dice?.kept);
    assert.strictEqual(commandEngine.checkSystem, ownedCheckSystem, "CheckSystemのidentityが継続すること");
    commandResults.push(result.diceCheck.result.finalTotal);
}
assert.ok(new Set(commandResults).size > 1, "実経路の連続結果が単一値に固定されないこと");
assert.ok(commandResults.some(total => total !== 8), "実経路が毎回8にならないこと");
assert.strictEqual(commandEngine.checkSystem.getState().rng.callCount, 48);
console.log(`  ✅ 24回の合計値: ${commandResults.join(", ")}`);

console.log("\n↩️ 4. Transaction UndoでRNG内部状態を復元");
const undoEngine = GameEngine.createGame({ runSeed: 987654321 });
undoEngine.state.ember = 20;
undoEngine.state.hasPickedThisTurn = false;
undoEngine.state.handOffering[0] = commandCard;
const rngBefore = undoEngine.checkSystem.getState();
const firstExecution = undoEngine.playCommandCard(commandCard, { type: "OFFERING", index: 0 });
assert.strictEqual(firstExecution.success, true);
const firstDice = firstExecution.diceCheck.result.dice.kept;
assert.strictEqual(undoEngine.checkSystem.getState().rng.callCount, rngBefore.rng.callCount + 2);
const undoResult = undoEngine.undoLastAction();
assert.strictEqual(undoResult.success, true);
assert.deepStrictEqual(undoEngine.checkSystem.getState(), rngBefore, "Undo後にseed/state/callCountが戻ること");
assert.strictEqual(undoEngine.checkSystem, undoEngine.state.checkSystem, "Undo後も同一インスタンスであること");
const replayCard = undoEngine.state.handOffering[0];
const replay = undoEngine.playCommandCard(replayCard, { type: "OFFERING", index: 0 });
assert.deepStrictEqual(replay.diceCheck.result.dice.kept, firstDice, "Undo後の再実行が同じ次出目を返すこと");
console.log("  ✅ seed/state/callCountと次出目を復元");

console.log("\n🔍 5. CMD_SCOUT_ENEMYは従来挙動のみ");
const scoutEngine = GameEngine.createGame({ runSeed: 2222 });
scoutEngine.state.food = 20;
const scoutResult = scoutEngine.playCommandCard({
    id: "CMD_SCOUT_ENEMY",
    category: "COMMAND",
    nameKey: "CMD_SCOUT_ENEMY_NAME",
    descriptionKey: "CMD_SCOUT_ENEMY_DESC",
    cost: { food: 5 }
}, { type: "OFFERING", index: -1 });
assert.strictEqual(scoutResult.success, true);
assert.strictEqual(scoutEngine.state.scoutEnemyActive, true);
assert.ok(!scoutResult.diceCheck, "SCOUT_ENEMYからdiceCheckを返さないこと");
console.log("  ✅ scoutEnemyActiveのみを維持");

console.log("\n🧰 6. 追加debug globalはdev限定");
const mockUi = { state: {}, drawSys: {}, engine: {} };
globalThis.window = { location: { search: "" } };
attachLegacyUIBridge(mockUi);
assert.strictEqual(window.demoResourceDelta, undefined);
assert.strictEqual(window.testPlayAbandonedSettlement, undefined);
globalThis.window = { location: { search: "?dev=1" } };
attachLegacyUIBridge(mockUi);
assert.strictEqual(typeof window.demoResourceDelta, "function");
assert.strictEqual(typeof window.testPlayAbandonedSettlement, "function");
delete globalThis.window;
console.log("  ✅ productionでは未露出、dev=1では利用可能");

console.log("\n🔒 7. DeckManagerの暗黙CheckSystem生成を禁止");
const deckSource = await readFile(new URL("../game/src/systems/deck_manager.js", import.meta.url), "utf8");
assert.ok(!deckSource.includes("window.checkSystem"));
assert.ok(!/new\s+CheckSystem\s*\(/.test(deckSource));
const missingServiceState = {
    ember: 5,
    food: 50,
    wood: 30,
    mystic: 0,
    handOffering: [],
    reserveSlots: [],
    consumedUniqueCards: [],
    usedUniqueCards: []
};
const isolatedDeckManager = new DeckManager(missingServiceState, null);
const missingServiceResult = isolatedDeckManager.playCommandCard(commandCard);
assert.deepStrictEqual(missingServiceResult, { success: false, reason: "CHECK_SYSTEM_UNAVAILABLE" });
assert.strictEqual(missingServiceState.ember, 5, "サービス不在時にコストを消費しないこと");
console.log("  ✅ window/new fallbackなし、サービス不在は副作用なしで明示失敗");

console.log("\n============================================================");
console.log("✅ Targeted regression checks passed");
console.log("============================================================");
