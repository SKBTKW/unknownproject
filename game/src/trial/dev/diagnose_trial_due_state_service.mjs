import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialDueStateService } from "../systems/trial_due_state_service.js";
import { TrialTimingAuthorityService } from "../systems/trial_timing_authority_service.js";

const gameFactHub = new GameFactHub();
const timingAuthority = new TrialTimingAuthorityService({
    schedule: { trial1: 15, trial2: 30, trial3: 50 }
});
const dueStateService = new TrialDueStateService({
    gameFactHub,
    timingAuthority
});

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 13, nextTurn: 14 });
assert.equal(dueStateService.getPendingRequest(), null);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 14, nextTurn: 15 });
assert.deepEqual(dueStateService.getPendingRequest(), { trialIndex: 1 });
assert.deepEqual(Object.keys(dueStateService.getPendingRequest()), ["trialIndex"]);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 15, nextTurn: 16 });
assert.deepEqual(dueStateService.getPendingRequest(), { trialIndex: 1 });

assert.deepEqual(dueStateService.acknowledgePending(2), {
    success: false,
    reason: "TRIAL_DUE_PENDING_MISMATCH"
});
assert.deepEqual(dueStateService.acknowledgePending(1), {
    success: true,
    trialIndex: 1
});
assert.equal(dueStateService.getPendingRequest(), null);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 16, nextTurn: 17 });
assert.equal(dueStateService.getPendingRequest(), null);

timingAuthority.markTrialSettled(1);
gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 28, nextTurn: 29 });
assert.equal(dueStateService.getPendingRequest(), null);
gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 29, nextTurn: 30 });
assert.deepEqual(dueStateService.getPendingRequest(), { trialIndex: 2 });

dueStateService.dispose();
console.log("diagnose_trial_due_state_service: OK");
