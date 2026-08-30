/**
 * ⚖️ CheckResolver (判定解決 ＆ CheckResult 生成モジュール)
 * 
 * 責務:
 * 1. 判定定義 (checkDef) と Modifier パイプラインを解釈し、最終合計値と結果帯 (outcome) を算出する。
 * 2. 未知の operation (タイプミス "ad" 等) や不正な数値を黙殺せず即時例外 (Fail-Fast)。
 * 3. 決定論的かつ純粋な事実データ CheckResult を生成する。
 */

import { DicePool } from './dice_pool.js';

export class CheckModifier {
    /**
     * @param {Object} params
     * @param {string} params.source - 修正源 ("terrain", "intel", etc.)
     * @param {string} [params.operation="add"] - "add" | "subtract"
     * @param {number} [params.value=0] - 修正値 (有限数値)
     */
    constructor({ source, operation = "add", value = 0 }) {
        this.source = source || "unknown";
        this.operation = operation;
        this.value = Number(value);
        if (!Number.isFinite(this.value)) {
            throw new Error(`[CheckModifier] Invalid value: ${value}. Must be a finite number.`);
        }
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
        if (!checkDef || typeof checkDef !== "object") {
            throw new Error("[CheckResolver] resolve failed: checkDef must be an object.");
        }
        if (!rng || typeof rng.nextInt !== "function") {
            throw new Error("[CheckResolver] resolve failed: rng must be a valid RandomSource instance.");
        }

        const beforeState = rng.debugRngTrace ? rng.getState() : null;

        // 1. 🎲 ダイスロール (DicePool)
        const diceResult = DicePool.roll(checkDef.dice, rng);
        const rawTotal = diceResult.kept.reduce((acc, v) => acc + v, 0);

        // 2. ➕ Modifier パイプラインの適用 (厳格検証)
        let modifierTotal = 0;
        const appliedModifiers = [];

        for (const mod of modifiers) {
            const op = mod.operation;
            const val = Number(mod.value);

            if (!Number.isFinite(val)) {
                throw new Error(`[CheckResolver] Invalid modifier value for source "${mod.source}": ${mod.value}.`);
            }

            if (op === "add") {
                modifierTotal += val;
                appliedModifiers.push({ source: mod.source, operation: "add", value: val, applied: val });
            } else if (op === "subtract") {
                modifierTotal -= val;
                appliedModifiers.push({ source: mod.source, operation: "subtract", value: val, applied: -val });
            } else {
                // ⚠️ 未知の operation (タイプミス "ad" 等) は黙殺せず即例外
                throw new Error(`[CheckResolver] Unsupported modifier operation: "${op}" from source "${mod.source}". Supported operations are "add" and "subtract".`);
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
            checkSequence: Number.isInteger(checkSequence) ? checkSequence : 1,
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
