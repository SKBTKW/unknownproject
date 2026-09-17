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

function dispose(h) {
    h.postTrialProgressionService.dispose();
    h.stageProgressionService.dispose();
}

// Both owners use exactly the same Post-Trial route, but only their own authority
// receives the mutation request.
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
    assert.equal(h.calls.advisor.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR ? 1 : 0);
    assert.equal(h.calls.player.length, owner === POST_TRIAL_SKILL_OWNER_TYPES.PLAYER ? 1 : 0);

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
// at completion determines which authority receives the mutation.
{
    const h = createHarness({ owner: null, policyEnabled: true });
    const step = settleAndReachSkill(h, "trial-1-late-owner");
    assert.equal(step.payload.owner, undefined);
    const applied = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "late-player-choice" }
    });
    assert.equal(applied.success, true);
    assert.equal(h.calls.advisor.length, 0);
    assert.equal(h.calls.player.length, 1);
    dispose(h);
}

// Missing owner authority fails closed. The transition remains pending and can be
// retried once a real owner implementation is wired in a future integration.
{
    const h = createHarness({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
        advisorAuthority: null
    });
    settleAndReachSkill(h, "trial-1-missing-authority");
    const blocked = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.ADVISOR,
        result: { selectedSkillId: "not-applied" }
    });
    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, "POST_TRIAL_SKILL_AUTHORITY_REQUIRED");
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
    settleAndReachSkill(h, "trial-1-authority-rejected");
    const rejected = h.postTrialProgressionService.completeSkillProgression({
        owner: POST_TRIAL_SKILL_OWNER_TYPES.PLAYER,
        result: { selectedSkillId: "rejected" }
    });
    assert.equal(rejected.success, false);
    assert.equal(rejected.reason, "TEST_PLAYER_REJECTED");
    assert.equal(h.postTrialProgressionService.getCurrentPendingStep().status, POST_TRIAL_STEP_STATUS.PENDING);
    dispose(h);
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
    dispose(h);
}

console.log("diagnose_post_trial_skill_owner_policy: OK");
