import assert from "node:assert/strict";
import { GameFactHub } from "../../core/game_fact.js";
import { attachTrialRuntimeSubsystems } from "../integration/trial_runtime_bootstrap.js";
import {
    POST_TRIAL_STEP_STATUS,
    POST_TRIAL_STEP_TYPES,
    POST_TRIAL_TRANSITION_STATUS
} from "../systems/post_trial_progression_service.js";

const authorityCalls = [];
const expandCalls = [];
const timingAuthority = {
    getDistanceToNextTrial: () => null,
    isCurrentTrialDue: () => false,
    getCurrentTrialIndex: () => 2
};
const globalEventListeners = new Set();
const engine = {
    state: {
        turn: 15,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: 15,
        postTrialTransition: {
            schemaVersion: 5,
            transitionId: "POST_TRIAL_1_runtime-restore",
            trialIndex: 1,
            scenarioId: "runtime-restore",
            outcome: "SURVIVED",
            runTerminated: false,
            presentationCleanupComplete: true,
            status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
            aftermath: {
                trialIndex: 1,
                scenarioId: "runtime-restore",
                turn: 15,
                outcome: "SURVIVED",
                result: { completed: true, emberRemaining: 13 },
                settlement: { settled: true, runTerminated: false }
            },
            steps: [
                {
                    type: POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
                    status: POST_TRIAL_STEP_STATUS.PENDING,
                    payload: { choices: ["R1", "R2"] }
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
        },
        addLog() {}
    },
    gameFactHub: new GameFactHub(),
    globalEventManager: {
        subscribe(listener) {
            globalEventListeners.add(listener);
            return () => globalEventListeners.delete(listener);
        }
    },
    gridEngine: {
        expandGrid(size) {
            expandCalls.push(size);
            return Array.from({ length: size }, () => Array(size).fill(null));
        }
    },
    trialTimingAuthorityService: timingAuthority,
    __trialTimingSubsystemAttached: true
};

const attached = attachTrialRuntimeSubsystems(engine, {
    postTrialOptions: {
        rewardAuthority(request) {
            authorityCalls.push(request);
            return {
                success: true,
                appliedRewardId: request.result?.selectedRewardId || null
            };
        }
    }
});

assert.equal(attached.success, true);
assert.equal(attached.postTrialProgressionAttached, true);
assert.equal(attached.postTrialProgressionReadAttached, true);
assert.equal(attached.postTrialStepAuthorityRouterAttached, true);
assert.equal(engine.trialStageProgressionService.getPending()?.toStageId, 2);
assert.deepEqual(expandCalls, []);
assert.equal(authorityCalls.length, 0);

const serviceBeforeReattach = engine.postTrialProgressionService;
const readBeforeReattach = engine.postTrialProgressionReadService;
const stepRouterBeforeReattach = engine.postTrialStepAuthorityRouter;
const skillRouterBeforeReattach = engine.postTrialSkillProgressionRouter;
const stageBeforeReattach = engine.trialStageProgressionService;

// Composition is idempotent. Re-attaching cannot replace the restored services
// or silently swap in different mutation authorities.
const reattached = attachTrialRuntimeSubsystems(engine, {
    postTrialOptions: {
        rewardAuthority() {
            throw new Error("reattach must not replace existing reward authority");
        }
    }
});
assert.equal(reattached.success, true);
assert.equal(engine.postTrialProgressionService, serviceBeforeReattach);
assert.equal(engine.postTrialProgressionReadService, readBeforeReattach);
assert.equal(engine.postTrialStepAuthorityRouter, stepRouterBeforeReattach);
assert.equal(engine.postTrialSkillProgressionRouter, skillRouterBeforeReattach);
assert.equal(engine.trialStageProgressionService, stageBeforeReattach);
assert.equal(engine.trialStageProgressionService.getPending()?.toStageId, 2);
assert.deepEqual(expandCalls, []);
assert.equal(authorityCalls.length, 0);

const before = engine.postTrialProgressionReadService.read();
assert.equal(before.available, true);
assert.equal(before.status, POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS);
assert.equal(before.currentStep.type, POST_TRIAL_STEP_TYPES.REWARD_SELECTION);
assert.deepEqual(before.pendingStepTypes, [
    POST_TRIAL_STEP_TYPES.REWARD_SELECTION,
    POST_TRIAL_STEP_TYPES.STAGE_ADVANCE
]);
assert.equal(before.aftermath.result.emberRemaining, 13);
assert.equal(before.canResumeNormalProgression, false);

const applied = engine.postTrialProgressionService.completeRewardSelection({
    result: { selectedRewardId: "R2" }
});
assert.equal(applied.success, true);
assert.equal(authorityCalls.length, 1);
assert.equal(
    authorityCalls[0].operationId,
    "POST_TRIAL_1_runtime-restore:REWARD_SELECTION"
);
assert.deepEqual(expandCalls, [7]);
assert.equal(engine.state.stage.id, 2);
assert.equal(applied.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);

const after = engine.postTrialProgressionReadService.read();
assert.equal(after.currentStep, null);
assert.deepEqual(after.pendingStepTypes, []);
assert.equal(after.canResumeNormalProgression, true);
assert.equal(after.aftermath.result.emberRemaining, 13);

// Repeated completion after restore is orchestration-idempotent: the mutation
// authority and physical Stage expansion are not invoked again.
const repeated = engine.postTrialProgressionService.completeRewardSelection({
    result: { selectedRewardId: "R1" }
});
assert.equal(repeated.success, true);
assert.equal(repeated.alreadyApplied, true);
assert.equal(authorityCalls.length, 1);
assert.deepEqual(expandCalls, [7]);

console.log("diagnose_post_trial_runtime_restore: OK");
