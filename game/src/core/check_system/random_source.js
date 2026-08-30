/**
 * 🎲 RandomSource (決定論的疑似乱数生成モジュール)
 * 
 * 責務:
 * 1. シード値に基づく決定論的疑似乱数（Mulberry32 PRNG）の生成。
 * 2. 状態（seed, state, callCount）の完全な直列化・復元 (getState / setState)。
 * 3. nextInt(min, max) および setState での厳格な型検証（壊れた入力・データのサイレント受け入れを禁止）。
 */

export class RandomSource {
    /**
     * @param {number} [seed=12345678] - 初期シード値 (32bit符号なし整数)
     * @param {Object} [options={}]
     * @param {boolean} [options.debugRngTrace=false] - 開発環境用詳細トレースフラグ
     */
    constructor(seed = 12345678, options = {}) {
        const parsedSeed = Number.isInteger(seed) ? seed : 12345678;
        this.initialSeed = parsedSeed >>> 0;
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
     * @param {number} min - 最小値 (inclusive, integer)
     * @param {number} max - 最大値 (inclusive, integer, max >= min)
     * @returns {number}
     */
    nextInt(min, max) {
        if (!Number.isInteger(min)) {
            throw new Error(`[RandomSource] nextInt failed: min must be an integer (received: ${min}).`);
        }
        if (!Number.isInteger(max)) {
            throw new Error(`[RandomSource] nextInt failed: max must be an integer (received: ${max}).`);
        }
        if (min > max) {
            throw new Error(`[RandomSource] nextInt failed: min (${min}) cannot be greater than max (${max}).`);
        }

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
     * ↩️ 内部状態の厳格な完全復元 (Undo / Replay 用: Fail-Fast)
     * @param {Object} savedState
     */
    setState(savedState) {
        if (!savedState || typeof savedState !== "object") {
            throw new Error("[RandomSource] setState failed: savedState must be an object.");
        }
        if (!Number.isInteger(savedState.seed)) {
            throw new Error(`[RandomSource] setState failed: savedState.seed must be an integer (received: ${savedState.seed}).`);
        }
        if (!Number.isInteger(savedState.state)) {
            throw new Error(`[RandomSource] setState failed: savedState.state must be an integer (received: ${savedState.state}).`);
        }
        if (!Number.isInteger(savedState.callCount) || savedState.callCount < 0) {
            throw new Error(`[RandomSource] setState failed: savedState.callCount must be a non-negative integer (received: ${savedState.callCount}).`);
        }

        this.initialSeed = savedState.seed >>> 0;
        this.state = savedState.state >>> 0;
        this.callCount = savedState.callCount;
    }
}
