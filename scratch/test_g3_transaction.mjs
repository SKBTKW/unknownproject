import assert from "assert";
import { GameEngine } from "../game/src/app.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";

console.log("============================================================");
console.log("🧪 [Gate 3: Transaction Verification Test]");
console.log("============================================================");

const engine = GameEngine.createGame();

// 1. 🔍 Validate Clean Rejection 検問 (事前バリデーション失敗時の完全無傷検証)
console.log("🔍 [G3-1] Validate Clean Rejection 検問...");
const initialHistoryLen = engine.transactionManager.history.length;
const stateBeforeInvalid = serializeGameState(engine.state);

// 本営 (2,2) への重複配置 (不正)
const invalidCard = { id: "G3_INVALID", category: "LAND", terrain: { terrainId: "PLAINS", shape: [[1]] } };
const invalidRes = engine.placeLand(2, 2, invalidCard, 0);
assert.strictEqual(invalidRes.success, false, "不正配置は Validate により拒絶されること");
assert.strictEqual(engine.transactionManager.history.length, initialHistoryLen, "失敗したトランザクションは履歴に記録されないこと");

const stateAfterInvalid = serializeGameState(engine.state);
assert.deepStrictEqual(stateAfterInvalid, stateBeforeInvalid, "Validate 拒絶時はゲームステートが 1 ビットも変更されないこと");
console.log("  ✅ PASS: 不正配置時のステート完全無傷 (Clean Rejection) 確認");

// 2. ⚙️ Execute ➔ Derived Effects ➔ Commit パイプライン検問
console.log("🔍 [G3-2] 正常 Action トランザクション・履歴 Commit 検問...");
const stateBeforeValid = serializeGameState(engine.state);
const validCard = { id: "G3_VALID_PLAINS", category: "LAND", rarity: "C", terrain: { terrainId: "PLAINS", shape: [[1]], yields: { food: 4 } } };
const validRes = engine.placeLand(1, 2, validCard, 0);

assert.strictEqual(validRes.success, true, "正常配置はトランザクションが成功すること");
assert.ok(validRes.actionId, "トランザクション実行後に actionId が発行されること");
assert.strictEqual(engine.transactionManager.history.length, initialHistoryLen + 1, "履歴スタックに Action レコードが 1 件追加されること");
console.log("  ✅ PASS: 正常 Action のパイプライン完走 ＆ Commit 確認");

// 3. ↩️ 派生効果を含む完全 Undo 一致検問 (Deep Equality)
console.log("🔍 [G3-3] 派生効果を含む完全 Undo 一致検問 (Deep Equality)...");
const undoRes = engine.undoLastAction();
assert.strictEqual(undoRes.success, true, "Undo が成功すること");
assert.ok(undoRes.undoneAction, "Undo されたアクションレコードが返ること");
assert.strictEqual(engine.transactionManager.history.length, initialHistoryLen, "Undo 後に履歴スタックから取り除かれること");

const stateAfterUndo = serializeGameState(engine.state);
assert.deepStrictEqual(stateAfterUndo, stateBeforeValid, "Undo 後のゲームステートが Action 実行前と 100% 完全一致すること");
console.log("  ✅ PASS: トランザクション Undo のゲーム世界完全復元 (100% 一致)");

// 4. 🧹 ターン送り時の履歴クリア検問
console.log("🔍 [G3-4] ターン進行時の履歴クリア検問...");
engine.placeLand(1, 2, validCard, 0);
assert.ok(engine.transactionManager.history.length > 0, "配置後に履歴が存在すること");
engine.nextTurn();
assert.strictEqual(engine.transactionManager.history.length, 0, "ターン進行後に Action 履歴がクリアされること");
console.log("  ✅ PASS: ターン進行時のトランザクション履歴クリーンアップ確認");

console.log("============================================================");
console.log("🎉 [Gate 3: Transaction Verification Test] ALL PASS (100%)");
console.log("============================================================");
