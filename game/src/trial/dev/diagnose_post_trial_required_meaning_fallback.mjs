import assert from "node:assert/strict";
import { PostTrialInterludeComponent } from "../../ui/post_trial_interlude_component.js";
import { POST_TRIAL_INTERLUDE_SCENES } from "../presentation/post_trial_interlude_scene_contract.js";

function createComponent({ advisorEnabled }) {
    return new PostTrialInterludeComponent({
        progressService: {},
        readService: { read() { return {}; } },
        advisorEnabledProvider: () => advisorEnabled,
        translate: (_key, _params, fallback) => fallback,
        documentRef: null
    });
}

const requiredMeaning = {
    id: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    required: true,
    semanticSceneId: "FIRST_TRIAL_AFTERMATH_MEANING"
};

let component = createComponent({ advisorEnabled: true });
assert.equal(
    component.sceneStatus(requiredMeaning, null, { success: true, spoken: false }),
    "Beyond humanity's sphere lies a force capable of coming into conflict with it. That much is now clear.",
    "mandatory first-Trial meaning must fall back when an enabled Advisor has no authored line"
);
assert.equal(
    component.sceneStatus(requiredMeaning, null, { success: true, spoken: true }),
    "",
    "system fallback must not duplicate a spoken Advisor meaning"
);

component = createComponent({ advisorEnabled: false });
assert.equal(
    component.sceneStatus(requiredMeaning, null, { success: true, spoken: false }),
    "Beyond humanity's sphere lies a force capable of coming into conflict with it. That much is now clear.",
    "mandatory first-Trial meaning must survive Advisor OFF"
);

const ordinaryMeaning = {
    id: POST_TRIAL_INTERLUDE_SCENES.TRIAL_MEANING,
    required: false,
    semanticSceneId: null
};
assert.equal(
    component.sceneStatus(ordinaryMeaning, null, { success: true, spoken: false }),
    "The confirmed battle record and known information have been organized.",
    "Advisor OFF keeps a neutral non-required meaning status"
);

console.log("diagnose_post_trial_required_meaning_fallback: OK");
