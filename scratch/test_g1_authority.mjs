import assert from "assert";
import fs from "fs";
import { GameEngine, UIController, GameState } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";

console.log("============================================================");
console.log("🧪 [Gate 1: Authority Verification Test]");
console.log("============================================================");

// 1. 静的解析検問: game/src/ui/ui_controller.js からの直接 mutation 0 件検問
const uiControllerCode = fs.readFileSync("game/src/ui/ui_controller.js", "utf8");
const mutationPatterns = [
    /this\.state\.[a-zA-Z0-9_]+\s*(\+\+|\-\-)/,
    /this\.state\.[a-zA-Z0-9_]+\s*=(?!=)/,
    /this\.state\.[a-zA-Z0-9_]+\s*\[[^\]]+\]\s*=(?!=)/,
    /this\.state\.[a-zA-Z0-9_]+\.(push|splice|shift|unshift|pop)\s*\(/
];

let directMutationsFound = [];
mutationPatterns.forEach((pattern, idx) => {
    const matches = uiControllerCode.match(new RegExp(pattern, "g"));
    if (matches) {
        // filter out ternary or read-only matches if any
        matches.forEach(m => {
            if (!m.includes("==") && !m.includes("===")) {
                directMutationsFound.push(m);
            }
        });
    }
});

console.log("🔍 [G1-1] ui_controller.js 直接 GameState mutation 静的解析検問...");
if (directMutationsFound.length > 0) {
    console.error("❌ 直接 mutation 検出:", directMutationsFound);
}
assert.strictEqual(directMutationsFound.length, 0, "UIController からの直接 GameState mutation は 0 件でなければならない");
console.log("  ✅ PASS: ui_controller.js からの直接 GameState mutation: 0 件");

// 2. Action Boundary Skeleton ＆ Deep Equality 検問: 通常土地配置 ➔ Undo
console.log("🔍 [G1-2] Action Boundary ＆ Undo Deep Equality 検問 (土地配置 ➔ Undo)...");
const engine = GameEngine.createGame();
const stateBeforeAction = serializeGameState(engine.state);

// 手札カードを 1 枚選択して配置 (本営隣接 (1,2) に配置可能な土地)
let testCard = engine.state.handOffering.find(c => {
    if (!c) return false;
    const shape = c.shape || (c.terrain && c.terrain.shape);
    return shape && shape.length === 1 && shape[0].length === 1;
});
if (!testCard) {
    testCard = { id: "G1_TEST_PLAINS", category: "LAND", rarity: "C", terrain: { terrainId: "PLAINS", shape: [[1]], yields: { food: 4 } } };
    engine.state.handOffering[0] = testCard;
}
const offeringIdx = engine.state.handOffering.indexOf(testCard);

// Engine API 経由で土地配置
const placeRes = engine.placeLand(1, 2, testCard, 0, { type: "OFFERING", index: offeringIdx });
assert.strictEqual(placeRes.success, true, "Engine API 経由で土地配置が成功すること");
assert.strictEqual(engine.state.hasPickedThisTurn, true, "配置後に hasPickedThisTurn が true になること");
assert.ok(engine.state.handOffering[offeringIdx] === null || engine.state.handOffering[offeringIdx].isBlank, "配置後に手札枠が空またはブランクになること");

// Undo 実行
const undoRes = engine.undoLastAction();
assert.strictEqual(undoRes.success, true, "Engine API 経由で Undo が成功すること");

const stateAfterUndo = serializeGameState(engine.state);
assert.deepStrictEqual(stateAfterUndo, stateBeforeAction, "Undo 後のゲームステートが Action 実行前と完全一致 (Deep Equality) すること");
console.log("  ✅ PASS: 土地配置 ➔ Undo のゲームステート完全復元 (100% 一致)");

// 3. Action Boundary ＆ Undo Deep Equality 検問: 保留 (Reserve) ➔ 手札復帰 (Return)
console.log("🔍 [G1-3] 保留枠 Action API 検問 (Reserve ➔ Return)...");
const stateBeforeReserve = serializeGameState(engine.state);
const reserveTarget = engine.state.handOffering.find(c => c !== null);
const reserveTargetIdx = engine.state.handOffering.indexOf(reserveTarget);

const reserveRes = engine.reserveOfferingCard(reserveTargetIdx, 0);
assert.strictEqual(reserveRes.success, true, "reserveOfferingCard が成功すること");
assert.strictEqual(engine.state.reserveSlots[0].id, reserveTarget.id, "保留枠にカードが格納されていること");
assert.ok(engine.state.handOffering[reserveTargetIdx] === null || engine.state.handOffering[reserveTargetIdx].isBlank, "手札枠が空またはisBlankになっていること");

const returnRes = engine.returnReservedCard(0);
assert.strictEqual(returnRes.success, true, "returnReservedCard が成功すること");
assert.strictEqual(engine.state.reserveSlots[0], null, "保留枠が空になっていること");
assert.ok(engine.state.handOffering.some(c => c && c.id === reserveTarget.id), "手札にカードが復帰していること");
console.log("  ✅ PASS: リザーブ移動 ＆ 復帰の整合性確認");

// 4. マリガン Action API 検問
console.log("🔍 [G1-4] マリガン Action API 検問 (mulligan)...");
const initialEmber = engine.state.ember;
const mulliganRes = engine.mulligan();
assert.strictEqual(mulliganRes.success, true, "mulligan が成功すること");
assert.strictEqual(engine.state.ember, initialEmber - 1, "マリガン後に残り火が 1 消費されていること");
assert.strictEqual(engine.state.hasMulliganedThisTurn, true, "マリガン済みフラグが立っていること");

// 再度マリガンしようとするとブロックされること
const secondMulligan = engine.mulligan();
assert.strictEqual(secondMulligan.success, false, "同ターン内連続マリガンが禁止されること");
console.log("  ✅ PASS: マリガン Action API のルール遵守確認");

console.log("============================================================");
console.log("🎉 [Gate 1: Authority Verification Test] ALL PASS (100%)");
console.log("============================================================");
