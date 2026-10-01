import assert from "node:assert/strict";
import { BattleOpportunityFortuneRuntimeBridge } from "../game/src/trial/systems/battle_opportunity_fortune_runtime_bridge.js";

function makeLifecycle() {
    return {
        calls: [],
        openOpportunity(snapshot) {
            this.calls.push("open");
            return { available: true, snapshot: { ...snapshot, phase: "OPPORTUNITY_PENDING" } };
        },
        declineOpportunity(snapshot) {
            this.calls.push("decline");
            return { ...snapshot, finalized: true, finalCombatResult: { outcome: "NORMAL" } };
        },
        commitOpportunity(snapshot) {
            this.calls.push("commit");
            return { ...snapshot, emberCommit: { committed: true, cost: 2 } };
        },
        resolveFortune(snapshot) {
            this.calls.push("fortune");
            return {
                ...snapshot,
                fortuneRoll: { dice: [4, 5], total: 9 },
                finalCombatResult: { outcome: "FORTUNE" }
            };
        },
        finalizeFortune(snapshot) {
            this.calls.push("finalize");
            return { ...snapshot, finalized: true };
        }
    };
}

const lifecycle = makeLifecycle();
const sequence = {
    calls: 0,
    completeCurrentBattle(state, result) {
        this.calls += 1;
        state.completedWith = result;
        return { success: true, battleResult: result };
    }
};
const bridge = new BattleOpportunityFortuneRuntimeBridge({
    lifecycleService: lifecycle,
    sequenceService: sequence
});
const trialState = {};
const baseSnapshot = { battleId: "B1", normalOutcome: { outcome: "NORMAL" } };
const combatResult = { success: true, prediction: { outcome: "NORMAL" } };

const opened = bridge.open({ snapshot: baseSnapshot, combatResult });
assert.equal(opened.pending, true);
assert.equal(sequence.calls, 0, "Opportunity Pending must block BattleSequence completion");

const committed = bridge.commit({ snapshot: opened.snapshot });
assert.equal(sequence.calls, 0);
assert.equal(committed.emberCommit.cost, 2);

const fortune = bridge.resolveFortune({ snapshot: committed });
assert.deepEqual(fortune.fortuneRoll.dice, [4, 5]);
assert.equal(sequence.calls, 0);

const finalized = bridge.finalizeFortune({
    trialState,
    snapshot: fortune,
    combatResult
});
assert.equal(finalized.completed, true);
assert.equal(sequence.calls, 1);
assert.equal(trialState.completedWith.finalCombatResult.outcome, "FORTUNE");
assert.deepEqual(lifecycle.calls, ["open", "commit", "fortune", "finalize"]);

const declineLifecycle = makeLifecycle();
const declineSequence = {
    calls: 0,
    completeCurrentBattle(_state, result) {
        this.calls += 1;
        return { success: true, battleResult: result };
    }
};
const declineBridge = new BattleOpportunityFortuneRuntimeBridge({
    lifecycleService: declineLifecycle,
    sequenceService: declineSequence
});
const declineOpened = declineBridge.open({ snapshot: baseSnapshot, combatResult });
const declined = declineBridge.decline({
    trialState: {},
    snapshot: declineOpened.snapshot,
    combatResult
});
assert.equal(declined.completed, true);
assert.equal(declineSequence.calls, 1);
assert.deepEqual(declineLifecycle.calls, ["open", "decline"]);

const noOpportunityLifecycle = makeLifecycle();
noOpportunityLifecycle.openOpportunity = function(snapshot) {
    this.calls.push("open");
    return { available: false, snapshot };
};
const noOpportunitySequence = {
    calls: 0,
    completeCurrentBattle(_state, result) {
        this.calls += 1;
        return { success: true, battleResult: result };
    }
};
const noOpportunityBridge = new BattleOpportunityFortuneRuntimeBridge({
    lifecycleService: noOpportunityLifecycle,
    sequenceService: noOpportunitySequence
});
const none = noOpportunityBridge.open({ snapshot: baseSnapshot, combatResult });
assert.equal(none.pending, false);
assert.equal(noOpportunitySequence.calls, 0, "open itself must never complete the battle");
const normalCompletion = noOpportunityBridge.completeWithoutOpportunity({
    trialState: {},
    snapshot: none.snapshot,
    combatResult
});
assert.equal(normalCompletion.completed, true);
assert.equal(noOpportunitySequence.calls, 1);

console.log("✅ Battle Opportunity / Fortune runtime bridge focused test PASS");
