import assert from "node:assert/strict";
import {
    FIRST_RUN_TRIAL1_VERSE,
    FINAL_TRIAL_VERSE,
    createTrialTimingSchedule
} from "../systems/trial_timing_policy.js";

function createStubRandom(values) {
    const queue = [...values];
    const calls = [];
    return {
        calls,
        nextInt(min, max) {
            calls.push({ min, max });
            if (queue.length === 0) throw new Error("RNG_STUB_EXHAUSTED");
            return queue.shift();
        }
    };
}

{
    const rng = createStubRandom([3]);
    const schedule = createTrialTimingSchedule({ gameplayRandom: rng, firstRun: true });
    assert.deepEqual(schedule, {
        trial1: FIRST_RUN_TRIAL1_VERSE,
        trial2: 33,
        trial3: FINAL_TRIAL_VERSE
    });
    assert.deepEqual(rng.calls, [{ min: -3, max: 3 }]);
}

{
    const rng = createStubRandom([-3, 2]);
    const schedule = createTrialTimingSchedule({ gameplayRandom: rng, firstRun: false });
    assert.deepEqual(schedule, {
        trial1: 12,
        trial2: 32,
        trial3: 50
    });
    assert.deepEqual(rng.calls, [
        { min: -3, max: 3 },
        { min: -3, max: 3 }
    ]);
}

assert.throws(
    () => createTrialTimingSchedule({ gameplayRandom: null }),
    /TRIAL_TIMING_POLICY_GAMEPLAY_RANDOM_REQUIRED/
);

console.log("diagnose_trial_timing_policy: OK");
