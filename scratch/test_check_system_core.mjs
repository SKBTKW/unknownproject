import assert from "assert";
import { CheckSystem, CheckModifier } from "../game/src/core/check_system/check_system.js";

console.log("============================================================");
console.log("🧪 [Phase 2: CheckSystem Core Verification Test]");
console.log("============================================================");

// 1. 📊 2D6 100,000回ロール理論三角分布検問
console.log("🔍 [Core-1] 2D6 100,000回ロール理論三角分布 ＆ 平均値検問...");
const checkSys = new CheckSystem({ seed: 7777777 });
const rollCount = 100000;
const counts = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
let sumTotal = 0;

const startTime = Date.now();
for (let i = 0; i < rollCount; i++) {
    const res = checkSys.resolve({ checkId: "standard_2d6", actionId: "test_bulk", checkSequence: i + 1 });
    const tot = res.rawTotal;
    counts[tot] = (counts[tot] || 0) + 1;
    sumTotal += tot;
}
const elapsedMs = Date.now() - startTime;
const avg = sumTotal / rollCount;

console.log(`  ⏱️ 100,000 rolls completed in ${elapsedMs}ms (${(rollCount / (elapsedMs / 1000)).toFixed(0)} rolls/sec)`);
console.log(`  📈 Measured Average: ${avg.toFixed(4)} (Theoretical: 7.0000)`);
assert.ok(Math.abs(avg - 7.0) < 0.05, `平均値 ${avg} は理論値 7.0 ± 0.05 の範囲内であること`);

// 理論確率比率テーブル
const theoreticalRatios = {
    2: 1 / 36,
    3: 2 / 36,
    4: 3 / 36,
    5: 4 / 36,
    6: 5 / 36,
    7: 6 / 36,
    8: 5 / 36,
    9: 4 / 36,
    10: 3 / 36,
    11: 2 / 36,
    12: 1 / 36
};

const maxAllowedError = 0.004; // 許容誤差 ±0.40%
console.log("  📊 出目別実測分布 vs 理論比率 (許容誤差 ±0.40%):");
for (let val = 2; val <= 12; val++) {
    const actualRatio = counts[val] / rollCount;
    const theoRatio = theoreticalRatios[val];
    const diff = Math.abs(actualRatio - theoRatio);
    console.log(`     出目 ${val.toString().padStart(2)}: 実測 ${(actualRatio * 100).toFixed(2)}% | 理論 ${(theoRatio * 100).toFixed(2)}% | 差分 ${(diff * 100).toFixed(3)}%`);
    assert.ok(diff < maxAllowedError, `出目 ${val} の誤差 ${(diff * 100).toFixed(3)}% は許容幅 ${(maxAllowedError * 100).toFixed(2)}% 未満であること`);
}
console.log("  ✅ PASS: 100,000回 2D6 分布検問 ALL GREEN (数学的三角分布に完全に合致)");

// 2. 🔁 シード固定による 100% 同一出目シーケンス再現検問
console.log("\n🔍 [Core-2] シード固定による 100% 同一出目シーケンス再現検問...");
const fixedSeed = 424242;
const runA = new CheckSystem({ seed: fixedSeed });
const resultsA = [];
for (let i = 0; i < 10; i++) {
    resultsA.push(runA.resolve({ checkId: "standard_2d6", actionId: 100, checkSequence: i }));
}

const runB = new CheckSystem({ seed: fixedSeed });
const resultsB = [];
for (let i = 0; i < 10; i++) {
    resultsB.push(runB.resolve({ checkId: "standard_2d6", actionId: 100, checkSequence: i }));
}

assert.deepStrictEqual(resultsB, resultsA, "同一シード値から生成された全10個の CheckResult は 100% Deep Equal であること");
console.log("  ✅ PASS: シード固定完全再現 (100% Snapshot Deep Equal)");

// 3. ↩️ getState / setState による Undo 途中復元検問
console.log("\n🔍 [Core-3] getState / setState による Undo 途中復元検問...");
const stateTestSys = new CheckSystem({ seed: 99999 });

// 3回ロール
stateTestSys.resolve({ checkId: "standard_2d6", actionId: 1, checkSequence: 1 });
stateTestSys.resolve({ checkId: "standard_2d6", actionId: 1, checkSequence: 2 });
stateTestSys.resolve({ checkId: "standard_2d6", actionId: 1, checkSequence: 3 });

// 状態スナップショット取得 (Undo 保存点)
const snapshot = stateTestSys.getState();

// 次の3回ロール (Action 2)
const action2Results = [];
for (let i = 0; i < 3; i++) {
    action2Results.push(stateTestSys.resolve({ checkId: "standard_2d6", actionId: 2, checkSequence: i + 1 }));
}

// Undo 実行 (状態復元)
stateTestSys.setState(snapshot);

// 巻き戻し後に再度 Action 2 を実行
const action2RerunResults = [];
for (let i = 0; i < 3; i++) {
    action2RerunResults.push(stateTestSys.resolve({ checkId: "standard_2d6", actionId: 2, checkSequence: i + 1 }));
}

assert.deepStrictEqual(action2RerunResults, action2Results, "Undo 復元後に再実行された判定結果は完全に同一であること");
console.log("  ✅ PASS: getState / setState による Undo 途中復元完全一致確認");

// 4. ➕ Modifier パイプライン検問
console.log("\n🔍 [Core-4] Modifier パイプライン (add, subtract) 検問...");
const modSys = new CheckSystem({ seed: 12345 });
const modResult = modSys.resolve({
    checkId: "standard_2d6",
    actionId: 200,
    checkSequence: 1,
    modifiers: [
        new CheckModifier({ source: "tactical_vantage", operation: "add", value: 2 }),
        new CheckModifier({ source: "rough_terrain", operation: "subtract", value: 1 })
    ]
});

assert.strictEqual(modResult.modifierTotal, 1, "修正値の合計が +2 - 1 = 1 であること");
assert.strictEqual(modResult.finalTotal, modResult.rawTotal + 1, "finalTotal が rawTotal + 1 と完全一致すること");
assert.strictEqual(modResult.modifiers.length, 2, "適用された修正値が2件記録されていること");
assert.ok(modResult.outcome.id, "outcome.id が設定されていること");
console.log("  ✅ PASS: Modifier パイプライン正確性確認");

// 5. 🔮 keep highest 抽出ルール検問 (3D6 keep highest 2)
console.log("\n🔍 [Core-5] 抽出ルール検問 (oracle_check: 3D6 keep highest 2)...");
const oracleSys = new CheckSystem({ seed: 54321 });
for (let i = 0; i < 50; i++) {
    const oRes = oracleSys.resolve({ checkId: "oracle_check", actionId: 300, checkSequence: i });
    assert.strictEqual(oRes.dice.rolled.length, 3, "振られたダイスは3個であること");
    assert.strictEqual(oRes.dice.kept.length, 2, "採用されたダイスは2個であること");
    assert.strictEqual(oRes.dice.dropped.length, 1, "除外されたダイスは1個であること");

    // kept の最小値 >= dropped の値
    const minKept = Math.min(...oRes.dice.kept);
    const droppedVal = oRes.dice.dropped[0];
    assert.ok(minKept >= droppedVal, `採用出目 [${oRes.dice.kept}] の最小値 ${minKept} は除外出目 ${droppedVal} 以上であること`);
}
console.log("  ✅ PASS: 3D6 keep highest 2 抽出ロジック正常確認");

console.log("\n============================================================");
console.log("🎉 [Phase 2: CheckSystem Core Verification Test] ALL PASS (100%)");
console.log("============================================================");
