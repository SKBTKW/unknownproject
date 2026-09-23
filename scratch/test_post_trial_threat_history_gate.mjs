import assert from "node:assert/strict";
import { ChronicleSystem } from "../game/src/systems/chronicle_system.js";
import { RunHistoryReadModel } from "../game/src/systems/run_history_read_model.js";
import { GlobalEventSelector } from "../game/src/systems/global_event_system.js";
import { GLOBAL_EVENTS_MASTER } from "../game/src/data/global_events.js";

const raid = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_RAID");
const scouts = GLOBAL_EVENTS_MASTER.find(def => def.id === "EVENT_DEMIHUMAN_SCOUTS");
assert.ok(raid);
assert.ok(scouts);

for (const def of [raid, scouts]) {
    assert.ok(
        def.conditions.some(condition =>
            condition.type === "HAS_HISTORY"
            && condition.historyType === "TRIAL_SURVIVED"
        ),
        `${def.id} must require survived Trial history`
    );
}

function contextWith(events = []) {
    const state = {
        turn: 20,
        stage: 2,
        nextTrialTurn: 30,
        activeGlobalEvents: [],
        eventCooldowns: {},
        temporaryWeightModifiers: []
    };
    const chronicle = new ChronicleSystem(state);
    for (const event of events) chronicle.record(event);
    return {
        state,
        historyQuery: new RunHistoryReadModel({ chronicleSystem: chronicle })
    };
}

const selector = new GlobalEventSelector({ nextFloat: () => 0 });

{
    const { state, historyQuery } = contextWith();
    assert.equal(
        selector.selectEvent(state, [raid], { historyQuery }),
        null,
        "Stage 2 alone must not unlock post-Trial raid"
    );
    assert.equal(
        selector.selectEvent(state, [scouts], { historyQuery }),
        null,
        "Stage 2 alone must not unlock post-Trial scouts"
    );
}

{
    const { state, historyQuery } = contextWith([{
        turn: 15,
        type: "TRIAL_RESULT",
        id: "TRIAL_RESULT_1",
        meta: { outcome: "SURVIVED", totalEmberDamage: 2 }
    }]);

    assert.equal(selector.selectEvent(state, [raid], { historyQuery })?.id, "EVENT_DEMIHUMAN_RAID");
    assert.equal(selector.selectEvent(state, [scouts], { historyQuery })?.id, "EVENT_DEMIHUMAN_SCOUTS");
}

{
    const { state, historyQuery } = contextWith([{
        turn: 15,
        type: "TRIAL_RESULT",
        id: "TRIAL_RESULT_1",
        meta: { outcome: "FAILED", totalEmberDamage: 8 }
    }]);

    assert.equal(selector.selectEvent(state, [raid], { historyQuery }), null);
    assert.equal(selector.selectEvent(state, [scouts], { historyQuery }), null);
}

console.log("PASS post-Trial threat history gate");
