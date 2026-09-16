import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { GLOBAL_EVENT_TIMINGS } from "../../systems/global_event_system.js";
import { WARNING_STATES } from "../../warning/domain/warning_state.js";
import { WarningStateService } from "../../warning/systems/warning_state_service.js";
import { WarningOmenBridge } from "../../warning/systems/warning_omen_bridge.js";
import { WarningSettlementBridge } from "../../warning/systems/warning_settlement_bridge.js";

class FakeGlobalEventManager {
    constructor() { this.listeners = new Set(); }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit(notification) {
        this.listeners.forEach(listener => listener(notification));
    }
}

{
    const warning = new WarningStateService();
    const events = new FakeGlobalEventManager();
    const omenBridge = new WarningOmenBridge();
    assert.deepEqual(
        omenBridge.attach({ warningStateService: warning, globalEventManager: events }),
        { success: true }
    );

    events.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: "OTHER_EVENT", turn: 5 });
    assert.equal(warning.getState(), WARNING_STATES.CALM);

    events.emit({ timing: GLOBAL_EVENT_TIMINGS.END, eventId: "EVENT_DEMIHUMAN_TRACES", turn: 6 });
    assert.equal(warning.getState(), WARNING_STATES.CALM);

    events.emit({ timing: GLOBAL_EVENT_TIMINGS.START, eventId: "EVENT_DEMIHUMAN_TRACES", turn: 7 });
    assert.equal(warning.getState(), WARNING_STATES.OMEN);
    assert.equal(warning.getReadModel().history.at(-1).verse, 7);

    omenBridge.detach();
}

{
    const warning = new WarningStateService();
    warning.markOmen({ source: "EVENT_DEMIHUMAN_TRACES", verse: 7 });
    warning.markWatch({ source: "TEST", verse: 9 });
    warning.markTense({ source: "TEST", verse: 12 });

    const hub = new GameFactHub();
    const settlementBridge = new WarningSettlementBridge({
        gameFactHub: hub,
        warningStateService: warning
    });

    hub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, { trialIndex: 1, turn: 15 });
    assert.equal(warning.getState(), WARNING_STATES.TENSE);

    hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        turn: 15,
        outcome: "SURVIVED"
    });
    assert.equal(warning.getState(), WARNING_STATES.CALM);
    assert.equal(warning.getReadModel().history.at(-1).verse, 15);

    settlementBridge.dispose();
}

console.log("diagnose_warning_lifecycle_bridges: OK");
