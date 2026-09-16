import assert from "assert";
import { CheckSystem, CheckModifier, RandomSource, DicePool, CheckResolver } from "../game/src/core/check_system/check_system.js";
import { validateCheckDefinitions } from "../game/src/core/check_system/check_validator.js";

console.log("============================================================");
console.log("🧪 [Hardening Test: Comprehensive Negative Tests & Fail-Fast]");
console.log("============================================================");

const dummyRng = new RandomSource(12345);

// 1. 🛡️ RandomSource.nextInt 引数検証 (Negative Tests)
console.log("🔍 [NEG-1] RandomSource.nextInt 引数検証...");
assert.throws(() => dummyRng.nextInt(10, 2), /min \(10\) cannot be greater than max \(2\)/, "min > max で例外");
assert.throws(() => dummyRng.nextInt(NaN, 6), /min must be an integer/, "min が NaN で例外");
assert.throws(() => dummyRng.nextInt(1, NaN), /max must be an integer/, "max が NaN で例外");
assert.throws(() => dummyRng.nextInt(1.5, 6), /min must be an integer/, "min が小数の場合例外");
assert.throws(() => dummyRng.nextInt(1, 5.5), /max must be an integer/, "max が小数の場合例外");
console.log("  ✅ PASS: nextInt(min, max) 厳格型検証確認 (min > max, NaN, 小数を完全遮断)");

// 2. 🛡️ DicePool keep ルール (Negative Tests)
console.log("\n🔍 [NEG-2] DicePool keep ルール異常系...");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "higest_2" }, dummyRng), /Unknown keep rule/, "higest_2 で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "highest_99" }, dummyRng), /N must be an integer between 1 and count/, "highest_99 (count超過) で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "highest_0" }, dummyRng), /N must be an integer between 1 and count/, "highest_0 (0以下) で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 6, keep: "highest_02" }, dummyRng), /N must be an integer between 1 and count/, "highest_02 (曖昧指定) で例外");
assert.throws(() => DicePool.roll({ count: 0, sides: 6 }, dummyRng), /dice count/, "count < 1 で例外");
assert.throws(() => DicePool.roll({ count: 2, sides: 1 }, dummyRng), /dice sides/, "sides < 2 で例外");
console.log("  ✅ PASS: DicePool 不正 keep ルール・ダイス数遮断確認");

// 3. 🛡️ CheckResolver 修正値＆Plain Object 仕様統一検問
console.log("\n🔍 [NEG-3] CheckResolver 修正値仕様検問 (Negative & Plain Object)...");
const validCheckDef = {
    id: "test",
    dice: { count: 2, sides: 6, keep: "all" },
    outcomes: [{ max: 5, id: "f" }, { min: 6, id: "s" }]
};

// タイプミス "ad" で例外
assert.throws(() => {
    CheckResolver.resolve({
        checkDef: validCheckDef,
        rng: dummyRng,
        modifiers: [{ source: "test", operation: "ad", value: 1 }]
    });
}, /Unsupported modifier operation: "ad"/, 'operation: "ad" は例外');

// NaN / Infinity 修正値で例外
assert.throws(() => {
    CheckResolver.resolve({
        checkDef: validCheckDef,
        rng: dummyRng,
        modifiers: [{ source: "test", value: NaN }]
    });
}, /Invalid modifier value/, "value: NaN は例外");

assert.throws(() => {
    CheckResolver.resolve({
        checkDef: validCheckDef,
        rng: dummyRng,
        modifiers: [{ source: "test", value: Infinity }]
    });
}, /Invalid modifier value/, "value: Infinity は例外");

// 🌟 Plain Object ({ source: "hill", value: 2 }) がデフォルトで add として正常動作すること
const plainObjRes = CheckResolver.resolve({
    checkDef: validCheckDef,
    rng: dummyRng,
    modifiers: [{ source: "hill", value: 2 }]
});
assert.strictEqual(plainObjRes.modifierTotal, 2, "Plain Object の operation 未指定はデフォルトで add (+2) として処理されること");
console.log("  ✅ PASS: 修正値異常系遮断 ＆ Plain Object デフォルト add 動作確認");

// 4. 🛡️ CheckResolver outcome 未マッチ時 Fail-Fast
console.log("\n🔍 [NEG-4] CheckResolver outcome 未マッチ時 Fail-Fast 検問...");
const brokenOutcomeDef = {
    id: "broken",
    dice: { count: 2, sides: 6, keep: "all" },
    outcomes: [{ max: 5, id: "f" }, { min: 8, id: "s" }] // 6, 7 が抜けている (validator 未通過データ)
};
// 出目 6 のときに例外が飛ぶこと
const forcedRng = { nextInt: () => 3 }; // 3 + 3 = 6
assert.throws(() => {
    CheckResolver.resolve({ checkDef: brokenOutcomeDef, rng: forcedRng });
}, /No outcome matched finalTotal 6/, "未マッチ時は unknown に逃げず即座に例外を投げること");
console.log("  ✅ PASS: outcome 未特定時の Fail-Fast 即時例外確認");

// 5. 🛡️ CheckSystem.resolve 未知 checkId 検問
console.log("\n🔍 [NEG-5] CheckSystem.resolve 未知 checkId 検問...");
const checkSys = new CheckSystem({ seed: 888 });
assert.throws(() => {
    checkSys.resolve({ checkId: "unknown_check_id" });
}, /Unknown checkId: unknown_check_id/, "未登録の checkId は即座に例外");
console.log("  ✅ PASS: 未知 checkId の即時例外確認");

// 6. 🛡️ setState 不正データ検知 (RandomSource ＆ CheckSystem)
console.log("\n🔍 [NEG-6] setState 不正データ検問...");
assert.throws(() => checkSys.setState(null), /savedState must be an object/, "CheckSystem.setState(null) は例外");
assert.throws(() => checkSys.setState({}), /savedState\.rng is missing/, "CheckSystem.setState({}) は例外");
assert.throws(() => checkSys.setState({ rng: { seed: "abc", state: 1, callCount: 0 } }), /seed must be an integer/, "seed 文字列は例外");
assert.throws(() => checkSys.setState({ rng: { seed: 1, callCount: 0 } }), /state must be an integer/, "state 欠落は例外");
assert.throws(() => checkSys.setState({ rng: { seed: 1, state: 1, callCount: -1 } }), /callCount must be a non-negative integer/, "callCount 負数は例外");
console.log("  ✅ PASS: setState 不正データ遮断確認");

// 7. 🛡️ CheckDefinition 区間バリデータ異常系 (Negative Tests)
console.log("\n🔍 [NEG-7] CheckDefinition 区間バリデータ異常系...");
// 下限穴
assert.throws(() => {
    validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ min: 2, max: 6, id: "a" }, { min: 7, id: "b" }] } });
}, /Lowest outcome "a" must have no min/, "下限が -Infinity でない場合は例外");

// 上限穴
assert.throws(() => {
    validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ max: 6, id: "a" }, { min: 7, max: 12, id: "b" }] } });
}, /Highest outcome "b" must have no max/, "上限が +Infinity でない場合は例外");

// 重複
assert.throws(() => {
    validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ max: 6, id: "a" }, { min: 6, id: "b" }] } });
}, /Overlapping outcomes detected/, "区間重複は例外");

// 穴 (Gap)
assert.throws(() => {
    validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ max: 6, id: "a" }, { min: 8, id: "b" }] } });
}, /Gap detected between "a" .* and "b"/, "区間の穴は例外");

// min > max
assert.throws(() => {
    validateCheckDefinitions({ bad: { id: "bad", dice: { count: 2, sides: 6 }, outcomes: [{ min: 5, max: 2, id: "a" }] } });
}, /min \(5\) > max \(2\)/, "min > max は例外");

console.log("  ✅ PASS: CheckDefinition 区間バリデータ全異常系遮断確認");

console.log("\n============================================================");
console.log("🎉 [Hardening Test: Comprehensive Negative Tests & Fail-Fast] ALL PASS");
console.log("============================================================");
