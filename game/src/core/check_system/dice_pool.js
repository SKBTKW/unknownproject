/**
 * 🎲 DicePool (純粋ダイスプール生成モジュール)
 * 
 * 責務:
 * 1. 指定された個数 (count) と面数 (sides) のダイスを RandomSource からロールする。
 * 2. 抽出ルール (keep: "all" | "highest_N" | "lowest_N") に従って出目を採用/除外する。
 * 3. 不正なルール指定やタイプミス (higest_2, highest_99 等) を黙殺せず、即時例外 (Fail-Fast) を投げる。
 */

export class DicePool {
    /**
     * 🎲 ダイスロールの実行
     * @param {Object} diceDef - { count: 2, sides: 6, keep: "all" }
     * @param {Object} rng - RandomSource インスタンス
     * @returns {Object} { rolled: number[], kept: number[], dropped: number[] }
     */
    static roll(diceDef, rng) {
        if (!diceDef || typeof diceDef !== "object") {
            throw new Error("[DicePool] Invalid diceDef: must be an object.");
        }

        const count = diceDef.count;
        const sides = diceDef.sides;
        const keepRule = diceDef.keep || "all";

        if (!Number.isInteger(count) || count < 1) {
            throw new Error(`[DicePool] Invalid dice count: ${count}. Must be an integer >= 1.`);
        }
        if (!Number.isInteger(sides) || sides < 2) {
            throw new Error(`[DicePool] Invalid dice sides: ${sides}. Must be an integer >= 2.`);
        }

        const rolled = [];
        for (let i = 0; i < count; i++) {
            rolled.push(rng.nextInt(1, sides));
        }

        let kept = [];
        let dropped = [];

        if (keepRule === "all") {
            kept = [...rolled];
            dropped = [];
        } else if (typeof keepRule === "string" && keepRule.startsWith("highest_")) {
            const rawN = keepRule.replace("highest_", "");
            const n = parseInt(rawN, 10);
            if (!Number.isInteger(n) || n < 1 || n > count || String(n) !== rawN) {
                throw new Error(`[DicePool] Invalid keep rule "${keepRule}": N must be an integer between 1 and count (${count}).`);
            }
            const sorted = [...rolled].sort((a, b) => b - a);
            kept = sorted.slice(0, n);
            dropped = sorted.slice(n);
        } else if (typeof keepRule === "string" && keepRule.startsWith("lowest_")) {
            const rawN = keepRule.replace("lowest_", "");
            const n = parseInt(rawN, 10);
            if (!Number.isInteger(n) || n < 1 || n > count || String(n) !== rawN) {
                throw new Error(`[DicePool] Invalid keep rule "${keepRule}": N must be an integer between 1 and count (${count}).`);
            }
            const sorted = [...rolled].sort((a, b) => a - b);
            kept = sorted.slice(0, n);
            dropped = sorted.slice(n);
        } else {
            // 未知の keep ルール (タイプミス higest_2 等) を検知して即例外
            throw new Error(`[DicePool] Unknown keep rule: "${keepRule}". Allowed rules are "all", "highest_N", or "lowest_N".`);
        }

        return {
            rolled,
            kept,
            dropped
        };
    }
}
