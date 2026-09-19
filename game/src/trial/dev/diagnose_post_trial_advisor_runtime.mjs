import assert from "node:assert/strict";
import { AdvisorDialogueSystem } from "../../ui/advisor/advisor_dialogue_system.js";
import { AdvisorPostTrialScenePresenter } from "../../ui/advisor/advisor_post_trial_scene_presenter.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../presentation/post_trial_interlude_scene_contract.js";
import { ADVISOR_SCENES, ADVISOR_EXPRESSIONS } from "../../data/advisor_scene_catalog.js";

const emitted = [];
const dialogueSystem = new AdvisorDialogueSystem({
    profile: {
        dutyDialogue: {
            [ADVISOR_SCENES.POST_TRIAL_ASSESSMENT]: {
                localizedSegments: {
                    en: ["Assessment complete."]
                }
            },
            [ADVISOR_SCENES.POST_TRIAL_STAGE_PRELUDE]: {
                localizedSegments: {
                    en: ["Stage transition authorized."]
                }
            }
        }
    },
    getLanguage: () => "en",
    setTimer: () => 1,
    clearTimer: () => {}
});
dialogueSystem.subscribe(item => {
    if (item) emitted.push(item);
});

const profile = {
    dutyDialogue: dialogueSystem.profile.dutyDialogue,
    reactions: {
        [ADVISOR_SCENES.POST_TRIAL_MEANING]: {
            expression: ADVISOR_EXPRESSIONS.ATTENTIVE,
            lines: ["This changes how I read the battle."]
        },
        [ADVISOR_SCENES.POST_TRIAL_POST_STAGE_COMMENT]: {
            expression: ADVISOR_EXPRESSIONS.CONCERNED,
            lines: ["The front is wider now."]
        }
    }
};

const presenter = new AdvisorPostTrialScenePresenter({
    dialogueSystem,
    profile,
    enabledProvider: () => true
});

let result = presenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    payload: { result: { totalEmberDamage: 2 } }
});
assert.equal(result.success, true);
assert.equal(result.spoken, true);
assert.equal(result.scene, ADVISOR_SCENES.POST_TRIAL_ASSESSMENT);
assert.equal(emitted.at(-1).text, "Assessment complete.");

dialogueSystem.dismiss();
result = presenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    payload: { knownEnemyState: { equipment: "HEAVY" } }
});
assert.equal(result.spoken, true);
assert.equal(emitted.at(-1).text, "This changes how I read the battle.");

dialogueSystem.dismiss();
result = presenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.STAGE_PRELUDE,
    payload: { stageAdvance: { payload: { toStageId: 2 } } }
});
assert.equal(result.spoken, true);
assert.equal(emitted.at(-1).text, "Stage transition authorized.");

dialogueSystem.dismiss();
result = presenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.POST_STAGE_COMMENT,
    payload: { postStagePublicState: { stageId: 2 } }
});
assert.equal(result.spoken, true);
assert.equal(emitted.at(-1).text, "The front is wider now.");

const silentPresenter = new AdvisorPostTrialScenePresenter({
    dialogueSystem,
    profile,
    enabledProvider: () => false
});
result = silentPresenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.ASSESSMENT,
    payload: {}
});
assert.equal(result.success, true);
assert.equal(result.spoken, false);
assert.equal(result.reason, "ADVISOR_DISABLED");

const noDataPresenter = new AdvisorPostTrialScenePresenter({
    dialogueSystem,
    profile: { dutyDialogue: {}, reactions: {} }
});
result = noDataPresenter.present({
    sceneId: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    payload: {}
});
assert.equal(result.success, true);
assert.equal(result.spoken, false);
assert.equal(result.reason, "ADVISOR_REACTION_SILENT");

console.log("diagnose_post_trial_advisor_runtime: OK");
