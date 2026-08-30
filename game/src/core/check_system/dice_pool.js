/**
 * 🎲 DicePool (純粋ダイスプール生成モジュール)
 * 
 * 責務:
 * 1. 指定された個数 (count) と面数 (sides) のダイスを RandomSource からロールする。
 * 2. 抽出ルール (keep: "all" | "highest_N" | "lowest_N") に従って出目を採用/除外する。
 * 3. 判定の意味や結果帯を知らず、純粋な出目データのみを生成する。
 */

export class DicePool {
    /**
     * 🎲 ダイスロールの実行
     * @param {Object} diceDef - { count: 2, sides: 6, keep: "all" }
     * @param {Object} rng - RandomSource インスタンス
     * @returns {Object} { rolled: number[], kept: number[], dropped: number[] }
     */
    static roll(diceDef, rng) {
        const count = Math.max(1, diceDef.count || 2);
        const sides = Math.max(2, diceDef.sides || 6);
        const keepRule = diceDef.keep || "all";

        const rolled = [];
        for (let i = 0; i < count; i++) {
            rolled.push(rng.nextInt(1, sides));
        }

        // 抽出ルールに応じた kept / dropped 分離
        let kept = [...rolled];
        let dropped = [];

        if (keepRule === "all") {
            // 全ダイス採用
            kept = [...rolled];
            dropped = [];
        } else if (keepRule.startsWith("highest_")) {
            const n = parseInt(keepRule.replace("highest_", ""), 10) || 1;
            // 降順ソート
            const sorted = [...rolled].sort((a, b) => b - a);
            kept = sorted.slice(0, n);
            dropped = sorted.slice(n);
        } else if (keepRule.startsWith("lowest_")) {
            const n = parseInt(keepRule.replace("lowest_", ""), 10) || 1;
            // 昇順ソート
            const sorted = [...rolled].sort((a, b) => a - b);
            kept = sorted.slice(0, n);
            dropped = sorted.slice(n);
        }

        return {
            rolled,
            kept,
            dropped
        };
    }
}

if (typeof window !== "undefined") {
    window.DicePool = DicePool;
}
if (typeof globalThis !== "undefined") {
    globalThis.DicePool = DicePool;
}
