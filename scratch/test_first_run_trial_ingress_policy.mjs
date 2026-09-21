import assert from "assert/strict";
import { FirstRunTrialIngressPolicy } from "../game/src/tutorial/first_run_trial_ingress_policy.js";

function createBase(selected) {
    return {
        select() {
            return selected.map(item => ({ ...item }));
        }
    };
}

const candidates = [
    { id: "A", r: 0, c: 0, placed: false, terrainId: "GL2_FOREST" },
    { id: "B", r: 0, c: 1, placed: true, terrainId: "GL0_DESERT" },
    { id: "C", r: 0, c: 2, placed: true, terrainId: "GL2_FOREST" },
    { id: "D", r: 0, c: 3, placed: true, terrainId: "GL1_PLAINS" }
];

{
    const policy = new FirstRunTrialIngressPolicy({
        basePolicy: createBase([candidates[0], candidates[1]]),
        randomService: { shuffle: items => items }
    });
    const selected = policy.select({
        candidates,
        trialIndex: 1,
        gameState: { engine: { firstRunState: { active: true } } }
    });

    assert.equal(selected.length, 2, "FirstRun shaping must preserve normal route count");
    assert.deepEqual(
        selected.map(item => item.id),
        ["C", "D"],
        "FirstRun Trial1 should prefer placed, readable terrain among already-legal candidates"
    );
}

{
    const baseline = [candidates[0], candidates[1]];
    const policy = new FirstRunTrialIngressPolicy({
        basePolicy: createBase(baseline),
        randomService: { shuffle: items => items }
    });
    const selected = policy.select({
        candidates,
        trialIndex: 2,
        gameState: { engine: { firstRunState: { active: true } } }
    });
    assert.deepEqual(selected, baseline, "Trial2 must use the normal ingress selection result unchanged");
}

{
    const baseline = [candidates[1]];
    const policy = new FirstRunTrialIngressPolicy({
        basePolicy: createBase(baseline),
        randomService: { shuffle: items => items }
    });
    const selected = policy.select({
        candidates,
        trialIndex: 1,
        gameState: { engine: { firstRunState: { active: false } } }
    });
    assert.deepEqual(selected, baseline, "normal Run must use the normal ingress selection result unchanged");
}

console.log("✅ FirstRun Trial ingress policy preserves legality/count and only shapes Trial1 PASS");
