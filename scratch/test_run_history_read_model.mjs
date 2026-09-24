import assert from "node:assert/strict";
import { RunHistoryReadModel } from "../game/src/systems/run_history_read_model.js";

const events = [
    { turn: 7, type: "GLOBAL_EVENT", id: "EVENT_DEMIHUMAN_TRACES", meta: {} },
    { turn: 15, type: "TRIAL_RESULT", id: "TRIAL_RESULT_A", meta: { outcome: "SURVIVED", totalEmberDamage: 3 } },
    { turn: 30, type: "TRIAL_RESULT", id: "TRIAL_RESULT_B", meta: { outcome: "SURVIVED", totalEmberDamage: 0 } }
];
const chronicleSystem = {
    getAllEvents() { return events; }
};
const boardHistoryQuery = {
    hasBattleSite(query) { return query?.regionId === "A"; }
};

const history = new RunHistoryReadModel({ chronicleSystem, boardHistoryQuery });
assert.equal(history.getTrialCount(), 2);
assert.equal(history.hasSurvivedTrial(), true);
assert.equal(history.hasEventOccurred("EVENT_DEMIHUMAN_TRACES"), true);
assert.equal(history.hasEventOccurred("EVENT_NEVER"), false);
assert.equal(history.damageTakenInLastTrial(), false);
assert.equal(history.matches({ historyType: "TRIAL_COUNT_AT_LEAST", count: 2 }), true);
assert.equal(history.matches({ historyType: "EVENT_OCCURRED", eventId: "EVENT_DEMIHUMAN_TRACES" }), true);
assert.equal(history.matches({ historyType: "HAS_BATTLE_SITE", regionId: "A" }), true);
assert.equal(history.matches({ historyType: "HAS_BATTLE_SITE", regionId: "B" }), false);
assert.equal(history.matches({ historyType: "UNKNOWN_HISTORY" }), false);

const before = history.getTrialCount();
events[0].meta.changed = true;
assert.equal(history.getTrialCount(), before, "querying history must not mutate chronicle");

console.log("PASS run history read model");
