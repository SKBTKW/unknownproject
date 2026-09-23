import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { ChronicleSystem, CHRONICLE_IMPORTANCE } from "../game/src/systems/chronicle_system.js";

const state = { turn: 9 };
const hub = new GameFactHub();
const chronicle = new ChronicleSystem(state, hub);

hub.emit(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
    trialIndex: 1,
    verse: 9,
    cardId: "INV_FOOTPRINTS",
    reportId: "investigation_1_9_001",
    sourceType: "FOOTPRINTS",
    // Even if an upstream caller ever adds extra data, Chronicle must not
    // copy truth/profile details by accident.
    routeId: "SHOULD_NOT_PERSIST",
    strategicSuppression: 999,
    observations: [{ tag: "SHOULD_NOT_PERSIST" }]
});

const events = chronicle.getAllEvents();
assert.equal(events.length, 1);
assert.deepEqual(events[0], {
    turn: 9,
    type: GAME_FACT_TYPES.INVESTIGATION_RECORDED,
    id: "INVESTIGATION_RECORDED_investigation_1_9_001",
    nameKey: "CHRONICLE_INVESTIGATION_RECORDED",
    importance: CHRONICLE_IMPORTANCE.MINOR,
    meta: {
        verse: 9,
        trialIndex: 1,
        reportId: "investigation_1_9_001",
        sourceType: "FOOTPRINTS",
        cardId: "INV_FOOTPRINTS"
    }
});
assert.equal("routeId" in events[0].meta, false);
assert.equal("strategicSuppression" in events[0].meta, false);
assert.equal("observations" in events[0].meta, false);

// Replay/duplicate delivery must not duplicate Run history.
hub.emit(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
    trialIndex: 1,
    verse: 9,
    cardId: "INV_FOOTPRINTS",
    reportId: "investigation_1_9_001",
    sourceType: "FOOTPRINTS"
});
assert.equal(chronicle.getAllEvents().length, 1);

// A second report remains a distinct historical index entry.
hub.emit(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
    trialIndex: 1,
    verse: 11,
    cardId: null,
    reportId: "investigation_1_11_002",
    sourceType: "SCOUT_SIGHTING"
});
assert.equal(chronicle.getAllEvents().length, 2);
assert.equal(chronicle.getAllEvents()[1].turn, 11);
assert.equal(chronicle.getAllEvents()[1].meta.sourceType, "SCOUT_SIGHTING");

// Missing reportId is not indexable and must fail closed.
hub.emit(GAME_FACT_TYPES.INVESTIGATION_RECORDED, {
    trialIndex: 1,
    verse: 12,
    sourceType: "FOOTPRINTS"
});
assert.equal(chronicle.getAllEvents().length, 2);

// Existing Verse Chronicle behavior remains intact.
hub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, {
    completedTurn: 12,
    nextTurn: 13
});
assert.equal(chronicle.getAllEvents().length, 3);
assert.equal(chronicle.getAllEvents()[2].type, GAME_FACT_TYPES.VERSE_COMMITTED);

chronicle.destroy();
console.log("PASS investigation chronicle bridge");
