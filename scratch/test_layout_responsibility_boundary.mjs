import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const layoutSource = read("../game/src/ui/layout_state_manager.js");
const runtimeBridgeSource = read("../game/src/ui/board_presentation_runtime_bridge.js");
const routeBridgeSource = read("../game/src/ui/trial_route_board_selection_bridge.js");
const trayViewCss = read("../game/css/3_bottom_area/player_tray_view_mode.css");
const trialTrayCss = read("../game/css/3_bottom_area/trial_action_tray.css");
const indexHtml = read("../game/index.html");

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nLayout responsibility boundary tests");

check(!layoutSource.includes("BoardPresentationDataService")
    && !layoutSource.includes("BoardPresentationProfile"),
"LayoutStateManager does not depend on Board Presentation services/profiles");

check(layoutSource.includes("bindBoardPresentationState")
    && !layoutSource.includes("this.boardViewMode =")
    && !layoutSource.includes("this.boardContextMode ="),
"LayoutStateManager consumes canonical BoardPresentationState instead of owning duplicate board axes");

check(layoutSource.includes("toBoardViewDataset")
    && layoutSource.includes("toBoardContextDataset"),
"LayoutStateManager only maps semantic board modes into DOM layout attributes");

check(!layoutSource.includes("this.boardContextMode = BOARD_CONTEXT_MODES.TRIAL")
    && !layoutSource.includes("this.boardContextMode = BOARD_CONTEXT_MODES.NORMAL"),
"Entering or exiting Layout Trial state no longer mutates Board Presentation context");

check(runtimeBridgeSource.includes("new BoardPresentationState()")
    && runtimeBridgeSource.includes("bindBoardPresentationState"),
"Browser runtime attaches the renderer-neutral BoardPresentationState to Layout as an input");

check(runtimeBridgeSource.includes("state.setContextMode(BOARD_CONTEXT_MODES.TRIAL)")
    && runtimeBridgeSource.includes("state.setContextMode(BOARD_CONTEXT_MODES.NORMAL)"),
"Actual Trial lifecycle changes Board Presentation context outside LayoutStateManager");

check(routeBridgeSource.includes('uiController.boardPresentationState?.contextMode === "TRIAL"')
    && !routeBridgeSource.includes("getBoardContextMode?.()"),
"Trial route presentation reads canonical BoardPresentationState rather than Layout semantic state");

check(indexHtml.indexOf("attachBoardPresentationRuntime(ui)")
    < indexHtml.indexOf("attachTrialActionTray(ui)"),
"Board Presentation runtime is attached before Trial board UI bridges consume it");

check(trayViewCss.includes('body[data-board-view="top"] #layerPlayerTray.layer-player-tray')
    && trayViewCss.includes('body[data-board-view="quarter"] #layerPlayerTray.layer-player-tray'),
"Player Tray geometry consumes board-view only as a layout input");

check(!trayViewCss.includes("data-board-context"),
"Player Tray screen-space geometry does not depend on NORMAL/TRIAL board semantics");

check(trialTrayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost')
    && !trialTrayCss.includes("data-board-context"),
"Trial Action Tray visibility follows layout-owned Player Tray mode, not board context mode");

check(layoutSource.includes("getPlayerTrayMode()")
    && layoutSource.includes("UI_LAYOUT_STATES.TRIAL"),
"Player Tray content mode remains derived from actual layout Trial state");

console.log(`Layout responsibility boundary: ${passed}/${passed} PASS`);
