import assert from "node:assert/strict";
import { ChronicleSystem } from "../game/src/systems/chronicle_system.js";
import { RunHistoryReadModel } from "../game/src/systems/run_history_read_model.js";
import { GlobalEventSelector } from "../game/src/systems/global_event_system.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";
import { TrialResultSettlementService } from "../game/src/trial/systems/trial_result_settlement_service.js";
import {
    TRIAL_COMPLETION_OUTCOMES,
    TRIAL_PHASES
} from "../game/src/trial/domain/trial_types.js";

const raid = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_RAID");
const scouts = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_SCOUTS");
const recovery = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_RECOVERY_MOMENTUM");

assert.ok(raid);
assert.ok(scouts);
assert.ok(recovery);

function createWorldState() {
    return {
        turn: 16,
        stage: { id: 2 },
        nextTrialTurn: 30,
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: []
    };
}

function createCompletedTrial({
    scenarioId = "TRIAL_1",
    outcome = TRIAL_COMPLETION_OUTCOMES.SURVIVED,
    emberRemaining = 17,
    totalEmberDamage = 3
} = {}) {
    return {
        phase: TRIAL_PHASES.RESULT,
        trialCompleted: true,
        scenarioId,
        result: {
            completed: true,
            outcome,
            emberRemaining,
            totalEmberDamage
        },
        resultSettlement: null
    };
}

const worldState = createWorldState();
const chronicle = new ChronicleSystem(worldState);
const historyQuery = new RunHistoryReadModel({ chronicleSystem: chronicle });
const selector = new GlobalEventSelector({ nextFloat: () => 0 });
const settlementService = new TrialResultSettlementService();

assert.equal(historyQuery.hasSurvivedTrial(), false);
assert.equal(
    selector.selectEvent(worldState, [raid], { historyQuery }),
    null,
    "Raid must remain locked before canonical Trial settlement records survived history"
);
assert.equal(
    selector.selectEvent(worldState, [scouts], { historyQuery }),
    null,
    "Scouts must remain locked before canonical Trial settlement records survived history"
);
assert.equal(
    selector.selectEvent(worldState, [recovery], { historyQuery }),
    null,
    "Recovery must remain locked before canonical Trial settlement records damage history"
);

const trialState = createCompletedTrial();
const settled = settlementService.settle(trialState, {
    chronicleSystem: chronicle,
    turn: 15
});

assert.equal(settled.success, true);
assert.equal(settled.alreadySettled, false);
assert.equal(settled.settlement?.chronicleRecorded, true);
assert.equal(historyQuery.hasSurvivedTrial(), true);
assert.equal(historyQuery.getTrialCount(), 1);
assert.equal(historyQuery.damageTakenInLastTrial(3), true);
assert.equal(historyQuery.damageTakenInLastTrial(4), false);

assert.equal(
    selector.selectEvent(worldState, [raid], { historyQuery })?.id,
    "EVENT_DEMIHUMAN_RAID",
    "Canonical survived Trial settlement must unlock Raid history eligibility"
);
assert.equal(
    selector.selectEvent(worldState, [scouts], { historyQuery })?.id,
    "EVENT_DEMIHUMAN_SCOUTS",
    "Canonical survived Trial settlement must unlock Scouts history eligibility"
);
assert.equal(
    selector.selectEvent(worldState, [recovery], { historyQuery })?.id,
    "EVENT_RECOVERY_MOMENTUM",
    "Canonical Trial damage history must unlock Recovery Momentum eligibility"
);

const beforeReplayCount = chronicle.getAllEvents().length;
const replay = settlementService.settle(trialState, {
    chronicleSystem: chronicle,
    turn: 15
});
assert.equal(replay.success, true);
assert.equal(replay.alreadySettled, true);
assert.equal(
    chronicle.getAllEvents().length,
    beforeReplayCount,
    "Repeated settlement must not duplicate Chronicle Trial history"
);

const failedWorldState = createWorldState();
const failedChronicle = new ChronicleSystem(failedWorldState);
const failedHistoryQuery = new RunHistoryReadModel({ chronicleSystem: failedChronicle });
const failedTrialState = createCompletedTrial({
    scenarioId: "TRIAL_FAILED",
    outcome: TRIAL_COMPLETION_OUTCOMES.FAILED,
    emberRemaining: 0,
    totalEmberDamage: 20
});
const failedSettlement = settlementService.settle(failedTrialState, {
    chronicleSystem: failedChronicle,
    turn: 15,
    runTerminationService: {
        getResult: () => ({ terminated: true, outcome: "DEFEAT", turn: 15 })
    }
});

assert.equal(failedSettlement.success, true);
assert.equal(failedHistoryQuery.getTrialCount(), 1);
assert.equal(failedHistoryQuery.hasSurvivedTrial(), false);
assert.equal(
    selector.selectEvent(failedWorldState, [raid], { historyQuery: failedHistoryQuery }),
    null,
    "A failed canonical Trial settlement must not unlock survived-Trial threat events"
);

console.log("PASS post-Trial history runtime gate");
