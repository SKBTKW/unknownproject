/**
 * 🏛️ ActionTransactionManager (ゲームアクション・トランザクション統括モジュール)
 */
export class ActionTransactionManager {
    constructor(engine) {
        this.engine = engine;
        this.history = [];
    }

    execute(actionType, pipeline, payload = {}) {
        const state = this.engine ? this.engine.state : null;
        if (!state) return { success: false, reason: "NO_STATE" };

        const runTermination = this.engine?.runTerminationService?.getResult?.()
            || state.runTermination
            || null;
        if (runTermination?.terminated) {
            return {
                success: false,
                reason: "RUN_TERMINATED",
                runTermination: JSON.parse(JSON.stringify(runTermination))
            };
        }

        if (typeof pipeline.validate === "function") {
            const validation = pipeline.validate(state, payload);
            if (validation && validation.can === false) {
                return { success: false, reason: validation.reason || "VALIDATION_FAILED" };
            }
        }

        const undoSys = this.engine.undoSystem;
        if (undoSys) {
            if (actionType === "PLACE_LAND" && payload.placedCoords) undoSys.placedCellCoords = payload.placedCoords;
            if (typeof undoSys.captureSnapshot === "function") undoSys.captureSnapshot(payload.placedCoords || []);
            else if (typeof undoSys.recordSnapshot === "function") undoSys.recordSnapshot(payload.placedCoords || []);
        }

        try {
            const execResult = typeof pipeline.execute === "function"
                ? pipeline.execute(state, payload)
                : { success: true };
            if (execResult && execResult.success === false) {
                this.rollback(actionType, execResult.reason);
                return execResult;
            }

            let derivedResult = null;
            if (typeof pipeline.applyDerivedEffects === "function") {
                derivedResult = pipeline.applyDerivedEffects(state, payload, execResult);
                if (derivedResult && derivedResult.success === false) {
                    this.rollback(actionType, derivedResult.reason);
                    return derivedResult;
                }
            }

            const record = {
                id: `act_${Date.now()}_${this.history.length}`,
                type: actionType,
                payload: { ...payload },
                timestamp: Date.now(),
                result: execResult,
                derived: derivedResult
            };
            this.history.push(record);
            return { success: true, actionId: record.id, result: execResult, derived: derivedResult };
        } catch (err) {
            console.error(`🔥 [Transaction Exception: ${actionType}]`, err);
            this.rollback(actionType, err.message);
            return { success: false, error: err };
        }
    }

    rollback(actionType, reason) {
        if (this.engine && this.engine.undoSystem && typeof this.engine.undoSystem.undo === "function") {
            this.engine.undoSystem.undo();
        }
    }

    undo() {
        if (this.history.length === 0) {
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

    clearHistory() {
        this.history = [];
    }
}

if (typeof window !== "undefined") window.ActionTransactionManager = ActionTransactionManager;
if (typeof globalThis !== "undefined") globalThis.ActionTransactionManager = ActionTransactionManager;
