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

const TEST_SKILL_PROGRESSION_ROUTER = Object.freeze({
    apply({ owner, result }) {
        return {
            success: true,
            owner,
            authorityResult: {
                success: true,
                owner,
                result: result ?? null
            }
        };
    }
});

function createHarness({
    stageId = 1,
    restoredTransition = null,
    rewardStepPolicy = null,
    advisorProgressionStepPolicy = null,
    unlockStepPolicy = null,
    skillProgressionRouter = TEST_SKILL_PROGRESSION_ROUTER
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
        skillProgressionRouter,
        rewardStepPolicy,
        advisorProgressionStepPolicy,
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

// TRIAL_COMPLETED is presentation/domain completion only; settlement is the Run-level boundary.
{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, { trialIndex: 1 });
    assert.equal(h.engine.state.postTrialTransition, null);
    assert.equal(h.stageService.getPending(), null);
    dispose(h);
}

// Stage-only flow stays compatible and grid expansion waits for presentation cleanup.
{
    const h = createHarness();
    const settlement = {
        trialIndex: 1,
        scenarioId: "trial-1-stage-only",
        outcome: "VICTORY",
        settlement: { runTerminated: false }
    };
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);

    const created = h.postTrialService.getTransition();
    assert.equal(created.steps.length, 1);
    assert.equal(created.steps[0].type, POST_TRIAL_STEP_TYPES.STAGE_ADVANCE);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_TRANSITION_CREATED), 1);

    const completed = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_COMPLETED), 1);

    const repeated = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(repeated.alreadyCompleted, true);
    assert.deepEqual(h.expandCalls, [7]);
    dispose(h);
}

// Canonical ordering is Reward -> Unlock -> Stage -> Skill. Cleanup alone must
// not jump over pending semantic work and mutate the board early.
{
    const h = createHarness({
        rewardStepPolicy: ({ trialIndex }) => ({ source: "TEST_REWARD", trialIndex }),
        unlockStepPolicy: ({ trialIndex }) => ({ source: "TEST_UNLOCK", trialIndex }),
        advisorProgressionStepPolicy: ({ trialIndex }) => ({ source: "TEST_ADVISOR", trialIndex })
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-ordered",
        outcome: "VICTORY",
        settlement: { runTerminated: false }
    });

    assert.deepEqual(
        h.postTrialService.getTransition().steps.map(step => step.type),
        [
            POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
            POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
            POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
            POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION
        ]
    );
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.REWARD_SELECTION);

    const cleanup = h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(cleanup.success, true);
    assert.equal(cleanup.transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const earlyUnlock = h.postTrialService.completeUnlockApply({ result: { invalid: true } });
    assert.equal(earlyUnlock.success, false);
    assert.equal(earlyUnlock.reason, "POST_TRIAL_STEP_OUT_OF_ORDER");
    assert.equal(earlyUnlock.currentStepType, POST_TRIAL_STEP_TYPES.REWARD_SELECTION);
    const earlySkill = h.postTrialService.completeAdvisorProgression({ result: { invalid: true } });
    assert.equal(earlySkill.success, false);
    assert.equal(earlySkill.currentStepType, POST_TRIAL_STEP_TYPES.REWARD_SELECTION);

    const lifecycle = createTurnLifecycleHarness(h.postTrialService);
    const blockedAtVerse = h.engine.state.turn;
    assert.equal(lifecycle.advance(), blockedAtVerse);
    assert.equal(lifecycle.getLastAdvanceBlock()?.reason, "POST_TRIAL_PROGRESSION_PENDING");

    const reward = h.postTrialService.completeRewardSelection({ result: { selected: "TEST_REWARD" } });
    assert.equal(reward.success, true);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.UNLOCK_APPLY);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const unlock = h.postTrialService.completeUnlockApply({ result: { applied: "TEST_UNLOCK" } });
    assert.equal(unlock.success, true);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    assert.equal(unlock.transition.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);

    const repeatedReward = h.postTrialService.completeRewardSelection({ result: { duplicate: true } });
    assert.equal(repeatedReward.success, true);
    assert.equal(repeatedReward.alreadyApplied, true);
    assert.deepEqual(h.expandCalls, [7]);

    const skill = h.postTrialService.completeAdvisorProgression({ result: { selectedSkillId: "TEST_ONLY" } });
    assert.equal(skill.success, true);
    assert.equal(skill.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.equal(h.postTrialService.canResumeNormalProgression(), true);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_REWARD_SELECTED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_UNLOCK_APPLIED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED), 1);
    assert.equal(countFacts(h, GAME_FACT_TYPES.POST_TRIAL_COMPLETED), 1);

    assert.equal(lifecycle.advance(), blockedAtVerse + 1);
    assert.equal(lifecycle.getLastAdvanceBlock(), null);
    dispose(h);
}

// If Reward/Unlock finish before presentation cleanup, Stage still cannot mutate
// the physical board until cleanup completes; Skill remains blocked behind Stage.
{
    const h = createHarness({
        rewardStepPolicy: () => true,
        unlockStepPolicy: () => true,
        advisorProgressionStepPolicy: () => true
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-cleanup-gate",
        settlement: { runTerminated: false }
    });

    h.postTrialService.completeRewardSelection();
    h.postTrialService.completeUnlockApply();
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.STAGE_ADVANCE);
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const earlySkill = h.postTrialService.completeAdvisorProgression();
    assert.equal(earlySkill.success, false);
    assert.equal(earlySkill.currentStepType, POST_TRIAL_STEP_TYPES.STAGE_ADVANCE);

    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    dispose(h);
}

// Legacy Advisor-only policy naturally becomes generic Skill progression after Stage.
{
    const h = createHarness({ advisorProgressionStepPolicy: () => ({ selectionRequired: true }) });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-advisor",
        settlement: { runTerminated: false }
    });
    assert.deepEqual(
        h.postTrialService.getTransition().steps.map(step => step.type),
        [POST_TRIAL_STEP_TYPES.STAGE_ADVANCE, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION]
    );
    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 2);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    const applied = h.postTrialService.completeAdvisorProgression({ result: { selectedSkillId: "TEST_ONLY" } });
    assert.equal(applied.success, true);
    assert.equal(applied.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    dispose(h);
}

// Trial 2 authorizes Stage 3 and Trial 3 never creates Stage 4.
{
    const h = createHarness({ stageId: 2 });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 2,
        scenarioId: "trial-2",
        settlement: { runTerminated: false }
    });
    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 3);
    assert.deepEqual(h.expandCalls, [9]);
    dispose(h);

    const final = createHarness({ stageId: 3 });
    final.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 3,
        scenarioId: "trial-3",
        settlement: { runTerminated: false }
    });
    assert.deepEqual(
        final.postTrialService.getTransition().steps.map(step => step.type),
        [POST_TRIAL_STEP_TYPES.FINAL_RUN_COMPLETION]
    );
    assert.equal(final.stageService.getPending(), null);
    final.postTrialService.completeAfterPresentationCleanup();
    assert.equal(final.postTrialService.canResumeNormalProgression(), false);
    assert.deepEqual(final.expandCalls, []);
    const completed = final.postTrialService.completeFinalRunCompletion({ result: { handedOffToEnding: true } });
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    dispose(final);
}

// A terminated Run never invents Stage or final-completion work on its own.
{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-defeat",
        settlement: { runTerminated: true }
    });
    assert.equal(h.postTrialService.getTransition().steps.length, 0);
    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);
    dispose(h);
}

// Save/load restoration preserves work and migrates older step ordering into the
// canonical sequence before any step can be completed.
{
    const restoredTransition = {
        schemaVersion: 3,
        transitionId: "POST_TRIAL_1_legacy-order",
        trialIndex: 1,
        scenarioId: "legacy-order",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
        steps: [
            {
                type: "ADVISOR_PROGRESSION",
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { advisorToken: "RESTORE" }
            },
            {
                type: POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { rewardToken: "RESTORE" }
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
            },
            {
                type: POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { unlockToken: "RESTORE" }
            }
        ]
    };
    const restored = createHarness({ stageId: 1, restoredTransition });
    assert.equal(restored.postTrialService.getTransition().schemaVersion, 4);
    assert.deepEqual(
        restored.postTrialService.getTransition().steps.map(step => step.type),
        [
            POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
            POST_TRIAL_STEP_TYPES.UNLOCK_APPLY,
            POST_TRIAL_STEP_TYPES.STAGE_ADVANCE,
            POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION
        ]
    );
    assert.equal(restored.stageService.getPending()?.toStageId, 2);
    restored.postTrialService.completeRewardSelection();
    const unlock = restored.postTrialService.completeUnlockApply();
    assert.equal(unlock.success, true);
    assert.equal(restored.engine.state.stage.id, 2);
    assert.deepEqual(restored.expandCalls, [7]);
    const skill = restored.postTrialService.completeAdvisorProgression();
    assert.equal(skill.success, true);
    assert.equal(restored.postTrialService.canResumeNormalProgression(), true);
    dispose(restored);
}

// Crash-window recovery: if the saved world already reached the target Stage while
// the transition still says Stage pending, restore marks it APPLIED and never expands twice.
{
    const restoredTransition = {
        schemaVersion: 2,
        transitionId: "POST_TRIAL_1_crash-window",
        trialIndex: 1,
        scenarioId: "crash-window",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
        steps: [
            {
                type: POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: { rewardToken: "CRASH" }
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
    const stageStep = restored.postTrialService.getTransition().steps.find(
        step => step.type === POST_TRIAL_STEP_TYPES.STAGE_ADVANCE
    );
    assert.equal(stageStep.status, POST_TRIAL_STEP_STATUS.APPLIED);
    assert.deepEqual(restored.expandCalls, []);
    const completed = restored.postTrialService.completeRewardSelection({ result: { selected: "RESTORED" } });
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.deepEqual(restored.expandCalls, []);
    dispose(restored);
}

console.log("diagnose_post_trial_progression_service: OK");
