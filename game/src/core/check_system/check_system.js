/**
 * 🏛️ CheckSystem (判定システム Facade モジュール)
 * 
 * 責務:
 * 1. RandomSource, DicePool, CheckDefinitions, CheckResolver を統括する公開インターフェース。
 * 2. 外部 (ActionTransaction / Tactics / Events) からの resolve 要求を即座に同期解決する。
 * 3. 演出や DOM を一切知らず、純粋な CheckResult を返す。
 * 4. getState / setState により、ゲームステート全体の決定論的直列化 (serializeGameState) に対応する。
 */

import { RandomSource } from './random_source.js';
import { CHECK_DEFINITIONS } from './check_definitions.js';
import { CheckResolver, CheckModifier } from './check_resolver.js';

export class CheckSystem {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.seed] - シード値
     * @param {boolean} [options.debugRngTrace=false] - デバッグ用トレース
     * @param {Object} [options.customDefinitions={}] - 追加定義
     */
    constructor(options = {}) {
        this.rng = new RandomSource(options.seed, { debugRngTrace: options.debugRngTrace });
        this.definitions = { ...CHECK_DEFINITIONS, ...(options.customDefinitions || {}) };
    }

    /**
     * ⚖️ 判定の実行 (同期即時解決)
     * @param {Object} params
     * @param {string} params.checkId - 判定定義ID ("standard_2d6", "trial_intercept" 等)
     * @param {Array<CheckModifier|Object>} [params.modifiers=[]] - 修正値リスト
     * @param {string|number|null} [params.actionId=null] - Action 識別子
     * @param {number} [params.checkSequence=1] - Action 内連番
     * @returns {Object} CheckResult
     */
    resolve({ checkId = "standard_2d6", modifiers = [], actionId = null, checkSequence = 1 } = {}) {
        const checkDef = this.definitions[checkId];
        if (!checkDef) {
            throw new Error(`[CheckSystem] Unknown checkId: ${checkId}`);
        }

        return CheckResolver.resolve({
            checkDef,
            rng: this.rng,
            modifiers,
            actionId,
            checkSequence
        });
    }

    /**
     * 📸 状態取得 (Undo / Replay / Save 用)
     * @returns {Object}
     */
    getState() {
        return {
            rng: this.rng.getState()
        };
    }

    /**
     * ↩️ 状態復元 (Undo / Replay 用)
     * @param {Object} savedState
     */
    setState(savedState) {
        if (savedState && savedState.rng) {
            this.rng.setState(savedState.rng);
        }
    }
}

export { RandomSource, CHECK_DEFINITIONS, CheckResolver, CheckModifier };

if (typeof window !== "undefined") {
    window.CheckSystem = CheckSystem;
}
if (typeof globalThis !== "undefined") {
    globalThis.CheckSystem = CheckSystem;
}
