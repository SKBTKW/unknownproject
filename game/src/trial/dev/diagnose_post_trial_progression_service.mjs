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

const TEST_STEP_AUTHORITY_ROUTER = Object.freeze({
    apply({ type, result }) {
        return {
            success: true,
            stepType: type,
            authorityResult: {
                success: true,
                type,
                result: result ?? null
            }
        };
    }
});

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
    stepAuthorityRouter = TEST_STEP_AUTHORITY_ROUTER,
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
        postTrialTransition: restoredTransition
            ? JSON.parse(JSON.stringify(restoredTransition))
            : null,
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
        stepAuthorityRouter,
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

// Domain completion alone cannot start Run-level post-Trial work.
{
    const h = createHarness();
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_COMPLETED, { trialIndex: 1 });
    assert.equal(h.engine.state.postTrialTransition, null);
    assert.equal(h.stageService.getPending(), null);
    dispose(h);
}

// Stage-only flow is idempotent and waits for presentation cleanup.
{
    const h = createHarness();
    const settlement = {
        trialIndex: 1,
        scenarioId: "trial-1-stage-only",
        outcome: "SURVIVED",
        settlement: { runTerminated: false }
    };
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, settlement);

    assert.deepEqual(
        h.postTrialService.getTransition().steps.map(step => step.type),
        [POST_TRIAL_STEP_TYPES.STAGE_ADVANCE]
    );
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

// Reward -> Unlock -> Stage -> Skill is strict, and Verse cannot resume early.
{
    const h = createHarness({
        rewardStepPolicy: ({ trialIndex }) => ({ source: "TEST_REWARD", trialIndex }),
        unlockStepPolicy: ({ trialIndex }) => ({ source: "TEST_UNLOCK", trialIndex }),
        advisorProgressionStepPolicy: ({ trialIndex }) => ({
            source: "TEST_SKILL",
            owner: "ADVISOR",
            trialIndex
        })
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-ordered",
        outcome: "SURVIVED",
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

    h.postTrialService.completeAfterPresentationCleanup();
    assert.equal(h.engine.state.stage.id, 1);
    assert.deepEqual(h.expandCalls, []);

    const earlyUnlock = h.postTrialService.completeUnlockApply({ result: { invalid: true } });
    assert.equal(earlyUnlock.success, false);
    assert.equal(earlyUnlock.reason, "POST_TRIAL_STEP_OUT_OF_ORDER");
    const earlySkill = h.postTrialService.completeAdvisorProgression({ result: { invalid: true } });
    assert.equal(earlySkill.success, false);
    assert.equal(earlySkill.reason, "POST_TRIAL_STEP_OUT_OF_ORDER");

    const lifecycle = createTurnLifecycleHarness(h.postTrialService);
    const blockedAtVerse = h.engine.state.turn;
    assert.equal(lifecycle.advance(), blockedAtVerse);
    assert.equal(lifecycle.getLastAdvanceBlock()?.reason, "POST_TRIAL_PROGRESSION_PENDING");

    const reward = h.postTrialService.completeRewardSelection({ result: { selected: "TEST_REWARD" } });
    assert.equal(reward.success, true);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.UNLOCK_APPLY);

    const unlock = h.postTrialService.completeUnlockApply({ result: { applied: "TEST_UNLOCK" } });
    assert.equal(unlock.success, true);
    assert.equal(h.engine.state.stage.id, 2);
    assert.deepEqual(h.expandCalls, [7]);
    assert.equal(h.postTrialService.getCurrentPendingStep()?.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);

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

// Reward and Unlock may finish before UI cleanup, but Stage still cannot mutate early.
{
    const h = createHarness({
        rewardStepPolicy: () => true,
        unlockStepPolicy: () => true,
        advisorProgressionStepPolicy: () => ({ owner: "ADVISOR" })
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-cleanup-gate",
        settlement: { runTerminated: false }
    });

    assert.equal(h.postTrialService.completeRewardSelection().success, true);
    assert.equal(h.postTrialService.completeUnlockApply().success, true);
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

// Trial 2 reaches Stage 3; Trial 3 delegates Final Run completion and never creates Stage 4.
{
    const second = createHarness({ stageId: 2 });
    second.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 2,
        scenarioId: "trial-2",
        settlement: { runTerminated: false }
    });
    second.postTrialService.completeAfterPresentationCleanup();
    assert.equal(second.engine.state.stage.id, 3);
    assert.deepEqual(second.expandCalls, [9]);
    dispose(second);

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
    const completed = final.postTrialService.completeFinalRunCompletion({
        result: { handedOffToEnding: true }
    });
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.deepEqual(final.expandCalls, []);
    dispose(final);
}

// A terminated Run never invents Stage or Final completion work on its own.
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

// Restored legacy ordering is normalized before any step may complete.
{
    const restoredTransition = {
        schemaVersion: 3,
        transitionId: "POST_TRIAL_1_legacy-order",
        trialIndex: 1,
        scenarioId: "legacy-order",
        outcome: "SURVIVED",
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
    assert.equal(restored.postTrialService.completeRewardSelection().success, true);
    assert.equal(restored.postTrialService.completeUnlockApply().success, true);
    assert.equal(restored.engine.state.stage.id, 2);
    assert.deepEqual(restored.expandCalls, [7]);
    assert.equal(restored.postTrialService.completeAdvisorProgression().success, true);
    assert.equal(restored.postTrialService.canResumeNormalProgression(), true);
    dispose(restored);
}

// Crash-window recovery never expands the same Stage twice.
{
    const restoredTransition = {
        schemaVersion: 2,
        transitionId: "POST_TRIAL_1_crash-window",
        trialIndex: 1,
        scenarioId: "crash-window",
        outcome: "SURVIVED",
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
    const completed = restored.postTrialService.completeRewardSelection({
        result: { selected: "RESTORED" }
    });
    assert.equal(completed.success, true);
    assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
    assert.deepEqual(restored.expandCalls, []);
    dispose(restored);
}

// Semantic external steps fail closed without an authority router.
{
    const h = createHarness({
        rewardStepPolicy: () => ({ rewardToken: "REQUIRED" }),
        stepAuthorityRouter: null
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-no-reward-authority",
        settlement: { runTerminated: false }
    });
    h.postTrialService.completeAfterPresentationCleanup();
    const result = h.postTrialService.completeRewardSelection({ result: { selected: "X" } });
    assert.equal(result.success, false);
    assert.equal(result.reason, "POST_TRIAL_STEP_ROUTER_REQUIRED");
    assert.equal(
        h.postTrialService.getCurrentPendingStep()?.type,
        POST_TRIAL_STEP_TYPES.REWARD_SELECTION
    );
    dispose(h);
}

// Authority rejection leaves the step pending.
{
    const h = createHarness({
        rewardStepPolicy: () => ({ rewardToken: "REJECT" }),
        stepAuthorityRouter: {
            apply() {
                return { success: false, reason: "TEST_REWARD_REJECTED" };
            }
        }
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-rejected-reward",
        settlement: { runTerminated: false }
    });
    const result = h.postTrialService.completeRewardSelection({ result: { selected: "X" } });
    assert.equal(result.success, false);
    assert.equal(result.reason, "TEST_REWARD_REJECTED");
    assert.equal(
        h.postTrialService.getCurrentPendingStep()?.status,
        POST_TRIAL_STEP_STATUS.PENDING
    );
    dispose(h);
}

// A successful authority is called exactly once even if completion is retried.
{
    let applyCount = 0;
    const h = createHarness({
        rewardStepPolicy: () => ({ rewardToken: "ONCE" }),
        stepAuthorityRouter: {
            apply({ type, result }) {
                applyCount += 1;
                return {
                    success: true,
                    stepType: type,
                    authorityResult: { success: true, result }
                };
            }
        }
    });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId: "trial-1-authority-once",
        settlement: { runTerminated: false }
    });
    h.postTrialService.completeAfterPresentationCleanup();
    const first = h.postTrialService.completeRewardSelection({ result: { selected: "A" } });
    assert.equal(first.success, true);
    assert.equal(applyCount, 1);
    const repeated = h.postTrialService.completeRewardSelection({ result: { selected: "B" } });
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyApplied, true);
    assert.equal(applyCount, 1);
    dispose(h);
}

console.log("diagnose_post_trial_progression_service: OK");
