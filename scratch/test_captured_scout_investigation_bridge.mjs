import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../game/src/core/game_fact.js";
import { attachInvestigationRuntime } from "../game/src/warning/integration/investigation_runtime_bridge.js";
import {
    CapturedScoutInvestigationBridge,
    CAPTURED_SCOUT_INVESTIGATION_SOURCE
} from "../game/src/warning/systems/captured_scout_investigation_bridge.js";

const state = {
    turn: 22,
    investigationUnlocked: false,
    warningState: "CALM",
    handOffering: [],
    reserveSlots: [null],
    knownEnemyState: null
};
const facts = new GameFactHub();
const engine = {
    state,
    deckManager: {
        getLandCardMaster() { return []; }
    },
    gameplayRandom: {
        nextFloat: () => 0,
        nextInt: (min) => min,
        nextId: (prefix, scope) => `${prefix}:${scope}:SCOUT`
    },
    gameFactHub: facts,
    warningStateService: {
        getState: () => "CALM"
    }
};

const profile = {
    trialIndex: 2,
    threatRevision: 3,
    scaleBand: "MEDIUM",
    directionHints: ["NORTH"],
    physiqueTraits: ["LARGE"],
    equipmentTraits: ["LIGHT"],
    movementTraits: ["FAST"],
    terrainTraits: ["FOREST"]
};

const attached = attachInvestigationRuntime(engine, {
    observableProfileProvider: () => profile
});
assert.equal(attached.success, true);

const normal = engine.performInvestigation({
    sourceType: "TEST_NORMAL",
    allowedFacets: ["scaleBand"],
    baseObservations: 1
});
assert.equal(normal.success, false);
assert.equal(normal.reason, "INVESTIGATION_LOCKED");

const bridge = new CapturedScoutInvestigationBridge();
const interrogation = bridge.apply({
    engine,
    resolution: {
        eventId: "EVENT_CAPTURED_SCOUT",
        choiceId: "INTERROGATE",
        publicOutcomeTags: ["INTEL_OPPORTUNITY", "CAPTIVE_REMAINS"]
    }
});

assert.equal(interrogation.success, true);
assert.equal(interrogation.report.sourceType, CAPTURED_SCOUT_INVESTIGATION_SOURCE);
assert.equal(interrogation.report.trialIndex, 2);
assert.equal(interrogation.report.observations.length, 1);
assert.equal(state.knownEnemyState.reports.length, 1);
assert.equal(state.lastInvestigationReport.id, interrogation.report.id);

const recordedFacts = facts.getFacts().filter(fact => fact.type === GAME_FACT_TYPES.INVESTIGATION_RECORDED);
assert.equal(recordedFacts.length, 1);
assert.equal(recordedFacts[0].payload.sourceType, CAPTURED_SCOUT_INVESTIGATION_SOURCE);
assert.equal(recordedFacts[0].payload.cardId, "EVENT_CAPTURED_SCOUT:INTERROGATE");

// Non-interrogation choices must never create Investigation state.
const before = state.knownEnemyState.reports.length;
const execute = bridge.apply({
    engine,
    resolution: {
        eventId: "EVENT_CAPTURED_SCOUT",
        choiceId: "EXECUTE",
        publicOutcomeTags: ["INFORMATION_LEAK_PREVENTED", "RETALIATION_RISK"]
    }
});
assert.equal(execute.success, false);
assert.equal(execute.reason, "NO_INVESTIGATION_FOR_CHOICE");
assert.equal(state.knownEnemyState.reports.length, before);

const release = bridge.apply({
    engine,
    resolution: {
        eventId: "EVENT_CAPTURED_SCOUT",
        choiceId: "RELEASE",
        publicOutcomeTags: ["DEESCALATION_POSSIBLE", "INFORMATION_LEAK_RISK"]
    }
});
assert.equal(release.success, false);
assert.equal(release.reason, "NO_INVESTIGATION_FOR_CHOICE");
assert.equal(state.knownEnemyState.reports.length, before);

// The bridge depends only on redacted ObservableEnemyProfile data.
assert.equal("enemyTruth" in interrogation.report, false);
assert.equal("actualEntryPoint" in interrogation.report, false);

console.log("PASS captured scout investigation bridge");
