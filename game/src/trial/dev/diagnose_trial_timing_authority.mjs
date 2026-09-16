import assert from "node:assert/strict";
import {
    TrialTimingAuthorityService,
    createLegacyCompatibleTrialTimingAuthority
} from "../systems/trial_timing_authority_service.js";

{
    const timing = new TrialTimingAuthorityService({
        schedule: { trial1: 15, trial2: 30, trial3: 50 }
    });

    assert.equal(timing.getCurrentTrialIndex(), 1);
    assert.equal(timing.getNextScheduledVerse(), 15);
    assert.equal(timing.getDistanceToNextTrial(10), 5);
    assert.equal(timing.isCurrentTrialDue(14), false);
    assert.equal(timing.isCurrentTrialDue(15), true);
    assert.equal(timing.isCurrentTrialDue(16), true);

    const afterFirst = timing.markTrialSettled(1);
    assert.equal(afterFirst.currentTrialIndex, 2);
    assert.equal(afterFirst.lastSettledTrialIndex, 1);
    assert.equal(afterFirst.nextScheduledVerse, 30);

    timing.markTrialSettled(2);
    timing.markTrialSettled(3);
    assert.equal(timing.getCurrentTrialIndex(), 4);
    assert.equal(timing.getNextScheduledVerse(), null);
    assert.equal(timing.getDistanceToNextTrial(50), null);
    assert.equal(timing.isCurrentTrialDue(50), false);
}

{
    const timing = new TrialTimingAuthorityService({
        schedule: { trial1: 15, trial2: 30, trial3: 50 }
    });
    timing.markTrialSettled(1);
    const snapshot = timing.getRestoreState();

    const restored = new TrialTimingAuthorityService({
        schedule: { trial1: 15, trial2: 30, trial3: 50 }
    });
    restored.restoreState(snapshot);
    assert.deepEqual(restored.getRestoreState(), snapshot);
}

{
    const state = {
        stage: { id: 3 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50, warningDuration: 5 }
    };
    const timing = createLegacyCompatibleTrialTimingAuthority(state, { currentTrialIndex: 1 });
    assert.equal(timing.getCurrentTrialIndex(), 1);
    assert.equal(timing.getNextScheduledVerse(), 15);
}

{
    assert.throws(
        () => new TrialTimingAuthorityService({ schedule: { trial1: 15, trial3: 50 } }),
        /TRIAL_TIMING_SCHEDULE_INDEX_GAP/
    );
    assert.throws(
        () => new TrialTimingAuthorityService({ schedule: { trial1: 15, trial2: 14 } }),
        /TRIAL_TIMING_SCHEDULE_NOT_ASCENDING/
    );
}

console.log("diagnose_trial_timing_authority: OK");
