import { releaseSettledTrialPreviewSession } from "./settled_trial_preview_release.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

let boundaryEndCount = 0;
let destructiveStopCount = 0;

const harness = {
    session: {
        definition: { id: "SETTLED_TRIAL" },
        displayGrid: [[{ placed: true }]]
    },
    ui: {
        stopTrialInterceptionPreview() {
            destructiveStopCount += 1;
        }
    },
    trialRestoreBoundaryService: {
        end() {
            boundaryEndCount += 1;
            return { active: true, startVerse: 15 };
        }
    }
};

const released = releaseSettledTrialPreviewSession(harness);
assert(released.released === true, "settled session must report release");
assert(harness.session === null, "settled release must remove temporary preview session");
assert(boundaryEndCount === 1, "settled release must close restore boundary");
assert(destructiveStopCount === 0, "settled release must not call destructive stop");

const releasedAgain = releaseSettledTrialPreviewSession(harness);
assert(releasedAgain.released === false, "second release must be non-destructive");
assert(destructiveStopCount === 0, "repeat release must preserve TrialState");

console.log("PASS: settled Trial releases preview shell without clearing result state");
