import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialTimingAuthorityService } from "../systems/trial_timing_authority_service.js";
import { TrialTimingFactBridge } from "../systems/trial_timing_fact_bridge.js";

{
    const hub = new GameFactHub();
    const timing = new TrialTimingAuthorityService({
        schedule: { trial1: 15, trial2: 30, trial3: 50 }
    });
    const bridge = new TrialTimingFactBridge({ gameFactHub: hub, timingAuthority: timing });

    hub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, { trialIndex: 1 });
    assert.equal(timing.getCurrentTrialIndex(), 1);
    assert.equal(bridge.getLastSettlement(), null);

    hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: "TRIAL_1",
        trialIndex: 1,
        outcome: "SURVIVED"
    });
    assert.equal(timing.getCurrentTrialIndex(), 2);
    assert.deepEqual(bridge.getLastSettlement(), {
        trialIndex: 1,
        scenarioId: "TRIAL_1",
        outcome: "SURVIVED",
        currentTrialIndex: 2,
        nextScheduledVerse: 30
    });

    bridge.dispose();
    hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: "TRIAL_2",
        trialIndex: 2,
        outcome: "SURVIVED"
    });
    assert.equal(timing.getCurrentTrialIndex(), 2);
}

{
    const hub = new GameFactHub();
    const timing = new TrialTimingAuthorityService({
        schedule: { trial1: 15, trial2: 30, trial3: 50 }
    });
    new TrialTimingFactBridge({ gameFactHub: hub, timingAuthority: timing });

    assert.throws(
        () => hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
            scenarioId: "TRIAL_1",
            trialIndex: null,
            outcome: "SURVIVED"
        }),
        /TRIAL_TIMING_SETTLEMENT_FACT_INDEX_REQUIRED/
    );
}

console.log("diagnose_trial_timing_fact_bridge: OK");
