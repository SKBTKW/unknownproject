import assert from "node:assert/strict";
import fs from "node:fs";
import { GameEngine } from "../game/src/core/game_engine.js";
import { GameState } from "../game/src/v2_unity_ready_main.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import { createObservableEnemyProfile } from "../game/src/warning/domain/observable_enemy_profile.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { attachTrialLaunchSubsystem } from "../game/src/trial/integration/trial_launch_bootstrap.js";
import {
    FirstRunTrialTutorialService
} from "../game/src/tutorial/first_run_trial_tutorial_service.js";
import {
    FIRST_RUN_TRIAL_TUTORIAL_STEPS
} from "../game/src/tutorial/first_run_state.js";
import {
    FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID
} from "../game/src/tutorial/first_run_service.js";
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
            scaleBand: "SMALL"
        });
    }
};

const engine = GameEngine.createGame({
    runSeed: 20260923,
    firstRun: true,
    GameStateClass: SustainedFirstRunState,
    enemyObservationProjector: observationProjector
});

const runtime = attachTrialRuntimeSubsystems(engine);
assert.equal(runtime.success, true, "Trial runtime must compose before the connected flow starts");

const tutorial = new FirstRunTrialTutorialService();
const startedTrials = [];
let latestTutorialState = null;
const uiBoundary = {
    trialController: { state: null },
    startTrialSession(scenario, options = {}) {
        const state = {
            trialIndex: scenario?.trialIndex ?? options?.trialIndex ?? null,
            scenario
        };
        this.trialController.state = state;
        startedTrials.push({ scenario, options });
        latestTutorialState = tutorial.begin({
            firstRunState: engine.firstRunState,
            trialIndex: state.trialIndex
        });
        return state;
    }
};

const scenarioFactory = {
    build({ trialIndex, gameState }) {
        return {
            success: true,
            scenario: {
                id: `TRIAL_${trialIndex}_FIRST_RUN_FLOW_CONTRACT`,
                trialIndex,
                routes: [{ id: "ROUTE_1", cells: [] }],
                availableDefense: gameState.currentDefense,
                ember: gameState.ember,
                maxEmber: gameState.maxEmber,
                mystic: gameState.mystic
            }
        };
    }
};

const launch = attachTrialLaunchSubsystem(engine, uiBoundary, { scenarioFactory });
assert.equal(launch.success, true, "Trial launch must compose through the canonical launch coordinator");

let traceStarts = 0;
const unsubscribe = engine.globalEventManager.subscribe(notification => {
    if (
        notification?.eventId === FIRST_RUN_DEMIHUMAN_TRACES_EVENT_ID
        && notification?.timing === GLOBAL_EVENT_TIMINGS.START
    ) {
        traceStarts += 1;
    }
});

assert.equal(engine.state.turn, 1);
assert.equal(engine.trialTimingAuthorityService.getScheduledVerse(1), 15);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.CALM);

for (let expectedVerse = 2; expectedVerse <= 7; expectedVerse += 1) {
    assert.equal(engine.nextTurn(), expectedVerse, `normal lifecycle must reach Verse ${expectedVerse}`);
}

assert.equal(engine.state.turn, 7);
assert.equal(traceStarts, 1, "Verse7 demihuman traces must start exactly once");
assert.equal(engine.warningStateService.getState(), WARNING_STATES.OMEN);
assert.equal(engine.state.investigationUnlocked, true, "canonical GE unlock bridge must unlock Investigation");

assert.equal(engine.nextTurn(), 8);
assert.equal(traceStarts, 1, "Verse8 progression must not retrigger the Verse7 trace event");

const investigationIndex = engine.state.handOffering.findIndex(card =>
    (card?.terrain || card)?.category === "INVESTIGATION"
);
assert.notEqual(investigationIndex, -1, "Verse8 Offering must guarantee at least one Investigation card");

const investigationCard = engine.state.handOffering[investigationIndex];
const reportsBefore = engine.state.knownEnemyState?.reports?.length || 0;
const investigation = engine.executeInvestigationCard(investigationCard, {
    type: "OFFERING",
    index: investigationIndex
});
assert.equal(investigation.success, true, "Investigation card must execute through the canonical runtime boundary");
assert.equal(
    engine.state.knownEnemyState.reports.length,
    reportsBefore + 1,
    "successful Investigation must update KnownEnemyState"
);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.WATCH);

assert.equal(engine.nextTurn(), 9);
const verse9ReportIds = engine.state.knownEnemyState.reports.map(report => report.id);
assert.equal(verse9ReportIds.length > 0, true);

assert.equal(engine.nextTurn(), 10);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.TENSE);

const restored = engine.historyRestoreService.restoreVerse(9);
assert.equal(restored.success, true, "FirstRun restore point must restore without replaying the flow");
assert.equal(engine.state.turn, 9);
assert.equal(engine.firstRunState.active, true);
assert.equal(engine.state.investigationUnlocked, true);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.WATCH);
assert.deepEqual(
    engine.state.knownEnemyState.reports.map(report => report.id),
    verse9ReportIds,
    "KnownEnemyState must survive FirstRun restore"
);
assert.equal(traceStarts, 1, "restore must not replay the Verse7 Global Event");

assert.equal(engine.nextTurn(), 10);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.TENSE);
for (let expectedVerse = 11; expectedVerse <= 14; expectedVerse += 1) {
    assert.equal(engine.nextTurn(), expectedVerse);
}
assert.equal(engine.warningStateService.getState(), WARNING_STATES.IMMINENT);
assert.equal(startedTrials.length, 0, "Trial1 must not launch before Verse15");

assert.equal(engine.nextTurn(), 15);
assert.equal(startedTrials.length, 1, "Verse15 must launch Trial1 through the pending-due coordinator");
assert.equal(startedTrials[0].options?.source, "TRIAL_DUE");
assert.equal(startedTrials[0].scenario?.trialIndex, 1);
assert.equal(engine.state.stage.id, 1, "Trial1 must start on Stage1");
assert.equal(engine.state.stage.size, 5, "Trial1 must start on the 5x5 board");
assert.equal(latestTutorialState?.active, true);
assert.equal(latestTutorialState?.currentStep, FIRST_RUN_TRIAL_TUTORIAL_STEPS.ROUTE_INTRO);
const tutorialBeforeTrial2Attempt = engine.firstRunState.getTrialTutorialState();
const tutorialAfterTrial2Attempt = tutorial.begin({
    firstRunState: engine.firstRunState,
    trialIndex: 2
});
assert.deepEqual(
    tutorialAfterTrial2Attempt,
    tutorialBeforeTrial2Attempt,
    "Trial2 must not mutate the active FirstRun Trial1 tutorial state"
);
assert.equal(tutorialAfterTrial2Attempt.trialIndex, 1, "Trial2 must not take ownership of FirstRun tutorial state");
assert.equal(traceStarts, 1, "Verse7 traces must remain exactly-once through Trial1 launch");

unsubscribe();

const browserBootstrap = fs.readFileSync(new URL("../game/index.html", import.meta.url), "utf8");
assert.match(browserBootstrap, /attachTrialRuntimeSubsystems\(engine\)/);
assert.match(browserBootstrap, /attachTrialLaunchSubsystem\(engine, ui\)/);

console.log("✅ FirstRun Stage1 Verse7→Trial1 connected flow PASS");
