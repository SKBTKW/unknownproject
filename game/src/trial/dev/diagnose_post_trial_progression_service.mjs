import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TurnLifecycleService, TURN_LIFECYCLE_PHASES } from "../../core/turn_lifecycle_service.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";
import {
    PostTrialProgressionService,
    POST_TRIAL_STEP_STATUS,
    POST_TRIAL_STEP_TYPES,
    POST_TRIAL_TRANSITION_STATUS
} from "../systems/post_trial_progression_service.js";

function createHarness({
    stageId = 1,
    restoredTransition = null,
    rewardStepPolicy = null,
    unlockStepPolicy = null
} = {}) {
    const gameFactHub = new GameFactHub();
    const expandCalls = [];
    const state = {
        turn: 15,
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
        stageProgressionService: stageService,
        rewardStepPolicy,
        unlockStepPolicy
    });
    engine.postTrialProgressionService = postTrialService;
    return { engine, gameFactHub, stageService, postTrialService, expandCalls };
}

function createTurnLifecycleHarness(postTrialService) {
    const state = postTrialService.engine.state;
    const lifecycle = Object.create(TurnLifecycleService.prototype);
    lifecycle.engine = {
        ...postTrialService.engine,
        state,
        postTrialProgressionService: postTrialService,
        runTerminationService: { evaluate: () => null }
    };
    lifecycle.phase = TURN_LIFECYCLE_PHASES.ACTIVE;
    lifecycle.lastCommittedBoundary = null;
    lifecycle.lastAdvanceBlock = null;
    lifecycle._commitCurrentTurn = () => Object.freeze({
        completedTurn: state.turn,
        nextTurn: state.turn + 1,
        runTermination: null
    });
    lifecycle._emitCommittedFact = () => null;
    lifecycle._captureHistorySnapshot = () => null;
    lifecycle._initializeNextTurn = () => { state.turn += 1; };
    lifecycle._captureRestorePoint = () => null;
    lifecycle._tryStartPendingTrial = () => null;
    return lifecycle;
}

function countFacts(h, type) {
    return h.gameFactHub.getFacts().filter(fact => fact.type === type).length;
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

// With no reward/unlock policy, the existing Stage-only behavior remains intact.
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
    assert.equal(transition.steps[0].type, POST_TRIAL_STEP_TYPES.STAGE_ADVANCE);
    assert.equal(transition.steps[0].status, POST_TRIAL_STEP_STATUS.PENDING);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_TRANSITION_CREATED), 1);

    // Duplicate settlement must neither duplicate steps/facts nor expand the board.
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);
    assert.equal(h.postTrialService.getTransition().steps.length, 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_TRANSITION_CREATED), 1);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const completed = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_COMPLETED), 1);

    // Repeated cleanup completion is idempotent.
    const repeated = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyCompleted, true);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_COMPLETED), 1);
    dispose(h);
}

// Reward / unlock content stays behind injected policy boundaries. Pending semantic
// steps block normal Verse progression even after Trial presentation cleanup.
{
    let rewardPolicyCalls = 0;
    let unlockPolicyCalls = 0;
    const h = createHarness({
        rewardStepPolicy: ({ trialIndex }) => {
            rewardPolicyCalls += 1;
            return { source: "TEST_REWARD_POLICY", trialIndex };
        },
        unlockStepPolicy: ({ trialIndex }) => {
            unlockPolicyCalls += 1;
            return { source: "TEST_UNLOCK_POLICY", trialIndex };
        }
    });
    const settlement = {
        trialIndex: 1,
        scenarioId: "trial-1-policy",
        outcome: "VICTORY",
        settlement: { runTerminated: false }
    };
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);

    assert.equal(rewardPolicyCalls, 1);
    assert.equal(unlockPolicyCalls, 1);
    assert.deepEqual(
        h.postTrialService.getTransition().steps.map(step => step.type),
        [
            POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
            POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
            POST_TRIAL_STEP_TYPES.STAGE_ADVANCE
        ]
    );
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_TRANSITION_CREATED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_REWARD_AVAILABLE), 1);

    const cleanup = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(cleanup.success, true);
    assert.equal(cleanup.transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(h.postTrialService.canResumeNormalProgression(), false);
    assert.equal(h.postTrialService.getPendingSteps().length, 2);

    const lifecycle = createTurnLifecycleHarness(h.postTrialService);
    const blockedAtVerse = h.engine.state.turn;
    assert.equal(lifecycle.advance(), blockedAtVerse);
    assert.equal(h.engine.state.turn, blockedAtVerse);
    assert.equal(lifecycle.getLastAdvanceBlock()?.reason, "POST_TRIAL_PROGRESSION_PENDING");

    const reward = h.postTrialService.completeRewardSelection({ result: { selected: "TEST_REWARD" } });
    assert.equal(reward.success, true);
    assert.equal(reward.transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
    assert.equal(h.postTrialService.canResumeNormalProgression(), false);
    const repeatedReward = h.postTrialService.completeRewardSelection({ result: { selected: "DUPLICATE" } });
    assert.equal(repeatedReward.success, true);
    assert.equal(repeatedReward.alreadyApplied, true);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_REWARD_SELECTED), 1);

    const unlock = h.postTrialService.completeUnlockApply({ result: { applied: "TEST_UNLOCK" } });
    assert.equal(unlock.success, true);
    assert.equal(unlock.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.postTrialService.canResumeNormalProgression(), true);
    const repeatedUnlock = h.postTrialService.completeUnlockApply({ result: { applied: "DUPLICATE" } });
    assert.equal(repeatedUnlock.success, true);
    assert.equal(repeatedUnlock.alreadyApplied, true);

    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_REWARD_SELECTED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_UNLOCK_APPLIED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_COMPLETED), 1);

    assert.equal(lifecycle.advance(), blockedAtVerse + 1);
    assert.equal(h.engine.state.turn, blockedAtVerse + 1);
    assert.equal(lifecycle.getLastAdvanceBlock(), null);
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

// Save/load-style restoration rebuilds delegated Stage pending without re-settlement,
// while preserving policy-created Reward / Unlock pending steps verbatim.
{
    const original = createHarness({
        rewardStepPolicy: () => ({ rewardToken: "RESTORE_TEST" }),
        unlockStepPolicy: () => ({ unlockToken: "RESTORE_TEST" })
    });
    original.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-restore",
        settlement: { runTerminated: false }
    });
    const savedTransition = JSON.parse(JSON.stringify(original.engine.state.postTrialTransition));
    dispose(original);

    const restored = createHarness({ stageId: 1, restoredTransition: savedTransition });
    assert.equal(restored.stageService.getPending()?.toStageId, 2);
    assert.equal(restored.postTrialService.getPendingSteps(POST_TRIAL_STEP_TYPES.REWARD_SELECTION).length, 1);
    assert.equal(restored.postTrialService.getPendingSteps(POST_TRIAL_STEP_TYPES.UNLOCK_APPLY).length, 1);
    const cleanup = restored.postTrialService.completeAfterPresentationCleanup();
    assert.equal(cleanup.success, true);
    assert.equal(cleanup.transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
    assert.equal(restored.engine.state.stage.id, 2);
    assert.deepEqual(restored.expandCalls, [7]);
    restored.postTrialService.completeRewardSelection({ result: { selected: "RESTORED" } });
    const completed = restored.postTrialService.completeUnlockApply({ result: { applied: "RESTORED" } });
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    dispose(restored);
}

// If a save captured the Stage after expansion but before the transition step was
// marked applied, load reconciles it as applied instead of expanding again. Other
// pending post-Trial work remains pending and still blocks normal progression.
{
    const restoredTransition = {
        schemaVersion: 2,
        transitionId: "POST_TRIAL_1_trial-1-crash-window",
        trialIndex: 1,
        scenarioId: "trial-1-crash-window",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
        steps: [
            {
                type: POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { rewardToken: "CRASH_WINDOW" }
            },
            {
                type: POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { unlockToken: "CRASH_WINDOW" }
            },
            {
                type: POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: {
                    trialIndex: 1,
                    fromStageId: 1,
                    toStageId: 2,
                    size: 7,
                    maxTiles: 48,
                    nextTrialIndex: 2
                }
            }
        ]
    };
    const restored = createHarness({ stageId: 2, restoredTransition });
    const transition = restored.postTrialService.getTransition();
    assert.equal(transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
    assert.equal(transition.steps[2].status, POST_TRIAL_STEP_STATUS.APPLIED);
    assert.equal(restored.postTrialService.canResumeNormalProgression(), false);
    assert.deepEqual(restored.expandCalls, []);

    restored.postTrialService.completeRewardSelection({ result: { selected: "RESTORED" } });
    const completed = restored.postTrialService.completeUnlockApply({ result: { applied: "RESTORED" } });
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.deepEqual(restored.expandCalls, []);
    dispose(restored);
}

console.log("diagnose_post_trial_progression_service: OK");
