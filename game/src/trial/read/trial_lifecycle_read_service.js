function cloneFrozen(value) {
    return Object.freeze(JSON.parse(JSON.stringify(value)));
}

export class TrialLifecycleReadService {
    read(state, { runTermination = null } = {}) {
        if (!state) {
            return cloneFrozen({
                available: false,
                phase: null,
                completed: false,
                outcome: null,
                resultReady: false,
                settlementConsumed: false,
                canExitTrial: false,
                runTerminated: Boolean(runTermination?.terminated),
                runOutcome: runTermination?.outcome || null,
                terminationReason: runTermination?.reason || null,
                emberRemaining: null
            });
        }

        const completed = Boolean(state.trialCompleted);
        const resultReady = Boolean(completed && state.result?.completed);
        const settlementConsumed = Boolean(state.resultSettlement?.settled);

        return cloneFrozen({
            available: true,
            phase: state.phase || null,
            completed,
            outcome: state.result?.outcome || null,
            resultReady,
            settlementConsumed,
            canExitTrial: Boolean(resultReady && settlementConsumed && state.resultSettlement?.canExitTrial),
            runTerminated: Boolean(runTermination?.terminated),
            runOutcome: runTermination?.outcome || null,
            terminationReason: runTermination?.reason || null,
            emberRemaining: Number.isFinite(Number(state.result?.emberRemaining))
                ? Number(state.result.emberRemaining)
                : (Number.isFinite(Number(state.ember)) ? Number(state.ember) : null)
        });
    }
}

export default TrialLifecycleReadService;
