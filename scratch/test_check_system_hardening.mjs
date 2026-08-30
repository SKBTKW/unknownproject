import assert from "assert";
import { CheckSystem, CheckModifier, RandomSource, DicePool, CheckResolver } from "../game/src/core/check_system/check_system.js";
import { validateCheckDefinitions } from "../game/src/core/check_system/check_validator.js";

console.log("============================================================");
console.log("🧪 [Hardening Test: Fail-Fast & Validation Enforcement]");
console.log("============================================================");

const dummyRng = new RandomSource(12345);

// 1. 🛡️ DicePool 不正 keep ルール検知検問 (Fail-Fast)
console.log("🔍 [H-1] DicePool 不正 keep ルール検問...");
// タイプミス "higest_2"
assert.throws(() => {
    DicePool.roll({ count: 2, sides: 6, keep: "higest_2" }, dummyRng);
}, /Unknown keep rule/, "higest_2 などのタイプミスは即座に例外を投げること");

// count 超過 "highest_99"
assert.throws(() => {
    DicePool.roll({ count: 2, sides: 6, keep: "highest_99" }, dummyRng);
}, /must be 1 <= N <= count|N must be an integer between 1 and count/, "count を超える N は即座に例外を投げること");

// 0以下の N
assert.throws(() => {
    DicePool.roll({ count: 2, sides: 6, keep: "highest_0" }, dummyRng);
}, /N must be an integer between 1 and count/, "0 以下の N は即座に例外を投げること");

console.log("  ✅ PASS: 不正 keep ルール (タイプミス / 範囲外) の完全遮断確認");

// 2. 🛡️ CheckResolver 未知 operation 検知検問 (Fail-Fast)
console.log("\n🔍 [H-2] CheckResolver 未知 operation 検問...");
const checkDef = {
    id: "test",
    dice: { count: 2, sides: 6, keep: "all" },
    outcomes: [{ max: 5, id: "f" }, { min: 6, id: "s" }]
};

// タイプミス "ad"
assert.throws(() => {
    CheckResolver.resolve({
        checkDef,
        rng: dummyRng,
        modifiers: [{ source: "test", operation: "ad", value: 1 }]
    });
}, /Unsupported modifier operation: "ad"/, 'operation: "ad" は黙殺されず即座に例外を投げること');

// 未実装操作 "reroll_lowest"
assert.throws(() => {
    CheckResolver.resolve({
        checkDef,
        rng: dummyRng,
        modifiers: [{ source: "test", operation: "reroll_lowest", value: 0 }]
    });
}, /Unsupported modifier operation: "reroll_lowest"/, '未実装操作 "reroll_lowest" は即座に例外を投げること');

console.log("  ✅ PASS: 未知 operation (タイプミス / 未実装) の即時例外検問合格");

// 3. 🛡️ RandomSource.setState 厳格型検問
console.log("\n🔍 [H-3] RandomSource.setState 厳格型検問...");
const rng = new RandomSource(111);

// seed が非整数
assert.throws(() => {
    rng.setState({ seed: "invalid", state: 111, callCount: 0 });
}, /savedState\.seed must be an integer/, "seed が非整数の場合は例外を投げること");

// state が欠落
assert.throws(() => {
    rng.setState({ seed: 111, callCount: 0 });
}, /savedState\.state must be an integer/, "state 欠落の場合は例外を投げること");

// callCount が負数
assert.throws(() => {
    rng.setState({ seed: 111, state: 111, callCount: -5 });
}, /savedState\.callCount must be a non-negative integer/, "callCount 負数は例外を投げること");

console.log("  ✅ PASS: setState 厳格型検証合格 (破損セーブデータのサイレント復元を禁止)");

// 4. 🛡️ CheckDefinition バリデータ検問
console.log("\n🔍 [H-4] CheckDefinition バリデータ検問...");

// 出目重複 (7〜8 が 2 つの outcome に被る)
const overlappingDef = {
    bad_overlap: {
        id: "bad_overlap",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 8, id: "failure" },
            { min: 7, max: 12, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(overlappingDef);
}, /Overlapping outcomes detected/, "出目重複はバリデータで検知され例外になること");

// 空白帯 (出目 8 が抜けている)
const gapDef = {
    bad_gap: {
        id: "bad_gap",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 7, id: "failure" },
            { min: 9, max: 12, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(gapDef);
}, /Gap \(uncovered value\) detected at roll value 8/, "出目空白帯 (穴) はバリデータで検知され例外になること");

// min > max の論理矛盾
const minMaxContradiction = {
    bad_min_max: {
        id: "bad_min_max",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { min: 10, max: 5, id: "failure" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(minMaxContradiction);
}, /min \(10\) > max \(5\)/, "min > max の論理矛盾は例外になること");

console.log("  ✅ PASS: CheckDefinition バリデータ検問合格 (重複・穴・矛盾の完全検知)");

// 5. 🌟 正常 CheckSystem の初期化 ＆ 動作確認
console.log("\n🔍 [H-5] 硬化後 CheckSystem 正常初期化 ＆ 動作確認...");
const checkSys = new CheckSystem({ seed: 777 });
const res = checkSys.resolve({
    checkId: "standard_2d6",
    actionId: "act_test",
    checkSequence: 1,
    modifiers: [new CheckModifier({ source: "tactics", operation: "add", value: 1 })]
});
assert.ok(res.outcome.id, "正常定義から outcome が取得できること");
console.log("  ✅ PASS: 硬化後 CheckSystem 正常稼働確認");

console.log("\n============================================================");
console.log("🎉 [Hardening Test: Fail-Fast & Validation Enforcement] ALL PASS (100%)");
console.log("============================================================");
