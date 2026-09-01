import assert from "assert";
import { CheckSystem, CheckModifier, RandomSource, DicePool, CheckResolver, TargetBuilder } from "../game/src/core/check_system/check_system.js";
import { validateCheckDefinitions } from "../game/src/core/check_system/check_validator.js";

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
console.log("  ✅ PASS: 100,000回 2D6 分布検問 (理論三角分布から許容誤差 ±0.40% 以内に収束)");

// 2. 🔁 シード固定による同一出目シーケンス再現検問
console.log("\n🔍 [Core-2] シード固定による同一出目シーケンス再現検問...");
const fixedSeed = 424242;
const runA = new CheckSystem({ seed: fixedSeed });
const resultsA = [];
for (let i = 0; i < 24; i++) {
    resultsA.push(runA.resolve({ checkId: "standard_2d6", actionId: 100, checkSequence: i }));
}

const runB = new CheckSystem({ seed: fixedSeed });
const resultsB = [];
for (let i = 0; i < 24; i++) {
    resultsB.push(runB.resolve({ checkId: "standard_2d6", actionId: 100, checkSequence: i }));
}

assert.deepStrictEqual(resultsB, resultsA, "同一シード値から生成された全24個の CheckResult が一致すること");
for (const result of resultsA) {
    assert.strictEqual(result.dice.kept.length, 2, "2D6の採用出目が2要素であること");
    assert.ok(result.dice.kept.every(value => Number.isInteger(value) && value >= 1 && value <= 6), "各出目が1〜6であること");
    assert.strictEqual(result.finalTotal, result.dice.kept[0] + result.dice.kept[1], "finalTotalが採用出目の合計であること");
    assert.ok(result.finalTotal >= 2 && result.finalTotal <= 12, "finalTotalが2〜12であること");
}
const distinctRolls = new Set(resultsA.map(result => result.dice.kept.join(",")));
assert.ok(distinctRolls.size > 1, "同一インスタンスの24連続ロールがすべて同一でないこと");
assert.strictEqual(runA.getState().rng.callCount, 48, "24回の2D6で同じRNGのcallCountが48まで進むこと");
console.log("  ✅ PASS: 固定seed再現、出目構造、同一インスタンス連続ロールを確認");

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

// 6. 🛡️ 包括的 Negative Tests (Fail-Fast 異常系拒絶検問)
console.log("\n🔍 [Core-6] 包括的 Negative Tests (Fail-Fast 異常系拒絶検問)...");
const testRng = new RandomSource(999);

// 6-A. nextInt 引数検証
assert.throws(() => testRng.nextInt(10, 2), /min \(10\) cannot be greater than max \(2\)/, "min > max で例外");
assert.throws(() => testRng.nextInt(NaN, 6), /min must be an integer/, "min が NaN で例外");

// 6-B. DicePool keep ルール・ダイス数異常
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "higest_2" }, testRng), /Unknown keep rule/, "higest_2 で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "highest_99" }, testRng), /N must be an integer between 1 and count/, "highest_99 (count超過) で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "highest_02" }, testRng), /N must be an integer between 1 and count/, "highest_02 (曖昧指定) で例外");

// 6-C. CheckResolver 未知 operation ＆ NaN/Infinity
const dummyDef = { id: "d", dice: { count: 2, sides: 6, keep: "all" }, outcomes: [{ max: 5, id: "f" }, { min: 6, id: "s" }] };
assert.throws(() => CheckResolver.resolve({ checkDef: dummyDef, rng: testRng, modifiers: [{ source: "s", operation: "ad", value: 1 }] }), /Unsupported modifier operation: "ad"/, 'operation: "ad" は例外');
assert.throws(() => CheckResolver.resolve({ checkDef: dummyDef, rng: testRng, modifiers: [{ source: "s", value: NaN }] }), /Invalid modifier value/, "value: NaN は例外");

// 6-D. Plain Object operation 省略時のデフォルト add 動作
const plainRes = CheckResolver.resolve({ checkDef: dummyDef, rng: testRng, modifiers: [{ source: "hill", value: 2 }] });
assert.strictEqual(plainRes.modifierTotal, 2, "Plain Object の operation 省略時はデフォルトで add (+2) になること");

// 6-E. 未知 checkId
assert.throws(() => checkSys.resolve({ checkId: "unknown_check_id" }), /Unknown checkId: unknown_check_id/, "未知 checkId で例外");

// 6-F. setState 不正データ
assert.throws(() => checkSys.setState(null), /savedState must be an object/, "setState(null) は例外");
assert.throws(() => checkSys.setState({}), /savedState\.rng is missing/, "setState({}) は例外");
assert.throws(() => checkSys.setState({ rng: { seed: "abc", state: 1, callCount: 0 } }), /seed must be an integer/, "seed 文字列は例外");

// 6-G. CheckDefinition 区間バリデータ (穴・重複)
assert.throws(() => validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ max: 6, id: "a" }, { min: 6, id: "b" }] } }), /Overlapping outcomes detected/, "区間重複で例外");
assert.throws(() => validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ max: 6, id: "a" }, { min: 8, id: "b" }] } }), /Gap detected between "a" .* and "b"/, "区間空白帯で例外");

console.log("  ✅ PASS: 全異常系 (不正keep/op/NaN/破損state/未知id/重複/穴) の確実な例外遮断を確認");

// 7. 🎯 動的目標値 (TargetBuilder) ＆ 以上・以下・バリデーション検問
console.log("\n🔍 [Core-7] 動的目標値 (TargetBuilder) ＆ 以上・以下・自己検問...");
const targetSys = new CheckSystem({ seed: 8888 });

// 7-A. 「以上」判定: 8以上成功 (8-10成功, 11+大成功, 7以下失敗)
const baseDef = checkSys.definitions["standard_2d6"];
const gteDef = TargetBuilder.build(baseDef, { successAt: 8, greatSuccessAt: 11 });
assert.strictEqual(gteDef.outcomes.length, 3);
assert.deepStrictEqual(gteDef.outcomes[0], { id: "failure", min: null, max: 7, nameKey: "CHECK_OUTCOME_FAILURE" });
assert.deepStrictEqual(gteDef.outcomes[1], { id: "success", min: 8, max: 10, nameKey: "CHECK_OUTCOME_SUCCESS" });
assert.deepStrictEqual(gteDef.outcomes[2], { id: "great_success", min: 11, max: null, nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" });

// 7-B. 「以下」判定: 5以下成功 (3以下大成功, 4-5成功, 6以上失敗)
const lteDef = TargetBuilder.build(baseDef, { comparison: "<=", successAt: 5, greatSuccessAt: 3 });
assert.strictEqual(lteDef.outcomes.length, 3);
assert.deepStrictEqual(lteDef.outcomes[0], { id: "great_success", min: null, max: 3, nameKey: "CHECK_OUTCOME_GREAT_SUCCESS" });
assert.deepStrictEqual(lteDef.outcomes[1], { id: "success", min: 4, max: 5, nameKey: "CHECK_OUTCOME_SUCCESS" });
assert.deepStrictEqual(lteDef.outcomes[2], { id: "failure", min: 6, max: null, nameKey: "CHECK_OUTCOME_FAILURE" });

// 7-C. resolve 経由での動的判定実行 ＆ 決定論的検証
const dynRes = targetSys.resolve({
    checkId: "standard_2d6",
    actionId: "test_dynamic",
    target: { successAt: 8, greatSuccessAt: 11 }
});
assert.ok(dynRes.finalTotal >= 2 && dynRes.finalTotal <= 12);
if (dynRes.finalTotal >= 11) {
    assert.strictEqual(dynRes.outcome.id, "great_success");
} else if (dynRes.finalTotal >= 8) {
    assert.strictEqual(dynRes.outcome.id, "success");
} else {
    assert.strictEqual(dynRes.outcome.id, "failure");
}

// 7-D. 異常系: successAt が整数でない / 不正な順序
assert.throws(() => TargetBuilder.build(baseDef, { successAt: NaN }), /target\.successAt must be an integer/);
assert.throws(() => TargetBuilder.build(baseDef, { comparison: ">=", successAt: 8, greatSuccessAt: 7 }), /greatSuccessAt .* must be greater than successAt/);
assert.throws(() => TargetBuilder.build(baseDef, { comparison: "<=", successAt: 5, greatSuccessAt: 6 }), /greatSuccessAt .* must be less than successAt/);
assert.throws(() => TargetBuilder.build(baseDef, { comparison: "!=" }), /Unsupported comparison/);

console.log("  ✅ PASS: TargetBuilder 動的目標値 (>=, <=, 自己区間検問, Fail-Fast) 正常確認");

console.log("\n============================================================");
console.log("🎉 [Phase 2: CheckSystem Core Verification Test] ALL PASS");
console.log("============================================================");
