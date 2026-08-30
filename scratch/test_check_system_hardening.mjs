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

console.log("  ✅ PASS: 不正 keep ルール (タイプミス / 範囲外) の遮断確認");

// 2. 🛡️ CheckResolver 未知 operation 検知 ＆ checkSequence: 0 保持検問
console.log("\n🔍 [H-2] CheckResolver 未知 operation 検知 ＆ checkSequence 検問...");
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

// checkSequence: 0 が 1 に化けず正しく 0 として保持されること
const seqZeroRes = CheckResolver.resolve({
    checkDef,
    rng: dummyRng,
    checkSequence: 0
});
assert.strictEqual(seqZeroRes.checkSequence, 0, "checkSequence: 0 が 1 に化けず正しく 0 として保持されること");

console.log("  ✅ PASS: 未知 operation 即時例外 ＆ checkSequence: 0 保持確認");

// 3. 🛡️ CheckSystem.setState ＆ RandomSource.setState 厳格型検問
console.log("\n🔍 [H-3] CheckSystem.setState ＆ RandomSource.setState 厳格型検問...");
const checkSys = new CheckSystem({ seed: 999 });

// savedState が null
assert.throws(() => {
    checkSys.setState(null);
}, /savedState must be an object/, "savedState: null は例外を投げること");

// savedState.rng が欠落
assert.throws(() => {
    checkSys.setState({});
}, /savedState\.rng is missing or invalid/, "savedState.rng 欠落は例外を投げること");

// savedState.rng.seed が非整数
assert.throws(() => {
    checkSys.setState({ rng: { seed: "invalid", state: 111, callCount: 0 } });
}, /savedState\.seed must be an integer/, "seed 非整数は例外を投げること");

console.log("  ✅ PASS: CheckSystem.setState Fail-Fast 厳格型検証確認");

// 4. 🛡️ CheckDefinition 数学的区間バリデータ検問
console.log("\n🔍 [H-4] CheckDefinition 数学的区間バリデータ検問...");

// 下限が -Infinity から始まっていない (負の出目に穴)
const noLowerInfDef = {
    bad_lower: {
        id: "bad_lower",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { min: 2, max: 8, id: "failure" },
            { min: 9, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(noLowerInfDef);
}, /Lowest outcome "failure" must have no min/, "下限が -Infinity でない定義は例外になること");

// 上限が +Infinity で終わっていない (極大出目に穴)
const noUpperInfDef = {
    bad_upper: {
        id: "bad_upper",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 8, id: "failure" },
            { min: 9, max: 12, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(noUpperInfDef);
}, /Highest outcome "success" must have no max/, "上限が +Infinity でない定義は例外になること");

// 出目重複 (7〜8 が 2 つの outcome に被る)
const overlappingDef = {
    bad_overlap: {
        id: "bad_overlap",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 8, id: "failure" },
            { min: 7, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(overlappingDef);
}, /Overlapping outcomes detected/, "区間重複はバリデータで検知され例外になること");

// 空白帯 (出目 8 が抜けている)
const gapDef = {
    bad_gap: {
        id: "bad_gap",
        dice: { count: 2, sides: 6, keep: "all" },
        outcomes: [
            { max: 7, id: "failure" },
            { min: 9, id: "success" }
        ]
    }
};
assert.throws(() => {
    validateCheckDefinitions(gapDef);
}, /Gap detected between "failure" .* and "success"/, "区間空白帯 (穴) はバリデータで検知され例外になること");

console.log("  ✅ PASS: 数学的区間バリデータ検問合格 ((-∞, +∞) 完全排他連続性を実証)");

// 5. 🌟 正常 CheckSystem の初期化 ＆ 動作確認
console.log("\n🔍 [H-5] 硬化後 CheckSystem 正常初期化 ＆ 動作確認...");
const checkSysValid = new CheckSystem({ seed: 777 });
const res = checkSysValid.resolve({
    checkId: "standard_2d6",
    actionId: "act_test",
    checkSequence: 0,
    modifiers: [new CheckModifier({ source: "tactics", operation: "add", value: 1 })]
});
assert.strictEqual(res.checkSequence, 0, "checkSequence: 0 が保持されていること");
assert.ok(res.outcome.id, "正常定義から outcome が取得できること");
console.log("  ✅ PASS: CheckSystem 正常稼働確認");

console.log("\n============================================================");
console.log("🎉 [Hardening Test: Fail-Fast & Validation Enforcement] ALL PASS");
console.log("============================================================");
