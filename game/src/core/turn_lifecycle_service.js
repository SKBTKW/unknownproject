/**
 * TurnLifecycleService
 *
 * Owns the boundary orchestration for advancing one turn.
 * R2 intentionally preserves the existing execution order and delegates
 * the actual turn increment / per-turn card reset to DeckManager.onNextTurn().
 *
 * Verse presentation/semantics are intentionally out of scope here.
 */
export class TurnLifecycleService {
    constructor(engine) {
        if (!engine) {
            throw new TypeError("TURN_LIFECYCLE_ENGINE_REQUIRED");
        }
        this.engine = engine;
    }

    advance({
        autoFallbackEnabled = true,
        useHypotheticalFallback = false
    } = {}) {
        const engine = this.engine;
        const state = engine.state;

        if (engine.transactionManager) engine.transactionManager.clearHistory();
        if (engine.undoSystem) engine.undoSystem.clearSnapshot();

        const maintenancePreview = engine.previewTurnEndMaintenance({ autoFallbackEnabled });
        const prods = maintenancePreview.production;

        if (state) {
            state.food += (prods.grossFood ?? 0);
            state.wood += (prods.totalWood ?? 0);
            state.material = state.wood;
            state.mystic += (prods.totalMystic ?? 1);
        }

        const fallbackPlan = !autoFallbackEnabled
            && useHypotheticalFallback
            && maintenancePreview.hypotheticalFallbackPlan.canFullyCover
            ? maintenancePreview.hypotheticalFallbackPlan
            : maintenancePreview.automaticPlan;

        if (state && typeof state.processTurnEndMaintenance === "function") {
            engine.lastTurnMaintenanceResult = state.processTurnEndMaintenance({
                ...maintenancePreview,
                fallbackPlan
            });
        }

        if (engine.globalEventManager) {
            engine.globalEventManager.tickTurn();
        }

        // Compatibility boundary: ownership moves out of DeckManager only in
        // the next refactor step after this extraction is regression-tested.
        if (engine.deckManager) {
            engine.deckManager.onNextTurn();
        } else if (state) {
            state.turn++;
            state.hasPickedThisTurn = false;
            state.hasMulliganedThisTurn = false;
        }

        if (engine.globalEventManager) {
            engine.globalEventManager.onTurnStart();
        }

        if (state && state.trialSchedule) {
            const currentTurn = state.turn;
            if (state.stage && state.stage.id === 1 && currentTurn >= state.trialSchedule.trial1) {
                state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
                state.nextTrialTurn = state.trialSchedule.trial2;
                if (engine.gridEngine) {
                    engine.gridEngine.expandGrid(7);
                }
                if (state.addLog) {
                    state.addLog(this._translate("LOG_STAGE_EXPAND", { stage: 2, size: 7 }, "⚔️ Stage 2 (7x7)"));
                }
            } else if (state.stage && state.stage.id === 2 && currentTurn >= state.trialSchedule.trial2) {
                state.stage = { id: 3, name: "Stage 3", size: 9, maxTiles: 80 };
                state.nextTrialTurn = state.trialSchedule.trial3;
                if (engine.gridEngine) {
                    engine.gridEngine.expandGrid(9);
                }
                if (state.addLog) {
                    state.addLog(this._translate("LOG_STAGE_EXPAND", { stage: 3, size: 9 }, "⚔️ Stage 3 (9x9)"));
                }
            }
        }

        if (state && typeof state.addLog === "function") {
            state.addLog(this._translate(
                "LOG_TURN_START",
                { turn: state.turn },
                `Turn ${state.turn} started.`
            ));
        }

        return state ? state.turn : 1;
    }

    _translate(key, params, fallback) {
        const runtimeI18n = (typeof globalThis !== "undefined" && globalThis.I18n)
            ? globalThis.I18n
            : this.engine.i18n;
        if (!runtimeI18n || typeof runtimeI18n.t !== "function") return fallback;
        return runtimeI18n.t(key, params) || fallback;
    }
}

export default TurnLifecycleService;
