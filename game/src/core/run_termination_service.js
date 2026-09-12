export const RUN_TERMINATION_OUTCOMES = Object.freeze({
    DEFEAT: "DEFEAT"
});

export const RUN_TERMINATION_REASONS = Object.freeze({
    EMBER_DEPLETED: "EMBER_DEPLETED"
});

function cloneFrozen(value) {
    return value ? Object.freeze(JSON.parse(JSON.stringify(value))) : null;
}

export class RunTerminationService {
    constructor(state) {
        this.state = state;
    }

    isTerminated() {
        return Boolean(this.state?.runTermination?.terminated);
    }

    getResult() {
        return cloneFrozen(this.state?.runTermination || null);
    }

    evaluate({ source = "UNKNOWN" } = {}) {
        if (!this.state) return null;
        if (this.isTerminated()) return this.getResult();
        if (Number.isFinite(this.state.ember) && this.state.ember <= 0) {
            return this.terminateDefeat({ source });
        }
        return null;
    }

    terminateDefeat({ source = "UNKNOWN" } = {}) {
        if (!this.state) return null;
        if (this.isTerminated()) return this.getResult();

        const terminalEmber = Math.max(0, Number(this.state.ember) || 0);
        this.state.ember = terminalEmber;
        this.state.runTermination = Object.freeze({
            terminated: true,
            outcome: RUN_TERMINATION_OUTCOMES.DEFEAT,
            reason: RUN_TERMINATION_REASONS.EMBER_DEPLETED,
            source,
            turn: Number(this.state.turn) || 1,
            ember: terminalEmber
        });
        this.state.isGameOver = true;
        return this.getResult();
    }
}

export default RunTerminationService;
