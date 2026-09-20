import assert from "node:assert/strict";
import { POST_TRIAL_INTERLUDE_SCENES } from "../game/src/trial/presentation/post_trial_interlude_scene_contract.js";
import { createPostTrialAdvisorSemanticPayload } from "../game/src/trial/presentation/post_trial_advisor_semantic_provider.js";

const readModel = {
    available: true,
    transitionId: "transition-1",
    trialIndex: 1,
    scenarioId: "scenario-1",
    aftermath: {
        turn: 15,
        outcome: "SURVIVED",
        result: {
            emberRemaining: 12,
            enemyIntent: "HQ",
            nested: {
                enemyObjective: "BREAKTHROUGH",
                safeObservation: "HEAVY_EQUIPMENT"
            }
        },
        settlement: {
            survived: true,
            enemyTarget: "HQ",
            nextTrialVerse: 30
        }
    },
    stageAdvance: {
        payload: {
            fromStageId: 1,
            toStageId: 2,
            trueEnemyState: { route: "SECRET" }
        }
    }
};

const meaning = createPostTrialAdvisorSemanticPayload({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    readModel,
    publicFacts: [{
        observation: "large force",
        enemyIntent: "HQ",
        hiddenRoute: "A1"
    }],
    knownEnemyState: {
        equipment: "HEAVY",
        inferred: {
            enemyIntent: "HQ",
            enemyObjective: "DESTROY_HQ"
        },
        nextTrialTurn: 30,
        trueEnemyState: { route: "SECRET" }
    }
});

assert.equal(meaning.result.emberRemaining, 12);
assert.equal(meaning.result.enemyIntent, undefined);
assert.equal(meaning.result.nested.enemyObjective, undefined);
assert.equal(meaning.result.nested.safeObservation, "HEAVY_EQUIPMENT");
assert.equal(meaning.settlement.enemyTarget, undefined);
assert.equal(meaning.settlement.nextTrialVerse, undefined);
assert.equal(meaning.stageAdvance.payload.trueEnemyState, undefined);
assert.equal(meaning.publicFacts[0].observation, "large force");
assert.equal(meaning.publicFacts[0].enemyIntent, undefined);
assert.equal(meaning.publicFacts[0].hiddenRoute, undefined);
assert.equal(meaning.knownEnemyState.equipment, "HEAVY");
assert.equal(meaning.knownEnemyState.inferred.enemyIntent, undefined);
assert.equal(meaning.knownEnemyState.inferred.enemyObjective, undefined);
assert.equal(meaning.knownEnemyState.nextTrialTurn, undefined);
assert.equal(meaning.knownEnemyState.trueEnemyState, undefined);

const assessment = createPostTrialAdvisorSemanticPayload({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    readModel,
    knownEnemyState: { equipment: "HEAVY" }
});
assert.equal(assessment.knownEnemyState, undefined, "KnownEnemyState is meaning-scene-only");

const postStage = createPostTrialAdvisorSemanticPayload({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    readModel,
    postStagePublicState: {
        stage: { id: 2 },
        boardSize: 7,
        enemyIntent: "HQ"
    }
});
assert.equal(postStage.postStagePublicState.stage.id, 2);
assert.equal(postStage.postStagePublicState.boardSize, 7);
assert.equal(postStage.postStagePublicState.enemyIntent, undefined);

console.log("Post-Trial Advisor meaning boundary: PASS");
