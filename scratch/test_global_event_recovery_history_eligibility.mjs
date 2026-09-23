import assert from "node:assert/strict";
import { ChronicleSystem } from "../game/src/systems/chronicle_system.js";
import { RunHistoryReadModel } from "../game/src/systems/run_history_read_model.js";
import { GlobalEventSelector } from "../game/src/systems/global_event_system.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const recovery = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_RECOVERY_MOMENTUM");
assert.ok(recovery, "recovery event definition required");
assert.deepEqual(recovery.conditions, [
    { type: "STAGE_AT_LEAST", value: 1 },
    { type: "HAS_HISTORY", historyType: "DAMAGE_TAKEN_IN_LAST_TRIAL", minimum: 1 }
]);

function makeContext(events = []) {
    const state = {
        turn: 20,
        stage: 1,
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: []
    };
    const chronicle = new ChronicleSystem(state);
    for (const event of events) chronicle.record(event);
    const historyQuery = new RunHistoryReadModel({ chronicleSystem: chronicle });
    return { state, chronicle, historyQuery };
}

const selector = new GlobalEventSelector({ nextFloat: () => 0 });

{
    const { state, historyQuery } = makeContext();
    assert.equal(
        selector.selectEvent(state, [recovery], { historyQuery }),
        null,
        "recovery must not be eligible before any Trial history"
    );
}

{
    const { state, historyQuery } = makeContext([{
        turn: 15,
        type: "TRIAL_RESULT",
        id: "TRIAL_RESULT_1",
        meta: { outcome: "SURVIVED", totalEmberDamage: 3 }
    }]);
    assert.equal(
        selector.selectEvent(state, [recovery], { historyQuery })?.id,
        "EVENT_RECOVERY_MOMENTUM",
        "latest Trial damage should make recovery eligible"
    );
}

{
    const { state, historyQuery } = makeContext([
        {
            turn: 15,
            type: "TRIAL_RESULT",
            id: "TRIAL_RESULT_1",
            meta: { outcome: "SURVIVED", totalEmberDamage: 5 }
        },
        {
            turn: 30,
            type: "TRIAL_RESULT",
            id: "TRIAL_RESULT_2",
            meta: { outcome: "SURVIVED", totalEmberDamage: 0 }
        }
    ]);
    assert.equal(
        selector.selectEvent(state, [recovery], { historyQuery }),
        null,
        "only the last Trial damage should control recovery eligibility"
    );
}

{
    const { state, historyQuery } = makeContext([{
        turn: 15,
        type: "TRIAL_RESULT",
        id: "TRIAL_RESULT_1",
        meta: { outcome: "SURVIVED", totalEmberDamage: 2 }
    }]);
    // Legacy state flag must not be required by the canonical GE path.
    state.lastTrialDamageTaken = 0;
    assert.equal(
        selector.selectEvent(state, [recovery], { historyQuery })?.id,
        "EVENT_RECOVERY_MOMENTUM"
    );
}

console.log("PASS global event recovery history eligibility");
