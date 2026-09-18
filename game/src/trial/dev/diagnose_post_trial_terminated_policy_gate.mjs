import assert from "node:assert/strict";
import { GAME_FACT_TYPES, GameFactHub } from "../../core/game_fact.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";
import {
    PostTrialProgressionService,
    POST_TRIAL_TRANSITION_STATUS
} from "../systems/post_trial_progression_service.js";

const gameFactHub = new GameFactHub();
const policyCalls = { reward: 0, unlock: 0, skill: 0 };
const expandCalls = [];
const engine = {
    state: {
        turn: 15,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: 15,
        postTrialTransition: null,
        addLog() {}
    },
    gameFactHub,
    gridEngine: {
        expandGrid(size) {
            expandCalls.push(size);
            return Array.from({ length: size }, () => Array(size).fill(null));
        }
    }
};

const stageProgressionService = new TrialStageProgressionService(engine, { gameFactHub });
engine.trialStageProgressionService = stageProgressionService;
const postTrialProgressionService = new PostTrialProgressionService(engine, {
    gameFactHub,
    stageProgressionService,
    rewardStepPolicy() {
        policyCalls.reward += 1;
        return { rewardId: "SHOULD_NOT_EXIST" };
    },
    unlockStepPolicy() {
        policyCalls.unlock += 1;
        return { unlockId: "SHOULD_NOT_EXIST" };
    },
    skillProgressionStepPolicy() {
        policyCalls.skill += 1;
        return { owner: "PLAYER", skillId: "SHOULD_NOT_EXIST" };
    }
});

// Even with every normal continuation policy configured to return a step, a
// terminated Run must not enter Reward / Unlock / Stage / Skill / Final flow.
gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
    trialIndex: 1,
    scenarioId: "terminated-policy-gate",
    outcome: "DEFEAT",
    settlement: { settled: true, runTerminated: true }
});

const transition = postTrialProgressionService.getTransition();
assert.equal(transition.runTerminated, true);
assert.deepEqual(transition.steps, []);
assert.deepEqual(policyCalls, { reward: 0, unlock: 0, skill: 0 });
assert.equal(stageProgressionService.getPending(), null);
assert.deepEqual(expandCalls, []);

// Presentation cleanup may close the transition bookkeeping, but it cannot
// create normal continuation work or mutate the board.
const cleanup = postTrialProgressionService.completeAfterPresentationCleanup();
assert.equal(cleanup.success, true);
assert.equal(cleanup.transition.status, POST_TRIAL_TRANSITION_STATUS.COMPLETED);
assert.deepEqual(cleanup.transition.steps, []);
assert.deepEqual(policyCalls, { reward: 0, unlock: 0, skill: 0 });
assert.deepEqual(expandCalls, []);

postTrialProgressionService.dispose();
stageProgressionService.dispose();

console.log("diagnose_post_trial_terminated_policy_gate: OK");
