import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";
import {
    PostTrialProgressionService,
    POST_TRIAL_STEP_STATUS,
    POST_TRIAL_TRANSITION_STATUS
} from "../systems/post_trial_progression_service.js";

function createHarness({ stageId = 1, restoredTransition = null } = {}) {
    const gameFactHub = new GameFactHub();
    const expandCalls = [];
    const state = {
        stage: stageId === 1
            ? { id: 1, name: "Stage 1", size: 5, maxTiles: 24 }
            : stageId === 2
                ? { id: 2, name: "Stage 2", size: 7, maxTiles: 48 }
                : { id: 3, name: "Stage 3", size: 9, maxTiles: 80 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: stageId === 1 ? 15 : stageId === 2 ? 30 : 50,
        postTrialTransition: restoredTransition ? JSON.parse(JSON.stringify(restoredTransition)) : null,
        addLog() {}
    };
    const engine = {
        state,
        gameFactHub,
        gridEngine: {
            expandGrid(size) {
                expandCalls.push(size);
                return Array.from({ length: size }, () => Array(size).fill(null));
            }
        }
    };
    const stageService = new TrialStageProgressionService(engine, { gameFactHub });
    engine.trialStageProgressionService = stageService;
    const postTrialService = new PostTrialProgressionService(engine, {
        gameFactHub,
        stageProgressionService: stageService
    });
    engine.postTrialProgressionService = postTrialService;
    return { engine, gameFactHub, stageService, postTrialService, expandCalls };
}

function dispose(h) {
    h.postTrialService.dispose();
    h.stageService.dispose();
}

// TRIAL_COMPLETED alone must not start Run-level progression.
{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, { trialIndex: 1 });
    assert.equal(h.engine.state.postTrialTransition, null);
    assert.equal(h.stageService.getPending(), null);
    assert.deepEqual(h.expandCalls, []);
    dispose(h);
}

// Settlement creates one transition, but physical Stage expansion waits for cleanup.
{
    const h = createHarness();
    const settlement = {
        trialIndex: 1,
        scenarioId: "trial-1",
        outcome: "VICTORY",
        settlement: { runTerminated: false }
    };
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);

    const transition = h.postTrialService.getTransition();
    assert.equal(transition.trialIndex, 1);
    assert.equal(transition.status, POST_TRIAL_TRANSITION_STATUS.WAITING_FOR_PRESENTATION_CLEANUP);
    assert.equal(transition.steps.length, 1);
    assert.equal(transition.steps[0].status, POST_TRIAL_STEP_STATUS.PENDING);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    // Duplicate settlement must neither duplicate steps nor expand the board.
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);
    assert.equal(h.postTrialService.getTransition().steps.length, 1);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const completed = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);

    // Repeated cleanup completion is idempotent.
    const repeated = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyCompleted, true);
    assert.deepEqual(h.expandCalls, [7]);
    dispose(h);
}

// Trial 2 authorizes Stage 3, still only after presentation cleanup.
{
    const h = createHarness({ stageId: 2 });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 2,
        scenarioId: "trial-2",
        settlement: { runTerminated: false }
    });
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, []);
    const completed = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(h.engine.state.stage.id, 3);
    assert.deepEqual(h.expandCalls, [9]);
    dispose(h);
}

// Final Trial creates a transition but never a Stage 4 step.
{
    const h = createHarness({ stageId: 3 });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 3,
        scenarioId: "trial-3",
        settlement: { runTerminated: false }
    });
    assert.equal(h.postTrialService.getTransition().steps.length, 0);
    const completed = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.engine.state.stage.id, 3);
    assert.deepEqual(h.expandCalls, []);
    dispose(h);
}

// A terminated run must not create a Stage progression step.
{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-defeat",
        settlement: { runTerminated: true }
    });
    assert.equal(h.postTrialService.getTransition().runTerminated, true);
    assert.equal(h.postTrialService.getTransition().steps.length, 0);
    assert.equal(h.stageService.getPending(), null);
    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);
    dispose(h);
}

// Save/load-style restoration rebuilds delegated Stage pending without re-settlement.
{
    const original = createHarness();
    original.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-restore",
        settlement: { runTerminated: false }
    });
    const savedTransition = JSON.parse(JSON.stringify(original.engine.state.postTrialTransition));
    dispose(original);

    const restored = createHarness({ stageId: 1, restoredTransition: savedTransition });
    assert.equal(restored.stageService.getPending()?.toStageId, 2);
    const completed = restored.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(restored.engine.state.stage.id, 2);
    assert.deepEqual(restored.expandCalls, [7]);
    dispose(restored);
}

// If a save captured the Stage after expansion but before the transition step was
// marked applied, load reconciles it as applied instead of expanding again.
{
    const restoredTransition = {
        schemaVersion: 1,
        transitionId: "POST_TRIAL_1_trial-1-crash-window",
        trialIndex: 1,
        scenarioId: "trial-1-crash-window",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
        steps: [{
            type: "STAGE_ADVANCE",
            status: POST_TRIAL_STEP_STATUS.PENDING,
            payload: {
                trialIndex: 1,
                fromStageId: 1,
                toStageId: 2,
                size: 7,
                maxTiles: 48,
                nextTrialIndex: 2
            }
        }]
    };
    const restored = createHarness({ stageId: 2, restoredTransition });
    assert.equal(restored.postTrialService.getTransition().status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(restored.postTrialService.getTransition().steps[0].status, POST_TRIAL_STEP_STATUS.APPLIED);
    assert.deepEqual(restored.expandCalls, []);
    dispose(restored);
}

console.log("diagnose_post_trial_progression_service: OK");
