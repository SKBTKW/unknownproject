/**
 * 🎲 RandomSource (決定論的疑似乱数生成モジュール)
 * 
 * 責務:
 * 1. シード値に基づく決定論的疑似乱数（Mulberry32 PRNG）の生成。
 * 2. 状態（seed, state, callCount）の完全な直列化・復元 (getState / setState)。
 * 3. debugRngTrace が有効な場合のみ、直前状態 beforeState をトレース可能にする。
 */

export class RandomSource {
    /**
     * @param {number} [seed=12345678] - 初期シード値 (32bit符号なし整数)
     * @param {Object} [options={}]
     * @param {boolean} [options.debugRngTrace=false] - 開発環境用詳細トレースフラグ
     */
    constructor(seed = 12345678, options = {}) {
        this.initialSeed = (seed !== undefined ? seed : 12345678) >>> 0;
        this.state = this.initialSeed;
        this.callCount = 0;
        this.debugRngTrace = !!options.debugRngTrace;
    }

    /**
     * 🎲 Mulberry32 による 0 以上 1 未満の疑似乱数生成
     * @returns {number} 0 <= x < 1
     */
    nextFloat() {
        this.callCount++;
        let t = (this.state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * 🎯 min 以上 max 以下の整数の生成 (ダイス目用: 1〜sides)
     * @param {number} min - 最小値 (inclusive)
     * @param {number} max - 最大値 (inclusive)
     * @returns {number}
     */
    nextInt(min, max) {
        const f = this.nextFloat();
        return Math.floor(f * (max - min + 1)) + min;
    }

    /**
     * 📸 現在の PRNG 内部状態取得 (Undo / Replay / Save 用)
     * @returns {Object}
     */
    getState() {
        return {
            seed: this.initialSeed,
            state: this.state,
            callCount: this.callCount
        };
    }

    /**
     * ↩️ 内部状態の完全復元 (Undo / Replay 用)
     * @param {Object} savedState
     */
    setState(savedState) {
        if (!savedState) return;
        this.initialSeed = savedState.seed >>> 0;
        this.state = savedState.state >>> 0;
        this.callCount = savedState.callCount || 0;
    }
}

if (typeof window !== "undefined") {
    window.RandomSource = RandomSource;
}
if (typeof globalThis !== "undefined") {
    globalThis.RandomSource = RandomSource;
}
