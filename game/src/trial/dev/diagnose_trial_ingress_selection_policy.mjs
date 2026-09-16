import assert from "node:assert/strict";
import { TrialIngressSelectionPolicy } from "../scenario/trial_ingress_selection_policy.js";

const candidates = [
    { id: "A", r: 0, c: 0 },
    { id: "B", r: 0, c: 1 },
    { id: "C", r: 0, c: 2 },
    { id: "D", r: 0, c: 3 }
];

const noCountPolicy = new TrialIngressSelectionPolicy();
assert.deepEqual(noCountPolicy.select({ candidates, trialIndex: 1 }), []);

const reverseRandom = {
    shuffle(items) {
        items.reverse();
        return items;
    }
};

const policy = new TrialIngressSelectionPolicy({
    countResolver: ({ trialIndex }) => trialIndex === 2 ? 2 : 1,
    randomService: reverseRandom
});

const selected = policy.select({ candidates, trialIndex: 2 });
assert.deepEqual(selected.map(entry => entry.id), ["D", "C"]);
assert.deepEqual(candidates.map(entry => entry.id), ["A", "B", "C", "D"], "selection must not mutate candidate input");

const clampedPolicy = new TrialIngressSelectionPolicy({
    countResolver: () => 999,
    randomService: reverseRandom
});
assert.equal(clampedPolicy.select({ candidates, trialIndex: 3 }).length, candidates.length);

const zeroPolicy = new TrialIngressSelectionPolicy({ countResolver: () => 0 });
assert.deepEqual(zeroPolicy.select({ candidates }), []);

console.log("diagnose_trial_ingress_selection_policy: PASS");
