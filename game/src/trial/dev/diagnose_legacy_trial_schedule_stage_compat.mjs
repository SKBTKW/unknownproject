import assert from "node:assert/strict";
import {
    createLegacyTrialTimingReadModel,
    getLegacyTrialDistance,
    isLegacyTrialNoticeActive,
    isLegacyTrialWithin,
    passesLegacyTrialCardTimingRequirements
} from "../../core/legacy_trial_schedule_compat.js";

{
    const state = { turn: 10, nextTrialTurn: 15 };
    assert.equal(getLegacyTrialDistance(state), 5);
    assert.equal(isLegacyTrialWithin(state, 5), true);
    assert.equal(isLegacyTrialWithin(state, 4), false);
    assert.equal(isLegacyTrialNoticeActive(state, { fallbackThreshold: 5 }), true);
    assert.equal(isLegacyTrialNoticeActive(state), false);
}

{
    const state = {
        turn: 1,
        nextTrialTurn: 50,
        getTrialNotice: () => ({ active: true, remaining: 49 })
    };
    assert.equal(isLegacyTrialNoticeActive(state), true);
    assert.equal(isLegacyTrialNoticeActive(state, { fallbackThreshold: 5 }), true);
}

{
    const state = {
        turn: 10,
        nextTrialTurn: 15,
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        getTrialNotice: () => ({ active: false, remaining: 5 })
    };
    const timing = createLegacyTrialTimingReadModel(state);
    assert.equal(timing.getCurrentVerse(), 10);
    assert.equal(timing.getNextScheduledVerse(), 15);
    assert.equal(timing.getDistance(), 5);
    assert.equal(timing.isWithin(5), true);
    assert.equal(timing.isWithin(4), false);
    assert.equal(timing.isNoticeActive({ fallbackThreshold: 5 }), true);
    assert.equal(timing.getScheduledVerse(1), 15);
    assert.equal(timing.getScheduledVerse(2), 30);
    assert.equal(timing.getScheduledVerse(3), 50);
    assert.equal(timing.getScheduledVerse(4), null);
}

{
    const state = {
        turn: 10,
        nextTrialTurn: 15,
        currentDefense: 40,
        getTrialNotice: () => ({ active: false, remaining: 5 })
    };
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialNotice: true }, state), true);
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialWithin: 5 }, state), true);
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialWithin: 4 }, state), false);
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialOrLowDefense: true }, state), false);
    state.currentDefense = 30;
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialOrLowDefense: true }, state), true);
}

{
    const state = {
        turn: 1,
        nextTrialTurn: 50,
        currentDefense: 40,
        getTrialNotice: () => ({ active: true, remaining: 49 })
    };
    assert.equal(passesLegacyTrialCardTimingRequirements({ reqTrialOrLowDefense: true }, state), true);
}

console.log("diagnose_legacy_trial_schedule_stage_compat: OK");
