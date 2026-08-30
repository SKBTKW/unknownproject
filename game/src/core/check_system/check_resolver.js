/**
 * ⚖️ CheckResolver (判定解決 ＆ CheckResult 生成モジュール)
 * 
 * 責務:
 * 1. 判定定義 (checkDef) と Modifier パイプラインを解釈し、最終合計値と結果帯 (outcome) を算出する。
 * 2. 決定論的かつ純粋な事実データ CheckResult を生成する。
 * 3. リアル時刻 (timestamp) や UI 固有の表示プロパティを含めず、Unity Ready なデータ構造を保つ。
 */

import { DicePool } from './dice_pool.js';

export class CheckModifier {
    /**
     * @param {Object} params
     * @param {string} params.source - 修正源 ("terrain", "intel", etc.)
     * @param {string} [params.operation="add"] - "add" | "subtract" 等
     * @param {number} [params.value=0] - 修正値
     */
    constructor({ source, operation = "add", value = 0 }) {
        this.source = source || "unknown";
        this.operation = operation;
        this.value = Number(value) || 0;
    }
}

export class CheckResolver {
    /**
     * ⚖️ 判定の同期解決
     * @param {Object} params
     * @param {Object} params.checkDef - CHECK_DEFINITIONS の 1 要素
     * @param {Object} params.rng - RandomSource インスタンス
     * @param {Array<CheckModifier|Object>} [params.modifiers=[]] - 修正値リスト
     * @param {string|number|null} [params.actionId=null] - ActionTransaction 識別子
     * @param {number} [params.checkSequence=1] - Action 内の連番
     * @returns {Object} CheckResult
     */
    static resolve({ checkDef, rng, modifiers = [], actionId = null, checkSequence = 1 }) {
        if (!checkDef) {
            throw new Error("CheckResolver.resolve requires a valid checkDef");
        }
        if (!rng) {
            throw new Error("CheckResolver.resolve requires a RandomSource instance");
        }

        const beforeState = rng.debugRngTrace ? rng.getState() : null;

        // 1. 🎲 ダイスロール (DicePool)
        const diceResult = DicePool.roll(checkDef.dice, rng);
        const rawTotal = diceResult.kept.reduce((acc, v) => acc + v, 0);

        // 2. ➕ Modifier パイプラインの適用
        let modifierTotal = 0;
        const appliedModifiers = [];

        for (const mod of modifiers) {
            const op = mod.operation || "add";
            const val = Number(mod.value) || 0;

            if (op === "add") {
                modifierTotal += val;
                appliedModifiers.push({ source: mod.source, operation: "add", value: val, applied: val });
            } else if (op === "subtract") {
                modifierTotal -= val;
                appliedModifiers.push({ source: mod.source, operation: "subtract", value: val, applied: -val });
            } else {
                // 将来の拡張操作フック (reroll / cap 等)
                appliedModifiers.push({ source: mod.source, operation: op, value: val, applied: 0 });
            }
        }

        const finalTotal = rawTotal + modifierTotal;

        // 3. 🎯 結果帯 (Outcome) の特定
        let matchedOutcome = null;
        if (Array.isArray(checkDef.outcomes)) {
            for (const outcome of checkDef.outcomes) {
                const passMin = outcome.min === undefined || finalTotal >= outcome.min;
                const passMax = outcome.max === undefined || finalTotal <= outcome.max;
                if (passMin && passMax) {
                    matchedOutcome = outcome;
                    break;
                }
            }
        }

        if (!matchedOutcome) {
            matchedOutcome = { id: "unknown", nameKey: "CHECK_OUTCOME_UNKNOWN" };
        }

        const afterState = rng.debugRngTrace ? rng.getState() : null;

        // 4. 📜 CheckResult (純粋事実データ) の構築
        const rngRecord = {
            seed: rng.initialSeed,
            callCount: rng.callCount
        };
        if (rng.debugRngTrace) {
            rngRecord.beforeState = beforeState;
            rngRecord.afterState = afterState;
        }

        return {
            checkId: checkDef.id,
            actionId: actionId !== undefined ? actionId : null,
            checkSequence: checkSequence || 1,
            dice: {
                rolled: diceResult.rolled,
                kept: diceResult.kept,
                dropped: diceResult.dropped
            },
            modifiers: appliedModifiers,
            rawTotal,
            modifierTotal,
            finalTotal,
            outcome: {
                id: matchedOutcome.id,
                nameKey: matchedOutcome.nameKey
            },
            rng: rngRecord
        };
    }
}

if (typeof window !== "undefined") {
    window.CheckModifier = CheckModifier;
    window.CheckResolver = CheckResolver;
}
if (typeof globalThis !== "undefined") {
    globalThis.CheckModifier = CheckModifier;
    globalThis.CheckResolver = CheckResolver;
}
