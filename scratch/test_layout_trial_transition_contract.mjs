import assert from "node:assert/strict";
import fs from "node:fs";

import {
    LayoutStateManager,
    UI_LAYOUT_STATES,
    RIGHT_CONTEXT_OWNERS,
    HAND_LAYOUT_STATES,
    PLAYER_TRAY_MODES
} from "../game/src/ui/layout_state_manager.js";
import {
    BoardPresentationState,
    BOARD_CONTEXT_MODES
} from "../game/src/presentation/board_presentation_state.js";

function makeDocumentRef() {
    return {
        documentElement: { dataset: {} },
        body: { dataset: {} }
    };
}

const documentRef = makeDocumentRef();
const layout = new LayoutStateManager({ documentRef });
const presentation = new BoardPresentationState({
    contextMode: BOARD_CONTEXT_MODES.TRIAL
});
layout.bindBoardPresentationState(presentation);

assert.equal(layout.getState(), UI_LAYOUT_STATES.NORMAL);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.NORMAL);
assert.equal(documentRef.body.dataset.layoutState, UI_LAYOUT_STATES.NORMAL);
assert.equal(documentRef.body.dataset.boardContext, "trial");

layout.enterTrial();
assert.equal(layout.getState(), UI_LAYOUT_STATES.TRIAL);
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.TRIAL);
assert.equal(layout.getHandState(), HAND_LAYOUT_STATES.TRIAL_COLLAPSED);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.TRIAL);
assert.equal(documentRef.body.dataset.boardContext, "trial");

layout.openAdvisor();
assert.equal(layout.getState(), UI_LAYOUT_STATES.ADVISOR_EXPANDED);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.TRIAL);
assert.equal(layout.getHandState(), HAND_LAYOUT_STATES.TRIAL_COLLAPSED);
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.NONE);

layout.claimAdvisorContext();
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.ADVISOR);
layout.closeAdvisor();
assert.equal(layout.getState(), UI_LAYOUT_STATES.TRIAL);
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.TRIAL);

presentation.setContextMode(BOARD_CONTEXT_MODES.NORMAL);
layout.applyContract();
assert.equal(layout.getState(), UI_LAYOUT_STATES.TRIAL);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.TRIAL);
assert.equal(documentRef.body.dataset.boardContext, "normal");

layout.exitTrial();
assert.equal(layout.getState(), UI_LAYOUT_STATES.NORMAL);
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.NONE);
assert.equal(layout.getHandState(), HAND_LAYOUT_STATES.COLLAPSED);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.NORMAL);
assert.equal(documentRef.body.dataset.boardContext, "normal");

// Restore resets only screen-space layout. Board presentation is restored by
// its own subsystem and must not be rewritten as a side effect here.
presentation.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
layout.enterTrial();
layout.prepareRestoreView();
assert.equal(layout.getState(), UI_LAYOUT_STATES.NORMAL);
assert.equal(layout.getContextOwner(), RIGHT_CONTEXT_OWNERS.NONE);
assert.equal(layout.getPlayerTrayMode(), PLAYER_TRAY_MODES.NORMAL);
assert.equal(presentation.contextMode, BOARD_CONTEXT_MODES.TRIAL);
assert.equal(documentRef.body.dataset.boardContext, "trial");

const uiControllerSource = fs.readFileSync(
    new URL("../game/src/ui/ui_controller.js", import.meta.url),
    "utf8"
);
assert.ok(
    uiControllerSource.includes("this.layoutStateManager.enterTrial();"),
    "Trial start must enter LayoutState.TRIAL explicitly"
);
assert.ok(
    uiControllerSource.includes("this.layoutStateManager.exitTrial();"),
    "Trial stop must restore normal Layout state explicitly"
);

const trialActionTraySource = fs.readFileSync(
    new URL("../game/src/ui/trial_action_tray_component.js", import.meta.url),
    "utf8"
);
assert.ok(
    trialActionTraySource.includes("PLAYER_TRAY_MODES.TRIAL"),
    "Trial Action Tray visibility must consume the canonical Layout tray mode token"
);
assert.ok(
    !trialActionTraySource.includes("BOARD_CONTEXT_MODES")
        && !trialActionTraySource.includes("data-board-context"),
    "Trial Action Tray visibility must not depend on Board Presentation context"
);

const rightContextSource = fs.readFileSync(
    new URL("../game/src/ui/trial_defense_allocation_component.js", import.meta.url),
    "utf8"
);
assert.ok(
    rightContextSource.includes("contextOwnerProvider")
        && rightContextSource.includes("RIGHT_CONTEXT_OWNERS.TRIAL")
        && rightContextSource.includes("RIGHT_CONTEXT_OWNERS.NONE"),
    "Trial Right Context visibility must consume canonical Layout context owner tokens"
);
assert.ok(
    !rightContextSource.includes('this.contextOwnerProvider() === "trial"')
        && !rightContextSource.includes('active ? "trial" : "none"'),
    "Trial Right Context must not duplicate Layout context owner string literals"
);

console.log("Layout Trial transition contract: PASS");
