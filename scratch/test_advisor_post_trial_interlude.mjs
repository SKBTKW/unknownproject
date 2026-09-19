import assert from "node:assert/strict";
import { GameFactHub } from "../game/src/core/game_fact.js";
import { ADVISOR_SCENES } from "../game/src/data/advisor_scene_catalog.js";
import {
    ADVISOR_DIALOGUE_CHANNELS,
    getAdvisorSceneResponsibility
} from "../game/src/data/advisor_dialogue_responsibility.js";
import {
    ADVISOR_POST_TRIAL_SCENE_SEQUENCE,
    getAdvisorPostTrialSceneContract
} from "../game/src/data/advisor_post_trial_scene_contract.js";
import { AdvisorReactionService } from "../game/src/services/advisor_reaction_service.js";
import {
    ADVISOR_EVENTS,
    findAdvisorDialogue
} from "../game/src/ui/advisor/advisor_dialogue_database.js";
import { resolveAdvisorSemanticScene } from "../game/src/ui/advisor/advisor_semantic_scene_consumer.js";

console.log("=== Advisor Post-Trial interlude contract ===");

assert.deepEqual(ADVISOR_POST_TRIAL_SCENE_SEQUENCE, [
    ADVISOR_SCENES.ASSESSMENT,
    ADVISOR_SCENES.TRIAL_MEANING,
    ADVISOR_SCENES.STAGE_PRELUDE,
    ADVISOR_SCENES.POST_STAGE_COMMENT
]);
assert.equal(getAdvisorSceneResponsibility(ADVISOR_SCENES.ASSESSMENT)?.channel, ADVISOR_DIALOGUE_CHANNELS.DUTY);
assert.equal(getAdvisorSceneResponsibility(ADVISOR_SCENES.TRIAL_MEANING)?.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);
assert.equal(getAdvisorSceneResponsibility(ADVISOR_SCENES.STAGE_PRELUDE)?.channel, ADVISOR_DIALOGUE_CHANNELS.DUTY);
assert.equal(getAdvisorSceneResponsibility(ADVISOR_SCENES.POST_STAGE_COMMENT)?.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);
assert.equal(getAdvisorSceneResponsibility(ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED)?.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);

const meaningContract = getAdvisorPostTrialSceneContract(ADVISOR_SCENES.TRIAL_MEANING);
assert.equal(meaningContract.interpretationAllowed, true);
assert.equal(meaningContract.enemyIntentInferenceAllowed, false);
assert.equal(meaningContract.hiddenTruthAllowed, false);
assert.equal(meaningContract.futureTrialInferenceAllowed, false);

const aftermath = Object.freeze({ result: { totalEmberDamage: 2 } });
const knownEnemySnapshot = Object.freeze({ equipment: "HEAVY" });
const meaningScene = resolveAdvisorSemanticScene({
    sceneId: ADVISOR_SCENES.TRIAL_MEANING,
    verse: 15,
    context: {
        trialIndex: 1,
        aftermath,
        knownEnemySnapshot,
        trueEnemyState: { route: "SECRET" },
        enemyIntent: "HQ",
        nextTrialVerse: 30
    }
});
assert.equal(meaningScene.channel, ADVISOR_DIALOGUE_CHANNELS.REACTION);
assert.deepEqual(Object.keys(meaningScene.context).sort(), ["aftermath", "knownEnemySnapshot", "trialIndex"]);

const dutyProfile = {
    personality: "stern",
    dutyDialogue: {
        [ADVISOR_EVENTS.ASSESSMENT]: { marker: "DUTY", priority: 90, cooldownMs: 0, durationMs: 1000, lineKeys: ["DUTY"] }
    },
    adviceDialogue: {
        [ADVISOR_EVENTS.ASSESSMENT]: { marker: "ADVICE", priority: 1, cooldownMs: 0, durationMs: 1000, lineKeys: ["ADVICE"] }
    }
};
assert.equal(findAdvisorDialogue(ADVISOR_EVENTS.ASSESSMENT, dutyProfile, [])?.marker, "DUTY");

const factHub = new GameFactHub();
const character = {
    id: "TEST",
    reactions: {
        [ADVISOR_SCENES.TRIAL_MEANING]: { expression: "ATTENTIVE", lines: ["known aftermath only"] }
    }
};
const reactionService = new AdvisorReactionService({ gameFactHub: factHub, character });
const reaction = reactionService.consumeScene(ADVISOR_SCENES.TRIAL_MEANING, meaningScene.context);
assert.equal(reaction?.line, "known aftermath only");
assert.equal(reaction?.payload?.trueEnemyState, undefined);
reactionService.dispose();

console.log("Advisor Post-Trial interlude contract: PASS");
