import assert from "node:assert/strict";
import { PostTrialProgressionService } from "../systems/post_trial_progression_service.js";

const activePresentationState = {
    postTrialTransition: {
        status: "COMPLETED",
        presentation: { status: "ACTIVE" }
    }
};
const service = Object.create(PostTrialProgressionService.prototype);
service.engine = { state: activePresentationState };
assert.equal(service.hasPendingWork(), true);
assert.equal(service.canResumeNormalProgression(), false);

activePresentationState.postTrialTransition.presentation.status = "COMPLETED";
assert.equal(service.hasPendingWork(), false);
assert.equal(service.canResumeNormalProgression(), true);

console.log("diagnose_post_trial_presentation_progression_gate: OK");
