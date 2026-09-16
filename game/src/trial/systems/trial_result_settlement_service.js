import { TRIAL_COMPLETION_OUTCOMES, TRIAL_PHASES } from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function findChronicleRecord(chronicleSystem, id) {
    const events = chronicleSystem?.getAllEvents?.();
    return Array.isArray(events) ? events.find(event => event?.id === id) || null : null;
}

export class TrialResultSettlementService {
    settle(state, { runTerminationService = null, chronicleSystem = null, turn = null } = {}) {
        if (!state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        if (state.phase !== TRIAL_PHASES.RESULT || !state.trialCompleted || !state.result?.completed) {
            return { success: false, errors: ["TRIAL_RESULT_NOT_READY"] };
        }
        if (state.resultSettlement?.settled) {
            return { success: true, alreadySettled: true, settlement: cloneData(state.resultSettlement) };
        }

        const outcome = state.result.outcome;
        if (outcome !== TRIAL_COMPLETION_OUTCOMES.SURVIVED && outcome !== TRIAL_COMPLETION_OUTCOMES.FAILED) {
            return { success: false, errors: ["INVALID_TRIAL_RESULT"] };
        }

        let runTermination = runTerminationService?.getResult?.() || null;
        if (outcome === TRIAL_COMPLETION_OUTCOMES.FAILED) {
            runTermination = runTermination || runTerminationService?.evaluate?.({ source: "TRIAL_RESULT" }) || null;
            if (!runTermination?.terminated) {
                return { success: false, errors: ["RUN_TERMINATION_REQUIRED"] };
            }
        } else if (runTermination?.terminated) {
            return { success: false, errors: ["SURVIVED_RUN_ALREADY_TERMINATED"] };
        }

        const resolvedTurn = Number.isInteger(Number(turn))
            ? Number(turn)
            : (Number.isInteger(Number(runTermination?.turn)) ? Number(runTermination.turn) : null);
        const chronicleId = `TRIAL_RESULT_${state.scenarioId || "UNKNOWN"}_${resolvedTurn ?? "NA"}_${outcome}`;
        let chronicleRecord = findChronicleRecord(chronicleSystem, chronicleId);

        if (!chronicleRecord && chronicleSystem?.record) {
            chronicleRecord = chronicleSystem.record({
                turn: resolvedTurn || undefined,
                type: "TRIAL_RESULT",
                id: chronicleId,
                nameKey: outcome === TRIAL_COMPLETION_OUTCOMES.SURVIVED
                    ? "CHRONICLE_TRIAL_SURVIVED"
                    : "CHRONICLE_TRIAL_FAILED",
                importance: "HISTORIC",
                meta: {
                    scenarioId: state.scenarioId || null,
                    outcome,
                    emberRemaining: Number(state.result.emberRemaining) || 0,
                    totalEmberDamage: Number(state.result.totalEmberDamage) || 0
                }
            }) || null;
        }

        const settlement = Object.freeze({
            settled: true,
            outcome,
            runTerminated: Boolean(runTermination?.terminated),
            runOutcome: runTermination?.outcome || null,
            chronicleRecorded: Boolean(chronicleRecord),
            chronicleId: chronicleRecord?.id || null,
            canExitTrial: true
        });
        state.resultSettlement = cloneData(settlement);

        return {
            success: true,
            alreadySettled: false,
            settlement: cloneData(settlement),
            runTermination: cloneData(runTermination)
        };
    }
}

export default TrialResultSettlementService;
