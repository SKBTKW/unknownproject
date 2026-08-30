/**
 * 🏛️ ActionTransactionManager (ゲームアクション・トランザクション統括モジュール)
 * 
 * 責務:
 * 1. 以下の 6 段階パイプラインに従ってゲームアクションを不可分 (Atomic) に実行する。
 *    - Validate (事前バリデーション: 失敗時は一切ステートに触れず拒絶)
 *    - Snapshot (Undo 用ステート保存)
 *    - Execute (コア変更)
 *    - Derived Effects (派生効果: マージ、CD、UNIQUE消費、即時ボーナス等)
 *    - Commit (アクション履歴 Action History への記録)
 *    - Rollback (例外・失敗時の完全巻き戻し)
 * 2. 1 Action を Undo すれば、派生効果を含めたゲーム世界が 100% 完全復元されることを保証する。
 */

export class ActionTransactionManager {
    /**
     * @param {Object} engine - GameEngine
     */
    constructor(engine) {
        this.engine = engine;
        this.history = []; // 完了した Action レコードのスタック
    }

    /**
     * 🛡️ トランザクションの実行
     * @param {string} actionType - アクション種別 ("PLACE_LAND", "RESERVE_CARD", etc.)
     * @param {Object} pipeline - { validate, execute, applyDerivedEffects }
     * @param {Object} [payload={}] - アクション引数コンテキスト
     * @returns {Object} { success: boolean, ... }
     */
    execute(actionType, pipeline, payload = {}) {
        const state = this.engine ? this.engine.state : null;
        if (!state) return { success: false, reason: "NO_STATE" };

        // 1. 🔍 Validate (事前バリデーション - 読み取り専用)
        if (typeof pipeline.validate === "function") {
            const validation = pipeline.validate(state, payload);
            if (validation && validation.can === false) {
                return { success: false, reason: validation.reason || "VALIDATION_FAILED" };
            }
        }

        // 2. 📸 Snapshot (事前ステート記録)
        const undoSys = this.engine.undoSystem;
        if (undoSys) {
            if (actionType === "PLACE_LAND" && payload.placedCoords) {
                undoSys.placedCellCoords = payload.placedCoords;
            }
            if (typeof undoSys.captureSnapshot === "function") {
                undoSys.captureSnapshot(payload.placedCoords || []);
            } else if (typeof undoSys.recordSnapshot === "function") {
                undoSys.recordSnapshot(payload.placedCoords || []);
            }
        }

        try {
            // 3. ⚙️ Execute (コア変更の実行)
            const execResult = typeof pipeline.execute === "function"
                ? pipeline.execute(state, payload)
                : { success: true };

            if (execResult && execResult.success === false) {
                // コア変更失敗時の即座ロールバック
                this.rollback(actionType, execResult.reason);
                return execResult;
            }

            // 4. 🌟 Derived Effects (派生効果の適用)
            let derivedResult = null;
            if (typeof pipeline.applyDerivedEffects === "function") {
                derivedResult = pipeline.applyDerivedEffects(state, payload, execResult);
                if (derivedResult && derivedResult.success === false) {
                    this.rollback(actionType, derivedResult.reason);
                    return derivedResult;
                }
            }

            // 5. 📜 Commit (コミット ＆ 履歴登録)
            const record = {
                id: `act_${Date.now()}_${this.history.length}`,
                type: actionType,
                payload: { ...payload },
                timestamp: Date.now(),
                result: execResult,
                derived: derivedResult
            };
            this.history.push(record);

            return {
                success: true,
                actionId: record.id,
                result: execResult,
                derived: derivedResult
            };
        } catch (err) {
            // 例外発生時の完全ロールバック
            console.error(`🔥 [Transaction Exception: ${actionType}]`, err);
            this.rollback(actionType, err.message);
            return { success: false, error: err };
        }
    }

    /**
     * ↩️ ロールバック処理
     */
    rollback(actionType, reason) {
        if (this.engine && this.engine.undoSystem && typeof this.engine.undoSystem.undo === "function") {
            this.engine.undoSystem.undo();
        }
    }

    /**
     * ↩️ 直前アクションの Undo 実行
     */
    undo() {
        if (this.history.length === 0) {
            // 履歴が空でも undoSystem 自体がスナップショットを持っていれば実行
            if (this.engine && this.engine.undoSystem && typeof this.engine.undoSystem.undo === "function") {
                return { success: this.engine.undoSystem.undo() };
            }
            return { success: false, reason: "NO_HISTORY" };
        }

        const lastAction = this.history.pop();
        let ok = false;
        if (this.engine && this.engine.undoSystem && typeof this.engine.undoSystem.undo === "function") {
            ok = this.engine.undoSystem.undo();
        }
        return { success: ok, undoneAction: lastAction };
    }

    /**
     * 🧹 履歴クリア (ターン進行時など)
     */
    clearHistory() {
        this.history = [];
    }
}

if (typeof window !== "undefined") {
    window.ActionTransactionManager = ActionTransactionManager;
}
if (typeof globalThis !== "undefined") {
    globalThis.ActionTransactionManager = ActionTransactionManager;
}
