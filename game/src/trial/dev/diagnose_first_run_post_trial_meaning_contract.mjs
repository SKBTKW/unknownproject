import assert from "node:assert/strict";
import {
    FirstRunService,
    FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES
} from "../../tutorial/first_run_service.js";
import {
    POST_TRIAL_INTERLUDE_SCENES,
    buildPostTrialInterludeSceneSequence
} from "../presentation/post_trial_interlude_scene_contract.js";
import { createPostTrialAdvisorSemanticPayload } from "../presentation/post_trial_advisor_semantic_provider.js";

const firstRun = new FirstRunService({ enabled: true });
const readModel = {
    available: true,
    trialIndex: 1,
    scenarioId: "first-run-trial-1",
    runTerminated: false,
    stepTypes: ["STAGE_ADVANCE"],
    pendingStepTypes: ["STAGE_ADVANCE"],
    aftermath: {
        trialIndex: 1,
        turn: 15,
        outcome: "SURVIVED",
        result: { emberRemaining: 12, totalEmberDamage: 2 },
        settlement: { settled: true, runTerminated: false }
    },
    stageAdvance: {
        status: "PENDING",
        payload: { fromStageId: 1, toStageId: 2, size: 7 }
    }
};

const policy = firstRun.getPostTrialInterludePolicy({ readModel });
const scenes = buildPostTrialInterludeSceneSequence(readModel, {
    firstRunPolicy: policy
});
const meaning = scenes.find(scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING);
assert.ok(meaning);
assert.equal(meaning.required, true);
assert.equal(meaning.systemFallbackRequired, true);
assert.equal(meaning.occurrenceOwner, "FIRST_RUN");
assert.equal(
    meaning.semanticSceneId,
    FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES.FIRST_TRIAL_AFTERMATH_MEANING
);
assert.equal(
    meaning.dedupeKey,
    FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES.FIRST_TRIAL_AFTERMATH_MEANING
);

const payload = createPostTrialAdvisorSemanticPayload({
    sceneId: meaning.id,
    readModel,
    semanticSceneId: meaning.semanticSceneId,
    occurrenceOwner: meaning.occurrenceOwner,
    dedupeKey: meaning.dedupeKey,
    required: meaning.required
});
assert.equal(payload.required, true);
assert.equal(payload.occurrenceOwner, "FIRST_RUN");
assert.equal(
    payload.semanticSceneId,
    FIRST_RUN_POST_TRIAL_SEMANTIC_SCENES.FIRST_TRIAL_AFTERMATH_MEANING
);

const ordinaryScenes = buildPostTrialInterludeSceneSequence(readModel);
const ordinaryMeaning = ordinaryScenes.find(
    scene => scene.id === POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING
);
assert.equal(ordinaryMeaning.required, false);
assert.equal(ordinaryMeaning.semanticSceneId, null);

console.log("diagnose_first_run_post_trial_meaning_contract: OK");
