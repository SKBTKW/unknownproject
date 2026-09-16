import { TrialResultSettlementService } from "../systems/trial_result_settlement_service.js";
import { TrialLifecycleReadService } from "../presentation/trial_lifecycle_read_service.js";
import { TRIAL_COMPLETION_OUTCOMES, TRIAL_PHASES } from "../domain/trial_types.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createChronicleStub() {
    return {
        events: [],
        getAllEvents() { return [...this.events]; },
        record(event) {
            this.events.push(JSON.parse(JSON.stringify(event)));
            return event;
        }
    };
}

const settlementService = new TrialResultSettlementService();
const readService = new TrialLifecycleReadService();
const survived = {
    phase: TRIAL_PHASES.RESULT,
    scenarioId: "TRIAL_1",
    trialCompleted: true,
    ember: 8,
    result: {
        completed: true,
        outcome: TRIAL_COMPLETION_OUTCOMES.SURVIVED,
        emberRemaining: 8,
        totalEmberDamage: 2
    },
    resultSettlement: null
};
const survivedChronicle = createChronicleStub();

const before = readService.read(survived);
assert(before.resultReady === true, "completed result must be readable");
assert(before.canExitTrial === false, "RESULT must remain visible before settlement");

const survivedSettlement = settlementService.settle(survived, {
    runTerminationService: { getResult: () => null },
    chronicleSystem: survivedChronicle,
    turn: 15
});
assert(survivedSettlement.success, "survived result must settle");
assert(survived.result?.completed === true, "settlement must not destroy Trial result");
assert(survivedChronicle.events.length === 1, "settlement must record Chronicle once");
assert(readService.read(survived).canExitTrial === true, "settled result must expose exit readiness");

const survivedAgain = settlementService.settle(survived, {
    chronicleSystem: survivedChronicle,
    turn: 15
});
assert(survivedAgain.success && survivedAgain.alreadySettled, "settlement must be idempotent");
assert(survivedChronicle.events.length === 1, "Chronicle must not duplicate");

const failedTermination = {
    terminated: true,
    outcome: "DEFEAT",
    reason: "EMBER_DEPLETED",
    turn: 30,
    ember: 0
};
const failed = {
    phase: TRIAL_PHASES.RESULT,
    scenarioId: "TRIAL_FATAL",
    trialCompleted: true,
    ember: 0,
    result: {
        completed: true,
        outcome: TRIAL_COMPLETION_OUTCOMES.FAILED,
        emberRemaining: 0,
        totalEmberDamage: 5
    },
    resultSettlement: null
};
const failedSettlement = settlementService.settle(failed, {
    runTerminationService: {
        getResult: () => failedTermination,
        evaluate: () => failedTermination
    },
    chronicleSystem: createChronicleStub(),
    turn: 30
});
assert(failedSettlement.success, "failed Trial must settle against terminal run");
const failedRead = readService.read(failed, { runTermination: failedTermination });
assert(failedRead.canExitTrial === true, "failed settled Trial must become exit-ready");
assert(failedRead.runOutcome === "DEFEAT", "failed read model must expose DEFEAT");

console.log("PASS: Trial RESULT settlement preserves result and exposes renderer-neutral exit readiness");
