import { GAME_FACT_TYPES } from "../core/game_fact.js";

export class TrialResultExitAdapter {
    constructor({ gameFactHub, lifecycleProvider, onExitReady } = {}) {
        if (!gameFactHub?.subscribe) throw new Error("GAME_FACT_HUB_REQUIRED");
        if (typeof lifecycleProvider !== "function") throw new Error("TRIAL_LIFECYCLE_PROVIDER_REQUIRED");
        if (typeof onExitReady !== "function") throw new Error("TRIAL_EXIT_CALLBACK_REQUIRED");

        this.lifecycleProvider = lifecycleProvider;
        this.onExitReady = onExitReady;
        this.unsubscribe = gameFactHub.subscribe(fact => this.handleFact(fact));
    }

    handleFact(fact) {
        if (fact?.type !== GAME_FACT_TYPES.TRIAL_EXIT_READY) return false;
        const lifecycle = this.lifecycleProvider();
        if (!lifecycle?.canExitTrial) return false;
        this.onExitReady({ fact, lifecycle });
        return true;
    }

    destroy() {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}

export default TrialResultExitAdapter;
