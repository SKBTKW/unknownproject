import assert from "node:assert/strict";
import { WARNING_STATES } from "../../warning/domain/warning_state.js";
import { WarningStateService } from "../../warning/systems/warning_state_service.js";

{
    const warning = new WarningStateService();
    assert.equal(warning.getState(), WARNING_STATES.CALM);

    assert.equal(warning.markOmen({ source: "OMEN_EVENT", verse: 7 }).changed, true);
    assert.equal(warning.markWatch({ source: "INVESTIGATION_UNLOCK", verse: 7 }).changed, true);
    assert.equal(warning.markTense({ source: "THREAT_APPROACH", verse: 10 }).changed, true);
    assert.equal(warning.markImminent({ source: "INVASION_CONFIRMED", verse: 14 }).changed, true);
    assert.equal(warning.getState(), WARNING_STATES.IMMINENT);

    assert.throws(
        () => warning.markWatch({ source: "INVALID_REGRESSION" }),
        /WARNING_STATE_REGRESSION_FORBIDDEN/
    );

    const beforeResetRevision = warning.getReadModel().revision;
    const reset = warning.resetForNextTrial({ verse: 15 });
    assert.equal(reset.state, WARNING_STATES.CALM);
    assert.equal(reset.revision, beforeResetRevision + 1);
}

{
    const warning = new WarningStateService();
    warning.markOmen({ source: "OMEN_EVENT", verse: 6 });
    const snapshot = warning.getRestoreState();

    const restored = new WarningStateService();
    restored.restoreState(snapshot);
    assert.deepEqual(restored.getRestoreState(), snapshot);
}

{
    const warning = new WarningStateService({ initialState: WARNING_STATES.WATCH });
    const same = warning.markWatch({ source: "DUPLICATE" });
    assert.equal(same.changed, false);
    assert.equal(warning.getReadModel().revision, 0);
}

console.log("diagnose_warning_state_service: OK");
