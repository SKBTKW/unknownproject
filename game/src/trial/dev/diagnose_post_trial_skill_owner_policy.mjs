import assert from "node:assert/strict";
import { GameFactHub, GAME_FACT_TYPES } from "../../core/game_fact.js";
import { TrialStageProgressionService } from "../systems/trial_stage_progression_service.js";
import { PostTrialSkillProgressionRouter } from "../systems/post_trial_skill_progression_router.js";
import {
    PostTrialProgressionService,
    POST_TRIAL_SKILL_OWNER_TYPES,
    POST_TRIAL_STEP_TYPES,
    POST_TRIAL_STEP_STATUS
} from "../systems/post_trial_progression_service.js";

const DEFAULT_AUTHORITY = Symbol("DEFAULT_AUTHORITY");

function createHarness({
    owner = null,
    policyEnabled = owner !== null,
    restoredTransition = null,
    advisorAuthority = DEFAULT_AUTHORITY,
    playerAuthority = DEFAULT_AUTHORITY
} = {}) {
    const gameFactHub = new GameFactHub();
    const calls = { advisor: [], player: [] };
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

    const resolvedAdvisorAuthority = advisorAuthority === DEFAULT_AUTHORITY
        ? request => {
            calls.advisor.push(request);
            return { success: true, authority: "ADVISOR", selected: request.result?.selectedSkillId || null };
        }
        : advisorAuthority;
    const resolvedPlayerAuthority = playerAuthority === DEFAULT_AUTHORITY
        ? request => {
            calls.player.push(request);
            return { success: true, authority: "PLAYER", selected: request.result?.selectedSkillId || null };
        }
        : playerAuthority;

    const skillProgressionRouter = new PostTrialSkillProgressionRouter({
        advisorAuthority: resolvedAdvisorAuthority,
        playerAuthority: resolvedPlayerAuthority
    });
    engine.postTrialSkillProgressionRouter = skillProgressionRouter;

    const postTrialProgressionService = new PostTrialProgressionService(engine, {
        gameFactHub,
        stageProgressionService,
        skillProgressionRouter,
        skillProgressionStepPolicy: policyEnabled
            ? ({ trialIndex }) => ({
                ...(owner ? { owner } : {}),
                selectionRequired: true,
                trialIndex
            })
            : null
    });
    return {
        engine,
        gameFactHub,
        calls,
        stageProgressionService,
        skillProgressionRouter,
        postTrialProgressionService
    };
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

function expectedOperationId(scenarioId, owner) {
    return `POST_TRIAL_1_${scenarioId}:SKILL_PROGRESSION:${owner}`;
}

function dispose(h) {
    h.postTrialProgressionService.dispose();
    h.stageProgressionService.dispose();
}

// Both owners use exactly the same Post-Trial route, but only their own authority
// receives the mutation request. The owner is part of the stable idempotency key.
for (const owner of [
    POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
    POST_TRIAL_SKILL_OWNER_TYPES.PLAYER
]) {
    const scenarioId = `trial-1-${owner.toLowerCase()}`;
    const h = createHarness({ owner });
    const step = settleAndReachSkill(h, scenarioId);
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
    assert.equal(h.calls.advisor.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR ? 1 : 0);
    assert.equal(h.calls.player.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.PLAYER ? 1 : 0);

    const authorityCall = owner === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR
        ? h.calls.advisor[0]
        : h.calls.player[0];
    const operationId = expectedOperationId(scenarioId, owner);
    assert.equal(authorityCall.operationId, operationId);
    assert.equal(authorityCall.context.operationId, operationId);
    assert.equal(applied.step.result.authorityResult.authority, owner);

    // Completion is idempotent at the orchestration boundary: the real owner
    // authority is not called twice.
    const repeated = h.postTrialProgressionService.completeSkillProgression({
        owner,
        result: { selectedSkillId: "duplicate" }
    });
    assert.equal(repeated.success, true);
    assert.equal(repeated.alreadyApplied, true);
    assert.equal(h.calls.advisor.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR ? 1 : 0);
    assert.equal(h.calls.player.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.PLAYER ? 1 : 0);
    dispose(h);
}

// A caller cannot apply an Advisor-owned skill step to the Player authority, and
// mismatch rejection happens before either authority is invoked.
{
    const h = createHarness({ owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR });
    settleAndReachSkill(h, "trial-1-owner-mismatch");
    const mismatch = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "wrong-owner" }
    });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.reason, "POST_TRIAL_SKILL_OWNER_MISMATCH");
    assert.equal(h.calls.advisor.length, 0);
    assert.equal(h.calls.player.length, 0);
    assert.equal(
        h.postTrialProgressionService.getCurrentPendingStep().status,
        POST_TRIAL_STEP_STATUS.PENDING
    );
    dispose(h);
}

// Ownership can remain undecided at settlement time. The explicit owner supplied
// at completion determines both mutation authority and operation id.
{
    const h = createHarness({ owner: null, policyEnabled: true });
    const scenarioId = "trial-1-late-owner";
    const step = settleAndReachSkill(h, scenarioId);
    assert.equal(step.payload.owner, undefined);
    const applied = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "late-player-choice" }
    });
    assert.equal(applied.success, true);
    assert.equal(h.calls.advisor.length, 0);
    assert.equal(h.calls.player.length, 1);
    assert.equal(
        h.calls.player[0].operationId,
        expectedOperationId(scenarioId, POST_TRIAL_SKILL_OWNER_TYPES.PLAYER)
    );
    dispose(h);
}

// Missing owner authority fails closed. The transition remains pending and can be
// retried once a real owner implementation is wired in a future integration.
{
    const h = createHarness({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
        advisorAuthority: null
    });
    const scenarioId = "trial-1-missing-authority";
    settleAndReachSkill(h, scenarioId);
    const blocked = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
        result: { selectedSkillId: "not-applied" }
    });
    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, "POST_TRIAL_SKILL_AUTHORITY_REQUIRED");
    assert.equal(
        blocked.delegation.operationId,
        expectedOperationId(scenarioId, POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR)
    );
    assert.equal(h.postTrialProgressionService.getCurrentPendingStep().status, POST_TRIAL_STEP_STATUS.PENDING);
    dispose(h);
}

// Authority rejection also leaves the step pending instead of recording a false
// progression success.
{
    const h = createHarness({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        playerAuthority: () => ({ success: false, reason: "TEST_PLAYER_REJECTED" })
    });
    const scenarioId = "trial-1-authority-rejected";
    settleAndReachSkill(h, scenarioId);
    const rejected = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "rejected" }
    });
    assert.equal(rejected.success, false);
    assert.equal(rejected.reason, "TEST_PLAYER_REJECTED");
    assert.equal(
        rejected.delegation.operationId,
        expectedOperationId(scenarioId, POST_TRIAL_SKILL_OWNER_TYPES.PLAYER)
    );
    assert.equal(h.postTrialProgressionService.getCurrentPendingStep().status, POST_TRIAL_STEP_STATUS.PENDING);
    dispose(h);
}

// A crash-window replay from the same pending save derives the exact same key in
// a fresh runtime, allowing the real owner authority to deduplicate mutation.
{
    const restoredTransition = {
        schemaVersion: 5,
        transitionId: "POST_TRIAL_1_crash-skill",
        trialIndex: 1,
        scenarioId: "crash-skill",
        outcome: "VICTORY",
        runTerminated: false,
        presentationCleanupComplete: true,
        status: "PENDING_STEPS",
        steps: [
            {
                type: POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION,
                status: POST_TRIAL_STEP_STATUS.PENDING,
                payload: {
                    owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
                    selectionRequired: true
                }
            }
        ]
    };
    const first = createHarness({ restoredTransition, policyEnabled: false });
    const firstApplied = first.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "crash-replay" }
    });
    assert.equal(firstApplied.success, true);
    const firstOperationId = first.calls.player[0].operationId;
    dispose(first);

    const replay = createHarness({ restoredTransition, policyEnabled: false });
    const replayApplied = replay.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "crash-replay" }
    });
    assert.equal(replayApplied.success, true);
    assert.equal(replay.calls.player[0].operationId, firstOperationId);
    assert.equal(
        firstOperationId,
        expectedOperationId("crash-skill", POST_TRIAL_SKILL_OWNER_TYPES.PLAYER)
    );
    dispose(replay);
}

// Old saves explicitly named ADVISOR_PROGRESSION migrate to generic Skill progression
// while preserving their historical Advisor ownership semantics. Restoration alone
// never calls the owner authority.
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
    const h = createHarness({ restoredTransition, policyEnabled: false });
    const step = h.postTrialProgressionService.getCurrentPendingStep();
    assert.equal(step.type, POST_TRIAL_STEP_TYPES.SKILL_PROGRESSION);
    assert.equal(step.payload.owner, POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR);
    assert.equal(h.engine.state.postTrialTransition.schemaVersion, 4);
    assert.equal(h.calls.advisor.length, 0);
    assert.equal(h.calls.player.length, 0);

    const legacyApi = h.postTrialProgressionService.completeAdvisorProgression({
        result: { selectedSkillId: "legacy-compatible" }
    });
    assert.equal(legacyApi.success, true);
    assert.equal(legacyApi.transition.status, "COMPLETED");
    assert.equal(h.calls.advisor.length, 1);
    assert.equal(h.calls.player.length, 0);
    assert.equal(
        h.calls.advisor[0].operationId,
        expectedOperationId("legacy-advisor", POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR)
    );
    dispose(h);
}

console.log("diagnose_post_trial_skill_owner_policy: OK");
