import { GAME_FACT_TYPES } from "../../core/game_fact.js";

const STAGE_TRANSITIONS = Object.freeze({
    1: Object.freeze({ fromStageId: 1, toStageId: 2, size: 7, maxTiles: 48, nextTrialIndex: 2 }),
    2: Object.freeze({ fromStageId: 2, toStageId: 3, size: 9, maxTiles: 80, nextTrialIndex: 3 })
});

function normalizeTrialIndex(value) {
    const normalized = Math.floor(Number(value));
    return Number.isInteger(normalized) && normalized >= 1 ? normalized : null;
}

/**
 * Trial settlement -> Stage progression authority.
 *
 * RESULT_SETTLED authorizes progression, but physical grid expansion is deferred
 * until the presentation/session cleanup path explicitly calls applyPending().
 * This keeps the Trial itself on the Stage where it started and prevents route /
 * interception presentation state from observing a resized board mid-exit.
 */
export class TrialStageProgressionService {
    constructor(engine, { gameFactHub = null } = {}) {
        if (!engine?.state) throw new TypeError("TRIAL_STAGE_PROGRESSION_ENGINE_REQUIRED");
        const factHub = gameFactHub || engine.gameFactHub || null;
        if (!factHub || typeof factHub.subscribe !== "function") {
            throw new TypeError("TRIAL_STAGE_PROGRESSION_FACT_HUB_REQUIRED");
        }

        this.engine = engine;
        this.gameFactHub = factHub;
        this.pending = null;
        this.settledTrialIndexes = new Set();
        this.unsubscribe = factHub.subscribe(fact => this._onFact(fact));
    }

    _onFact(fact) {
        if (!fact || fact.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;
        const payload = fact.payload || {};
        const trialIndex = normalizeTrialIndex(payload.trialIndex);
        if (!trialIndex || this.settledTrialIndexes.has(trialIndex)) return;

        this.settledTrialIndexes.add(trialIndex);
        if (payload.settlement?.runTerminated) return;

        const transition = STAGE_TRANSITIONS[trialIndex] || null;
        if (!transition) return;

        const currentStageId = Number(this.engine.state?.stage?.id) || null;
        if (currentStageId !== transition.fromStageId) return;

        this.pending = Object.freeze({
            trialIndex,
            ...transition
        });
    }

    getPending() {
        return this.pending ? { ...this.pending } : null;
    }

    applyPending({ translate = null } = {}) {
        const pending = this.pending;
        if (!pending) {
            return { success: false, reason: "TRIAL_STAGE_PROGRESSION_NOT_PENDING" };
        }

        const state = this.engine.state;
        if ((Number(state?.stage?.id) || null) !== pending.fromStageId) {
            return { success: false, reason: "TRIAL_STAGE_PROGRESSION_STAGE_MISMATCH", pending: this.getPending() };
        }
        if (!this.engine.gridEngine || typeof this.engine.gridEngine.expandGrid !== "function") {
            return { success: false, reason: "TRIAL_STAGE_PROGRESSION_GRID_REQUIRED", pending: this.getPending() };
        }

        const expanded = this.engine.gridEngine.expandGrid(pending.size);
        if (!Array.isArray(expanded) || expanded.length !== pending.size) {
            return { success: false, reason: "TRIAL_STAGE_PROGRESSION_GRID_EXPAND_FAILED", pending: this.getPending() };
        }

        state.stage = {
            id: pending.toStageId,
            name: `Stage ${pending.toStageId}`,
            size: pending.size,
            maxTiles: pending.maxTiles
        };

        const nextTrialVerse = state.trialSchedule?.[`trial${pending.nextTrialIndex}`];
        if (Number.isFinite(nextTrialVerse)) {
            // Compatibility mirror only. Exact Trial authority remains the modern
            // timing service; legacy card predicates still read nextTrialTurn.
            state.nextTrialTurn = nextTrialVerse;
        }

        state.addLog?.(
            typeof translate === "function"
                ? translate(
                    "LOG_STAGE_EXPAND",
                    { stage: pending.toStageId, size: pending.size },
                    `⚔️ Stage ${pending.toStageId} (${pending.size}x${pending.size})`
                )
                : `⚔️ Stage ${pending.toStageId} (${pending.size}x${pending.size})`
        );

        this.pending = null;
        return {
            success: true,
            trialIndex: pending.trialIndex,
            stageId: pending.toStageId,
            size: pending.size
        };
    }

    dispose() {
        if (typeof this.unsubscribe === "function") {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export default TrialStageProgressionService;
