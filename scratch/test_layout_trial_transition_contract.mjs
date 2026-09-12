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

console.log("Layout Trial transition contract: PASS");
