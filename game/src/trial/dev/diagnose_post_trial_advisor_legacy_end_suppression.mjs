import assert from "node:assert/strict";
import { AdvisorEventBridge } from "../../ui/advisor/advisor_event_bridge.js";
import { ADVISOR_EVENTS } from "../../ui/advisor/advisor_dialogue_database.js";

const emitted = [];
const dialogueSystem = {
    emit(event) {
        emitted.push(event);
        return true;
    },
    emitPresentation() {
        return true;
    },
    emitResolved() {
        return true;
    },
    emitTopic() {
        return true;
    }
};

const bridge = new AdvisorEventBridge(dialogueSystem, null, {
    profile: { policy: {}, reactions: {} },
    enabledProvider: () => true
});

bridge.observeSnapshot({
    turn: 15,
    trialActive: true,
    state: {},
    zoneCount: 0,
    linkCount: 0,
    postTrialInterludeActive: false
});
emitted.length = 0;

bridge.observeSnapshot({
    turn: 15,
    trialActive: false,
    state: {},
    zoneCount: 0,
    linkCount: 0,
    postTrialInterludeActive: true
});
assert.equal(
    emitted.includes(ADVISOR_EVENTS.TRIAL_END),
    false,
    "Legacy TRIAL_END must be suppressed while the Post-Trial interlude owns aftermath presentation"
);

bridge.previous = {
    turn: 15,
    trialActive: true,
    state: {},
    zoneCount: 0,
    linkCount: 0,
    postTrialInterludeActive: false
};
emitted.length = 0;
bridge.observeSnapshot({
    turn: 15,
    trialActive: false,
    state: {},
    zoneCount: 0,
    linkCount: 0,
    postTrialInterludeActive: false
});
assert.equal(
    emitted.includes(ADVISOR_EVENTS.TRIAL_END),
    true,
    "Legacy TRIAL_END remains available when no Post-Trial interlude is active"
);

bridge.destroy();
console.log("diagnose_post_trial_advisor_legacy_end_suppression: OK");
