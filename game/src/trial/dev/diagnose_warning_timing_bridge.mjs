import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { WARNING_STATES } from "../../warning/domain/warning_state.js";
import { WarningStateService } from "../../warning/systems/warning_state_service.js";
import { WarningTimingBridge } from "../../warning/systems/warning_timing_bridge.js";
import { TrialTimingAuthorityService } from "../systems/trial_timing_authority_service.js";

const gameFactHub = new GameFactHub();
const timingAuthority = new TrialTimingAuthorityService({
    schedule: { trial1: 15, trial2: 30, trial3: 50 }
});
const warningStateService = new WarningStateService();
const bridge = new WarningTimingBridge({
    gameFactHub,
    timingAuthority,
    warningStateService
});

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 8, nextTurn: 9 });
assert.equal(warningStateService.getState(), WARNING_STATES.CALM);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 9, nextTurn: 10 });
assert.equal(warningStateService.getState(), WARNING_STATES.TENSE);
assert.equal("distance" in warningStateService.getReadModel(), false);
assert.equal("remainingVerses" in warningStateService.getReadModel(), false);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 13, nextTurn: 14 });
assert.equal(warningStateService.getState(), WARNING_STATES.IMMINENT);

timingAuthority.markTrialSettled(1);
warningStateService.resetForNextTrial({ source: "TEST_SETTLEMENT", verse: 15 });
assert.equal(warningStateService.getState(), WARNING_STATES.CALM);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 24, nextTurn: 25 });
assert.equal(warningStateService.getState(), WARNING_STATES.TENSE);

gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 28, nextTurn: 29 });
assert.equal(warningStateService.getState(), WARNING_STATES.IMMINENT);

bridge.dispose();
console.log("diagnose_warning_timing_bridge: OK");
