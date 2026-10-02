import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { GameState } from "../game/src/v2_unity_ready_main.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import { createObservableEnemyProfile } from "../game/src/warning/domain/observable_enemy_profile.js";
import { FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID } from "../game/src/tutorial/first_run_service.js";
import { GLOBAL_EVENT_TIMINGS } from "../game/src/systems/global_event_system.js";

class SustainedFirstRunState extends GameState {
    constructor(dependencies = {}) {
        super({
            ...dependencies,
            food: 1000,
            material: 1000,
            ember: 20,
            maxEmber: 20
        });
    }
}

const observationProjector = {
    project(truth) {
        return createObservableEnemyProfile({
            trialIndex: Number.isInteger(truth?.trialIndex) ? truth.trialIndex : 1,
            threatRevision: Number.isInteger(truth?.revision) ? truth.revision : 0,
            directionHints: ["NORTH_ACTIVITY"],
            physiqueTraits: ["LARGE_BODY_PRESENT"],
            equipmentTraits: ["LIGHT_ARMOR"],
            movementTraits: ["NIGHT_MOVEMENT"],
            terrainTraits: ["FOREST_ADAPTED"],
            scaleBand: "SMALL"
        });
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function offeringIds(engine) {
    return engine.state.handOffering.map(card => (card?.terrain || card)?.id || null);
}

function knownEnemyDigest(engine) {
    return clone({
        trialIndex: engine.state.knownEnemyState?.trialIndex ?? null,
        reports: engine.state.knownEnemyState?.reports || [],
        observedTags: engine.state.knownEnemyState?.observedTags || [],
        lastInvestigationReport: engine.state.lastInvestigationReport || null,
        lastInvestigationComparison: engine.state.lastInvestigationComparison || null
    });
}

function deterministicDigest(engine) {
    return {
        turn: engine.state.turn,
        warningState: engine.warningStateService.getState(),
        hasPickedThisTurn: engine.state.hasPickedThisTurn,
        offeringIds: offeringIds(engine),
        knownEnemy: knownEnemyDigest(engine),
        checkState: clone(engine.checkSystem.getState()),
        gameplayRngState: clone(engine.gameplayRandom.getState())
    };
}

function findInvestigation(engine) {
    const index = engine.state.handOffering.findIndex(card =>
        (card?.terrain || card)?.category === "INVESTIGATION"
    );
    assert.notEqual(index, -1, "Verse8 Offering must contain an Investigation card");
    return { index, card: engine.state.handOffering[index] };
}

function executeVerse8Investigation(engine) {
    const { index, card } = findInvestigation(engine);
    const result = engine.executeInvestigationCard(card, {
        type: "OFFERING",
        index
    });
    assert.equal(result.success, true, "Verse8 Investigation must execute successfully");
    assert.equal(
        engine.state.hasPickedThisTurn,
        true,
        "Investigation must consume the Verse action through hasPickedThisTurn"
    );
    assert.equal(engine.warningStateService.getState(), WARNING_STATES.WATCH);
    assert.equal(engine.state.knownEnemyState.reports.length > 0, true);
    return clone({
        report: result.report,
        comparison: result.comparison || null,
        previousReport: result.previousReport || null
    });
}

console.log("\nFirstRun Shared Dice pre-adoption determinism certification");

const engine = GameEngine.createGame({
    runSeed: 20261002,
    firstRun: true,
    GameStateClass: SustainedFirstRunState,
    enemyObservationProjector: observationProjector
});

let traceStarts = 0;
const unsubscribe = engine.globalEventManager.subscribe(notification => {
    if (
        notification?.eventId === FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID
        && notification?.timing === GLOBAL_EVENT_TIMINGS.START
    ) {
        traceStarts += 1;
    }
});

for (let expectedVerse = 2; expectedVerse <= 7; expectedVerse += 1) {
    assert.equal(engine.nextTurn(), expectedVerse);
}

assert.equal(engine.state.turn, 7);
assert.equal(traceStarts, 1, "Verse7 GE must start exactly once");
assert.equal(engine.warningStateService.getState(), WARNING_STATES.OMEN);
assert.equal(engine.state.investigationUnlocked, true);

const verse7RestorePoint = engine.historySnapshotService.getRestorePoint(7);
assert.ok(verse7RestorePoint, "Verse7 restore point must exist");
assert.deepEqual(
    clone(verse7RestorePoint.rngState),
    clone(engine.checkSystem.getState()),
    "Verse7 Check RNG state must be captured exactly"
);
assert.deepEqual(
    clone(verse7RestorePoint.gameplayRngState),
    clone(engine.gameplayRandom.getState()),
    "Verse7 gameplay RNG state must be captured exactly"
);

assert.equal(engine.nextTurn(), 8);
assert.equal(traceStarts, 1, "Verse7 GE must not repeat at Verse8");
assert.equal(engine.warningStateService.getState(), WARNING_STATES.OMEN);

const verse8Start = deterministicDigest(engine);
const verse8RestorePoint = engine.historySnapshotService.getRestorePoint(8);
assert.ok(verse8RestorePoint, "Verse8 restore point must exist");
assert.deepEqual(
    clone(verse8RestorePoint.rngState),
    verse8Start.checkState,
    "Verse8 restore point must own the exact Check RNG state"
);
assert.deepEqual(
    clone(verse8RestorePoint.gameplayRngState),
    verse8Start.gameplayRngState,
    "Verse8 restore point must own the exact gameplay RNG state"
);

const firstInvestigation = executeVerse8Investigation(engine);
const firstPostInvestigation = deterministicDigest(engine);

assert.equal(engine.nextTurn(), 9);
assert.equal(
    engine.state.hasPickedThisTurn,
    false,
    "Investigation action consumption must reset only after advancing one Verse"
);
const firstVerse9 = deterministicDigest(engine);

const firstContinuationProbe = {
    check: clone(engine.checkSystem.resolve({
        checkId: "standard_2d6",
        actionId: "FIRST_RUN_DETERMINISM_PROBE",
        checkSequence: 1
    })),
    gameplayFloat: engine.gameplayRandom.nextFloat(),
    gameplayId: engine.gameplayRandom.nextId("first_run_probe", engine.state.turn)
};

const restored = engine.historyRestoreService.restoreVerse(8);
assert.equal(restored.success, true, "Verse8 restore must succeed");
assert.equal(traceStarts, 1, "Restore must not replay the Verse7 GE");
assert.deepEqual(
    deterministicDigest(engine),
    verse8Start,
    "Restore to Verse8 must reproduce state and both RNG streams exactly before replay"
);

const replayInvestigation = executeVerse8Investigation(engine);
assert.deepEqual(
    replayInvestigation,
    firstInvestigation,
    "Investigation replay after restore must reproduce the same domain result exactly"
);
assert.deepEqual(
    deterministicDigest(engine),
    firstPostInvestigation,
    "Investigation replay must reproduce KnownEnemyState, Warning, action consumption and RNG states exactly"
);

assert.equal(engine.nextTurn(), 9);
assert.equal(traceStarts, 1, "Replay to Verse9 must not replay the Verse7 GE");
assert.deepEqual(
    deterministicDigest(engine),
    firstVerse9,
    "Verse9 replay must reproduce Offering, KnownEnemyState, Warning and both RNG states exactly"
);

const replayContinuationProbe = {
    check: clone(engine.checkSystem.resolve({
        checkId: "standard_2d6",
        actionId: "FIRST_RUN_DETERMINISM_PROBE",
        checkSequence: 1
    })),
    gameplayFloat: engine.gameplayRandom.nextFloat(),
    gameplayId: engine.gameplayRandom.nextId("first_run_probe", engine.state.turn)
};

assert.deepEqual(
    replayContinuationProbe,
    firstContinuationProbe,
    "Restore replay must preserve the next Check result, gameplay random value and deterministic ID"
);

unsubscribe();

console.log("✅ FirstRun Shared Dice pre-adoption determinism certification PASS");
