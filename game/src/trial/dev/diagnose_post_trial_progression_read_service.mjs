import assert from "node:assert/strict";
import { PostTrialProgressionReadService } from "../presentation/post_trial_progression_read_service.js";
import {
    POST_TRIAL_INTERLUDE_SCENES,
    POST_TRIAL_MEANING_VARIANTS,
    buildPostTrialInterludeSceneSequence
} from "../presentation/post_trial_interlude_scene_contract.js";
import { createPostTrialAdvisorSemanticPayload } from "../presentation/post_trial_advisor_semantic_provider.js";
import { resolveAdvisorPostTrialScene } from "../../ui/advisor/advisor_post_trial_scene_adapter.js";
import { ADVISOR_SCENES } from "../../data/advisor_scene_catalog.js";
import {
    ADVISOR_DIALOGUE_CHANNELS,
    getAdvisorSceneResponsibility
} from "../../data/advisor_dialogue_responsibility.js";

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

const state = { transition: null };
const source = {
    getTransition() {
        return clone(state.transition);
    },
    getCurrentPendingStep() {
        return clone(state.transition?.steps?.find(step => step.status === "PENDING") || null);
    },
    getPendingSteps() {
        return clone(state.transition?.steps?.filter(step => step.status === "PENDING") || []);
    },
    canResumeNormalProgression() {
        return !state.transition || state.transition.status === "COMPLETED";
    }
};
const readService = new PostTrialProgressionReadService(source);

assert.deepEqual(readService.read(), {
    available: false,
    transitionId: null,
    trialIndex: null,
    scenarioId: null,
    status: null,
    presentationCleanupComplete: false,
    currentStep: null,
    pendingStepTypes: [],
    stepTypes: [],
    stageAdvance: null,
    aftermath: null,
    runTerminated: false,
    canResumeNormalProgression: true
});

state.transition = {
    schemaVersion: 5,
    transitionId: "POST_TRIAL_1_read-model",
    trialIndex: 1,
    scenarioId: "read-model",
    status: "PENDING_STEPS",
    presentationCleanupComplete: true,
    runTerminated: false,
    aftermath: {
        trialIndex: 1,
        scenarioId: "read-model",
        turn: 15,
        outcome: "SURVIVED",
        result: {
            completed: true,
            outcome: "SURVIVED",
            emberRemaining: 11,
            totalEmberDamage: 2,
            battleCount: 2,
            routeEndCount: 1
        },
        settlement: {
            settled: true,
            outcome: "SURVIVED",
            runTerminated: false
        }
    },
    steps: [
        {
            type: "REWARD_SELECTION",
            status: "APPLIED",
            payload: { choices: ["A", "B"] },
            result: { selected: "A" }
        },
        {
            type: "UNLOCK_APPLY",
            status: "PENDING",
            payload: { unlockId: "NEXT" }
        },
        {
            type: "STAGE_ADVANCE",
            status: "PENDING",
            payload: { fromStageId: 1, toStageId: 2, size: 7 }
        }
    ]
};

const projected = readService.read();
assert.equal(projected.available, true);
assert.equal(projected.transitionId, "POST_TRIAL_1_read-model");
assert.deepEqual(projected.pendingStepTypes, ["UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.deepEqual(projected.stepTypes, ["REWARD_SELECTION", "UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.deepEqual(projected.stageAdvance, {
    status: "PENDING",
    payload: { fromStageId: 1, toStageId: 2, size: 7 }
});
assert.equal(projected.currentStep.type, "UNLOCK_APPLY");
assert.equal(projected.aftermath.result.emberRemaining, 11);

projected.currentStep.payload.unlockId = "MUTATED";
projected.pendingStepTypes.push("MUTATED");
projected.stepTypes.push("MUTATED");
projected.stageAdvance.payload.toStageId = 99;
projected.aftermath.result.emberRemaining = 999;
const reread = readService.read();
assert.equal(reread.currentStep.payload.unlockId, "NEXT");
assert.deepEqual(reread.stepTypes, ["REWARD_SELECTION", "UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.equal(reread.stageAdvance.payload.toStageId, 2);
assert.equal(reread.aftermath.result.emberRemaining, 11);

const scenes = buildPostTrialInterludeSceneSequence(projected);
assert.deepEqual(scenes.map(scene => scene.id), [
    POST_TRIAL_INTERLUDE_SCENES.AFTERMATH,
    POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    POST_TRIAL_INTERLUDE_SCENES.REWARD,
    POST_TRIAL_INTERLUDE_SCENES.UNLOCK,
    POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE,
    POST_TRIAL_INTERLUDE_SCENES.STAGE_REVEAL,
    POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    POST_TRIAL_INTERLUDE_SCENES.CLOSE
]);
assert.equal(
    scenes.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING)?.meaningVariant,
    POST_TRIAL_MEANING_VARIANTS.FIRST
);
assert.equal(
    scenes.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE)?.opensStageProgressionGate,
    true
);
assert.equal(
    scenes.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT)?.systemFallbackRequired,
    true
);

const finalScenes = buildPostTrialInterludeSceneSequence({
    available: true,
    trialIndex: 3,
    runTerminated: false,
    stepTypes: ["SKILL_PROGRESSION", "FINAL_RUN_COMPLETION"]
});
assert.deepEqual(finalScenes.map(scene => scene.id), [
    POST_TRIAL_INTERLUDE_SCENES.AFTERMATH,
    POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    POST_TRIAL_INTERLUDE_SCENES.SKILL,
    POST_TRIAL_INTERLUDE_SCENES.FINAL_RUN_COMPLETION,
    POST_TRIAL_INTERLUDE_SCENES.CLOSE
]);
assert.equal(finalScenes[2].meaningVariant, POST_TRIAL_MEANING_VARIANTS.FINAL);

const meaningPayload = createPostTrialAdvisorSemanticPayload({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    readModel: projected,
    knownEnemyState: {
        equipment: "HEAVY",
        observedDirection: "NORTH",
        trueEnemyState: { secret: true },
        hiddenRoute: "SECRET"
    },
    publicFacts: [{
        type: "PUBLIC_FACT",
        payload: {
            confirmed: true,
            trialSchedule: { trial2: 30 },
            internalRng: 0.25
        }
    }]
});
assert.equal(meaningPayload.result.totalEmberDamage, 2);
assert.equal(meaningPayload.knownEnemyState.equipment, "HEAVY");
assert.equal("trueEnemyState" in meaningPayload.knownEnemyState, false);
assert.equal("hiddenRoute" in meaningPayload.knownEnemyState, false);
assert.equal("trialSchedule" in meaningPayload.publicFacts[0].payload, false);
assert.equal("internalRng" in meaningPayload.publicFacts[0].payload, false);

const assessmentPayload = createPostTrialAdvisorSemanticPayload({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    readModel: projected,
    knownEnemyState: { equipment: "HEAVY" }
});
assert.equal("knownEnemyState" in assessmentPayload, false);

const assessmentRoute = resolveAdvisorPostTrialScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    payload: assessmentPayload
});
const meaningRoute = resolveAdvisorPostTrialScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    payload: meaningPayload
});
const preludeRoute = resolveAdvisorPostTrialScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE,
    payload: {}
});
const postStageRoute = resolveAdvisorPostTrialScene({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    payload: {}
});

assert.equal(assessmentRoute.advisorScene, ADVISOR_SCENES.POST_TRIAL_ASSESSMENT);
assert.equal(assessmentRoute.channel, ADVISOR_DIALOGUE_CHANNELS.DUTY);
assert.equal(meaningRoute.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);
assert.equal(preludeRoute.channel, ADVISOR_DIALOGUE_CHANNELS.DUTY);
assert.equal(postStageRoute.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);
assert.equal(
    getAdvisorSceneResponsibility(ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED).channel,
    ADVISOR_DIALOGUE_CHANNELS.REACTION
);

state.transition.steps[1].status = "APPLIED";
const afterUnlock = readService.read();
assert.equal(afterUnlock.currentStep.type, "STAGE_ADVANCE");
assert.deepEqual(afterUnlock.stepTypes, ["REWARD_SELECTION", "UNLOCK_APPLY", "STAGE_ADVANCE"]);

state.transition.steps[2].status = "APPLIED";
state.transition.status = "COMPLETED";
const completed = readService.read();
assert.equal(completed.currentStep, null);
assert.deepEqual(completed.pendingStepTypes, []);
assert.deepEqual(completed.stepTypes, ["REWARD_SELECTION", "UNLOCK_APPLY", "STAGE_ADVANCE"]);
assert.equal(completed.canResumeNormalProgression, true);

console.log("diagnose_post_trial_progression_read_service: OK");
