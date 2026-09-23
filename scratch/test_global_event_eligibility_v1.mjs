import assert from "node:assert/strict";
import { GlobalEventSelector } from "../game/src/systems/global_event_system.js";

const state = {
    turn: 20,
    stage: 2,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: []
};
const randomSource = { nextFloat: () => 0 };
const selector = new GlobalEventSelector(randomSource);

const boardQuery = {
    hasTerrain(terrain, { minimum }) {
        return terrain === "WETLAND" && minimum <= 1;
    },
    hasEntity(entity) {
        return entity === "MINE";
    },
    hasCapability(capability) {
        return capability === "OBSERVATION";
    }
};
const historyQuery = {
    matches(requirement) {
        return requirement.historyType === "TRIAL_SURVIVED";
    }
};

const wetland = {
    id: "EVENT_WETLAND_TEST",
    baseWeight: 100,
    conditions: [{ type: "HAS_TERRAIN", terrain: "WETLAND", value: 1 }]
};
assert.equal(
    selector.selectEvent(state, [wetland], { boardQuery, historyQuery })?.id,
    "EVENT_WETLAND_TEST"
);

const impossible = {
    id: "EVENT_DESERT_TEST",
    baseWeight: 100,
    conditions: [{ type: "HAS_TERRAIN", terrain: "DESERT", value: 1 }]
};
assert.equal(selector.selectEvent(state, [impossible], { boardQuery, historyQuery }), null);

const historyEvent = {
    id: "EVENT_POST_TRIAL_TEST",
    baseWeight: 100,
    conditions: [{ type: "HAS_HISTORY", historyType: "TRIAL_SURVIVED" }]
};
assert.equal(
    selector.selectEvent(state, [historyEvent], { boardQuery, historyQuery })?.id,
    "EVENT_POST_TRIAL_TEST"
);

const unknownPredicate = {
    id: "EVENT_UNKNOWN_PREDICATE",
    baseWeight: 100,
    conditions: [{ type: "TYPO_PREDICATE_SHOULD_FAIL_CLOSED" }]
};
assert.equal(
    selector.selectEvent(state, [unknownPredicate], { boardQuery, historyQuery }),
    null,
    "unknown GE predicates must fail closed"
);

const notRandom = {
    id: "EVENT_SCRIPTED_ONLY",
    randomEligible: false,
    baseWeight: 100,
    conditions: []
};
assert.equal(selector.selectEvent(state, [notRandom], { boardQuery, historyQuery }), null);

console.log("PASS global event eligibility v1");
