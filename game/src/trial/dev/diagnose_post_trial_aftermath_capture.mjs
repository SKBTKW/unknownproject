import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { PostTrialAftermathCaptureBridge } from "../systems/post_trial_aftermath_capture_bridge.js";

const gameFactHub = new GameFactHub();
const state = { postTrialTransition: null };

// Simulate the production subscription order: PostTrialProgressionService creates
// the transition first, then the aftermath bridge captures the same settled fact.
const unsubscribeCreator = gameFactHub.subscribe(fact => {
    if (fact?.type !== GAME_FACT_TYPES.TRIAL_RESULT_SETTLED) return;
    if (state.postTrialTransition) return;
    state.postTrialTransition = {
        transitionId: `POST_TRIAL_${fact.payload?.trialIndex}_${fact.payload?.scenarioId}`,
        trialIndex: fact.payload?.trialIndex,
        scenarioId: fact.payload?.scenarioId,
        status: "WAITING_FOR_PRESENTATION_CLEANUP",
        steps: []
    };
});
const bridge = new PostTrialAftermathCaptureBridge({ gameFactHub, state });

const payload = {
    trialIndex: 1,
    scenarioId: "trial-1-aftermath",
    turn: 15,
    outcome: "SURVIVED",
    result: {
        completed: true,
        outcome: "SURVIVED",
        emberRemaining: 12,
        totalEmberDamage: 3,
        nested: { routeCount: 2 }
    },
    settlement: {
        settled: true,
        outcome: "SURVIVED",
        runTerminated: false,
        chronicleRecorded: true,
        chronicleId: "TRIAL_RESULT_trial-1-aftermath_15_SURVIVED",
        canExitTrial: true
    }
};

gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, payload);

const captured = bridge.getSnapshot();
assert.deepEqual(captured, {
    trialIndex: 1,
    scenarioId: "trial-1-aftermath",
    turn: 15,
    outcome: "SURVIVED",
    result: payload.result,
    settlement: payload.settlement
});

// The settled Fact is copied. Later mutation of source objects cannot rewrite history.
payload.result.nested.routeCount = 99;
payload.settlement.chronicleId = "MUTATED";
assert.equal(bridge.getSnapshot().result.nested.routeCount, 2);
assert.equal(
    bridge.getSnapshot().settlement.chronicleId,
    "TRIAL_RESULT_trial-1-aftermath_15_SURVIVED"
);

// Duplicate/retry settlement cannot overwrite the first historical snapshot.
gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    ...payload,
    outcome: "FAILED",
    result: { completed: true, outcome: "FAILED", emberRemaining: 0 },
    settlement: { settled: true, outcome: "FAILED", runTerminated: true }
});
assert.equal(bridge.getSnapshot().outcome, "SURVIVED");
assert.equal(bridge.getSnapshot().result.emberRemaining, 12);

// A Fact for another Trial cannot attach to an existing transition.
const secondHub = new GameFactHub();
const secondState = {
    postTrialTransition: {
        transitionId: "POST_TRIAL_2_trial-2",
        trialIndex: 2,
        scenarioId: "trial-2",
        steps: []
    }
};
const secondBridge = new PostTrialAftermathCaptureBridge({
    gameFactHub: secondHub,
    state: secondState
});
secondHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    trialIndex: 1,
    scenarioId: "trial-1-wrong",
    result: { completed: true },
    settlement: { settled: true }
});
assert.equal(secondBridge.getSnapshot(), null);

bridge.dispose();
secondBridge.dispose();
unsubscribeCreator();

console.log("diagnose_post_trial_aftermath_capture: OK");
