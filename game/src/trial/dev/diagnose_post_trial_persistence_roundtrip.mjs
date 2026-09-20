import assert from "node:assert/strict";
import { GameFactHub } from "../../core/game_fact.js";
import { serializeGameState } from "../../core/state_serializer.js";
import { hydrateGameState } from "../../core/hydrate_game_state.js";
import { attachTrialRuntimeSubsystems } from "../integration/trial_runtime_bootstrap.js";
import {
    POST_TRIAL_STEP_STATUS,
    POST_TRIAL_STEP_TYPES,
    POST_TRIAL_TRANSITION_STATUS
} from "../systems/post_trial_progression_service.js";

function createBaseState() {
    return {
        turn: 15,
        ember: 13,
        maxEmber: 20,
        food: 30,
        wood: 20,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 2,
        grid: [],
        handOffering: [],
        reserveSlots: [],
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: 15,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        postTrialTransition: {
            schemaVersion: 5,
            transitionId: "POST_TRIAL_1_persistence-roundtrip",
            trialIndex: 1,
            scenarioId: "persistence-roundtrip",
            outcome: "SURVIVED",
            runTerminated: false,
            presentationCleanupComplete: true,
            status: POST_TRIAL_TRANSITION_STATUS.PENDING_STEPS,
            presentation: {
                schemaVersion: 1,
                transitionId: "POST_TRIAL_1_persistence-roundtrip",
                status: "ACTIVE",
                currentSceneIndex: 3,
                scenes: [
                    { id: "AFTERMATH" },
                    { id: "ASSESSMENT" },
                    { id: "TRIAL_MEANING" },
                    { id: "STAGE_PRELUDE" },
                    { id: "STAGE_REVEAL" },
                    { id: "POST_STAGE_COMMENT" },
                    { id: "CLOSE" }
                ],
                completedSceneIds: ["AFTERMATH", "ASSESSMENT", "TRIAL_MEANING"]
            },
            aftermath: {
                trialIndex: 1,
                scenarioId: "persistence-roundtrip",
                turn: 15,
                outcome: "SURVIVED",
                result: {
                    completed: true,
                    outcome: "SURVIVED",
                    emberRemaining: 13,
                    totalEmberDamage: 2
                },
                settlement: {
                    settled: true,
                    outcome: "SURVIVED",
                    runTerminated: false,
                    canExitTrial: true
                }
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
        }
    };
}

const sourceState = createBaseState();
const serialized = serializeGameState(sourceState);
assert.ok(serialized);
assert.deepEqual(serialized.postTrialTransition, sourceState.postTrialTransition);

// Serialized data is detached from the live source state.
serialized.postTrialTransition.aftermath.result.emberRemaining = 999;
assert.equal(sourceState.postTrialTransition.aftermath.result.emberRemaining, 13);
serialized.postTrialTransition.aftermath.result.emberRemaining = 13;

const restoredState = {};
hydrateGameState(restoredState, serialized);
assert.deepEqual(restoredState.postTrialTransition, sourceState.postTrialTransition);
assert.equal(restoredState.stage.id, 1);
assert.equal(restoredState.turn, 15);
assert.equal(restoredState.ember, 13);
assert.equal(restoredState.mergeLinks instanceof Set, true);
assert.equal(restoredState.grantedConnectionPairs instanceof Set, true);

// Hydrated state is detached from serialized data as well.
restoredState.postTrialTransition.aftermath.result.totalEmberDamage = 77;
assert.equal(serialized.postTrialTransition.aftermath.result.totalEmberDamage, 2);
restoredState.postTrialTransition.aftermath.result.totalEmberDamage = 2;

const authorityCalls = [];
const expandCalls = [];
const globalEventListeners = new Set();
const engine = {
    state: restoredState,
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
    trialTimingAuthorityService: {
        getDistanceToNextTrial: () => null,
        isCurrentTrialDue: () => false,
        getCurrentTrialIndex: () => 2
    },
    __trialTimingSubsystemAttached: true
};

const attached = attachTrialRuntimeSubsystems(engine, {
    postTrialOptions: {
        rewardAuthority(request) {
            authorityCalls.push(request);
            return { success: true, appliedRewardId: request.result?.selectedRewardId || null };
        }
    }
});
assert.equal(attached.success, true);
assert.equal(authorityCalls.length, 0);
assert.deepEqual(expandCalls, []);
assert.equal(engine.trialStageProgressionService.getPending()?.toStageId, 2);

const restoredRead = engine.postTrialProgressionReadService.read();
assert.equal(restoredRead.currentStep.type, POST_TRIAL_STEP_TYPES.REWARD_SELECTION);
assert.equal(restoredRead.aftermath.result.emberRemaining, 13);
assert.equal(restoredRead.canResumeNormalProgression, false);

const completed = engine.postTrialProgressionService.completeRewardSelection({
    result: { selectedRewardId: "R2" }
});
assert.equal(completed.success, true);
assert.equal(authorityCalls.length, 1);
assert.equal(
    authorityCalls[0].operationId,
    "POST_TRIAL_1_persistence-roundtrip:REWARD_SELECTION"
);
assert.deepEqual(expandCalls, [7]);
assert.equal(engine.state.stage.id, 2);
assert.equal(completed.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
assert.equal(
    engine.postTrialProgressionReadService.read().canResumeNormalProgression,
    false,
    "completed game steps must remain blocked while persisted interlude presentation is ACTIVE"
);

engine.state.postTrialTransition.presentation.status = "COMPLETED";
assert.equal(
    engine.postTrialProgressionReadService.read().canResumeNormalProgression,
    true,
    "normal Verse progression resumes only after the persisted interlude is closed"
);

console.log("diagnose_post_trial_persistence_roundtrip: OK");
