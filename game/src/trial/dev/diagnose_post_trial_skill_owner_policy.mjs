import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";
import {
    PostTrialProgressionService,
    POST_TRIAL_SKILL_OWNER_TYPES,
    POST_TRIAL_STEP_TYPES,
    POST_TRIAL_STEP_STATUS
} from "../systems/post_trial_progression_service.js";

function createHarness({ owner = null, restoredTransition = null } = {}) {
    const gameFactHub = new GameFactHub();
    const state = {
        turn: 15,
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        trialSchedule: { trial1: 15, trial2: 30, trial3: 50 },
        nextTrialTurn: 15,
        postTrialTransition: restoredTransition ? JSON.parse(JSON.stringify(restoredTransition)) : null,
        addLog() {}
    };
    const engine = {
        state,
        gameFactHub,
        gridEngine: {
            expandGrid(size) {
                return Array.from({ length: size }, () => Array(size).fill(null));
            }
        }
    };
    const stageProgressionService = new TrialStageProgressionService(engine, { gameFactHub });
    engine.trialStageProgressionService = stageProgressionService;
    const postTrialProgressionService = new PostTrialProgressionService(engine, {
        gameFactHub,
        stageProgressionService,
        skillProgressionStepPolicy: owner
            ? ({ trialIndex }) => ({ owner, selectionRequired: true, trialIndex })
            : null
    });
    return { engine, gameFactHub, stageProgressionService, postTrialProgressionService };
}

function settleAndReachSkill(h, scenarioId) {
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        trialIndex: 1,
        scenarioId,
        outcome: "VICTORY",
        settlement: { runTerminated: false }
    });
    const cleanup = h.postTrialProgressionService.completeAfterPresentationCleanup();
    assert.equal(cleanup.success, true);
    assert.equal(h.engine.state.stage.id, 2);
    return h.postTrialProgressionService.getCurrentPendingStep();
}

for (const owner of [
    POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
    POST_TRIAL_SKILL_OWNER_TYPES.PLAYER
]) {
    const h = createHarness({ owner });
    const step = settleAndReachSkill(h, `trial-1-${owner.toLowerCase()}`);
    assert.equal(step.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    assert.equal(step.status, POST_TRIAL_STEP_STATUS.PENDING);
    assert.equal(step.payload.owner, owner);

    const applied = h.postTrialProgressionService.completeSkillProgression({
        owner,
        result: { selectedSkillId: `skill-${owner.toLowerCase()}` }
    });
    assert.equal(applied.success, true);
    assert.equal(applied.step.result.owner, owner);
    assert.equal(applied.transition.status, "COMPLETED");

    h.postTrialProgressionService.dispose();
    h.stageProgressionService.dispose();
}

// A caller cannot apply an Advisor-owned skill step to the Player authority.
{
    const h = createHarness({ owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR });
    settleAndReachSkill(h, "trial-1-owner-mismatch");
    const mismatch = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "wrong-owner" }
    });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.reason, "POST_TRIAL_SKILL_OWNER_MISMATCH");
    assert.equal(
        h.postTrialProgressionService.getCurrentPendingStep().status,
        POST_TRIAL_STEP_STATUS.PENDING
    );
    h.postTrialProgressionService.dispose();
    h.stageProgressionService.dispose();
}

// Old saves explicitly named ADVISOR_PROGRESSION migrate to generic Skill progression
// while preserving their historical Advisor ownership semantics.
{
    const restoredTransition = {
        schemaVersion: 4,
        transitionId: "POST_TRIAL_1_legacy-advisor",
        trialIndex: 1,
        scenarioId: "legacy-advisor",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: "PENDING_STEPS",
        steps: [
            {
                type: "ADVISOR_PROGRESSION",
                status: "PENDING",
                payload: { selectionRequired: true }
            }
        ]
    };
    const h = createHarness({ restoredTransition });
    const step = h.postTrialProgressionService.getCurrentPendingStep();
    assert.equal(step.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    assert.equal(step.payload.owner, POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR);
    assert.equal(h.engine.state.postTrialTransition.schemaVersion, 4);

    const legacyApi = h.postTrialProgressionService.completeAdvisorProgression({
        result: { selectedSkillId: "legacy-compatible" }
    });
    assert.equal(legacyApi.success, true);
    assert.equal(legacyApi.transition.status, "COMPLETED");
    h.postTrialProgressionService.dispose();
    h.stageProgressionService.dispose();
}

console.log("diagnose_post_trial_skill_owner_policy: OK");