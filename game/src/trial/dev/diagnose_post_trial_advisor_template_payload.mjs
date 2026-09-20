import assert from "node:assert/strict";
import { formatAdvisorDialogueTemplate } from "../../ui/advisor/advisor_dialogue_template.js";
import { AdvisorDialogueSystem } from "../../ui/advisor/advisor_dialogue_system.js";

const publicPayload = {
    result: {
        totalEmberDamage: 2,
        emberRemaining: 11
    },
    stageAdvance: {
        payload: {
            toStageId: 2,
            size: 7
        }
    }
};

assert.equal(
    formatAdvisorDialogueTemplate(
        "残火への損害は{result.totalEmberDamage}。残り{result.emberRemaining}。",
        publicPayload
    ),
    "残火への損害は2。残り11。"
);
assert.equal(
    formatAdvisorDialogueTemplate(
        "次はStage {stageAdvance.payload.toStageId}。",
        publicPayload
    ),
    "次はStage 2。"
);
assert.equal(
    formatAdvisorDialogueTemplate(
        "未確認:{knownEnemyState.hiddenRoute}",
        publicPayload
    ),
    "未確認:{knownEnemyState.hiddenRoute}",
    "missing/hidden values must not be invented during presentation"
);

const shown = [];
const system = new AdvisorDialogueSystem({
    profile: {
        dutyDialogue: {
            POST_TRIAL_ASSESSMENT: {
                localizedSegments: {
                    ja: ["確認が終わりました。残火への損害は{result.totalEmberDamage}。"]
                }
            }
        }
    },
    getLanguage: () => "ja",
    setTimer: () => 1,
    clearTimer: () => {}
});
system.subscribe(item => {
    if (item) shown.push(item);
});
assert.equal(
    system.emitDutyScene("POST_TRIAL_ASSESSMENT", publicPayload),
    true
);
assert.equal(
    shown.at(-1).text,
    "確認が終わりました。残火への損害は2。"
);
system.destroy();

console.log("diagnose_post_trial_advisor_template_payload: OK");
