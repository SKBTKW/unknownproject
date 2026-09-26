import assert from "node:assert/strict";
import fs from "node:fs";
import {
    BOARD_VIEW_MODES,
    HAND_LAYOUT_STATES,
    LayoutStateManager,
    PLAYER_TRAY_MODES,
    RIGHT_CONTEXT_OWNERS,
    UI_LAYOUT_STATES
} from "../game/src/ui/layout_state_manager.js";
import { BoardPresentationState } from "../game/src/presentation/board_presentation_state.js";
import { TrialPresentationState } from "../game/src/trial/presentation/trial_presentation_state.js";

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const uiSource = read("../game/src/ui/ui_controller.js");
const layoutSource = read("../game/src/ui/layout_state_manager.js");
const routeSelectionBridgeSource = read("../game/src/ui/trial_route_board_selection_bridge.js");
const actionTraySource = read("../game/src/ui/trial_action_tray_component.js");
const boardSource = read("../game/src/ui/board_grid_component.js");
const boardCss = read("../game/css/2_center_area/land_grid.css");
const trayCss = read("../game/css/3_bottom_area/trial_action_tray.css");
const trayViewCss = read("../game/css/3_bottom_area/player_tray_view_mode.css");
const indexHtml = read("../game/index.html");

const root = { dataset: {} };
const body = { dataset: {} };
const visibility = [];
const trayModes = [];
const boardViewModes = [];
const camera = { zoom: 1.35, panX: 44, panY: -18, selectedCell: "3:2" };
const manager = new LayoutStateManager({ documentRef: { documentElement: root, body } });
const boardPresentationState = new BoardPresentationState({
    selectedCell: { r: 2, c: 3 },
    hoveredCell: { r: 1, c: 2 },
    focusCell: { r: 3, c: 1 }
});
const trialPresentationState = new TrialPresentationState();
trialPresentationState.selectInterceptCell({ r: 2, c: 2 });
trialPresentationState.setHoveredCell({ r: 2, c: 3 });
trialPresentationState.setPreviewDefenseAllocation(4, 8);
trialPresentationState.setActiveEnemyRoute("route-a");
manager.bindBoardPresentationState(boardPresentationState);
manager.setAdapters({
    setTrialContextVisible: visible => visibility.push(visible),
    setPlayerTrayMode: mode => trayModes.push(mode),
    setBoardViewMode: mode => boardViewModes.push(mode)
});

console.log("\nStage1 Trial UI final integration tests");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.STRATEGIC_2D, "Board view defaults to STRATEGIC_2D mode");
check(indexHtml.includes("player_tray_view_mode.css") && indexHtml.includes('id="trialActionTrayHost"'),
    "Player Tray host and canonical view positioning stylesheet are loaded");
check(trayViewCss.includes('body[data-board-view="top"] #layerPlayerTray.layer-player-tray')
    && trayViewCss.includes("left: var(--layout-player-tray-top-left)")
    && trayViewCss.includes("translateX(-50%)"),
"2D anchors Player Tray at bottom-center");
check(trayViewCss.includes('body[data-board-view="quarter"] #layerPlayerTray.layer-player-tray')
    && trayViewCss.includes("left: var(--layout-player-tray-quarter-left)")
    && trayViewCss.includes("translateX(0)"),
"2.5D anchors the same Player Tray at bottom-left");
check(!trayViewCss.includes('data-player-tray-mode="trial"][data-board-view="quarter"')
    && !trayViewCss.includes('data-board-view="quarter"][data-player-tray-mode="trial"'),
"Trial does not define a separate 2.5D Player Tray placement rule");

manager.enterTrial();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "Trial starts in TRIAL layout state");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE, "Trial mode does not own Right Context");
check(manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED, "Trial retains compatibility hand suppression");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL && trayModes.at(-1) === PLAYER_TRAY_MODES.TRIAL,
    "Trial switches the Player Tray content into TRIAL mode");
check(visibility.at(-1) === false, "legacy Trial Right Context stays hidden");
check(!uiSource.includes("TrialDefenseAllocationComponent")
    && !uiSource.includes("trialDefenseAllocationComponent")
    && uiSource.includes("TrialActionTrayComponent"),
"UIController no longer depends on the standalone right Trial panel");
check(actionTraySource.includes("btnTrialFinishPlanning")
    && actionTraySource.includes("btnTrialConfirmPlan")
    && actionTraySource.includes("btnTrialActivatePlan")
    && actionTraySource.includes("btnTrialStartBattle")
    && actionTraySource.includes("btnTrialResolveBattle")
    && actionTraySource.includes("btnTrialAdvanceEnemy")
    && actionTraySource.includes("btnTrialNextBattle")
    && actionTraySource.includes("btnTrialCompleteTrial"),
"Player Tray owns the major Trial operation/progression controls");
check(actionTraySource.includes("qualitativePreviewOnly")
    && actionTraySource.includes("UI_FIRST_RUN_TRIAL_FAVORABLE")
    && actionTraySource.includes("UI_FIRST_RUN_TRIAL_UNFAVORABLE"),
"FirstRun qualitative forecast remains a Presentation Policy on the normal Trial tray");
check(!trayCss.includes(".trial-defense-allocation-panel")
    && trayCss.includes(".trial-action-tray-progress"),
"Trial tray CSS has no legacy right-panel dependency");
check(uiSource.includes("getTrialRouteVisualState") && uiSource.includes("routeDirection:"),
"route visual state still publishes entry and direction metadata");
check(boardSource.includes('data-trial-direction') && boardSource.includes("trial-route-entry"),
"Board remains responsible for route direction and ingress markers");
check(boardCss.includes("pointer-events: none") && boardCss.includes(".cell.trial-route-cell::before"),
"Board route markers do not block interception input");
check(!layoutSource.includes("boardCameraSystem")
    && !layoutSource.includes("resetCamera(")
    && !layoutSource.includes("resetZoom("),
"Layout state transitions do not own or reset Board camera pan/zoom");
check(routeSelectionBridgeSource.includes("clearMarkers(boardEl);")
    && routeSelectionBridgeSource.includes('document.body?.classList.toggle("trial-route-selection-on-board", active)')
    && routeSelectionBridgeSource.indexOf("clearMarkers(boardEl);")
        < routeSelectionBridgeSource.indexOf("if (!active) return;"),
"Trial route selector sync clears stale markers and body state before inactive exit");

manager.setBoardViewMode(BOARD_VIEW_MODES.WORLD_2_5D);
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D
    && root.dataset.boardView === "quarter"
    && boardViewModes.at(-1) === BOARD_VIEW_MODES.WORLD_2_5D,
"Trial can use existing 2.5D Player Tray placement without changing ownership");

manager.openAdvisor();
manager.claimAdvisorContext();
check(manager.getState() === UI_LAYOUT_STATES.ADVISOR_EXPANDED
    && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ADVISOR,
"Advisor can expand and own Right Context during Trial");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL
    && manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED,
"Advisor expansion preserves Trial Player Tray mode");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D && root.dataset.boardView === "quarter",
"Advisor expansion preserves 2.5D board view");

manager.setBoardViewMode(BOARD_VIEW_MODES.STRATEGIC_2D);
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.STRATEGIC_2D
    && root.dataset.boardView === "top"
    && manager.getState() === UI_LAYOUT_STATES.ADVISOR_EXPANDED
    && manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL,
"2.5D -> 2D switch while Advisor is expanded preserves Trial layout ownership");
check(boardPresentationState.selectedCell?.r === 2
    && boardPresentationState.selectedCell?.c === 3
    && boardPresentationState.hoveredCell?.r === 1
    && boardPresentationState.hoveredCell?.c === 2
    && boardPresentationState.focusCell?.r === 3
    && boardPresentationState.focusCell?.c === 1,
"2D / 2.5D switching preserves logical Board selection, hover, and focus");
check(trialPresentationState.selectedInterceptCell?.r === 2
    && trialPresentationState.selectedInterceptCell?.c === 2
    && trialPresentationState.hoveredCell?.r === 2
    && trialPresentationState.hoveredCell?.c === 3
    && trialPresentationState.previewDefenseAllocation === 4
    && trialPresentationState.activeEnemyRoute === "route-a",
"view switching and Advisor expansion do not recreate or clear Trial presentation planning state");

manager.setBoardViewMode(BOARD_VIEW_MODES.WORLD_2_5D);
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D
    && root.dataset.boardView === "quarter"
    && trialPresentationState.activeEnemyRoute === "route-a",
"2D -> 2.5D round-trip restores normal quarter placement without losing active Trial route");

manager.closeAdvisor();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL
    && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE
    && visibility.at(-1) === false,
"closing Advisor returns to Trial without restoring a Trial right panel");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "Trial Player Tray remains active after Advisor closes");

const stopTrialStart = uiSource.indexOf("stopTrialInterceptionPreview() {");
const stopTrialEnd = uiSource.indexOf("\n    getTrialAvailableDefense()", stopTrialStart);
const stopTrialSource = stopTrialStart >= 0 && stopTrialEnd > stopTrialStart
    ? uiSource.slice(stopTrialStart, stopTrialEnd)
    : "";
check(stopTrialSource.includes("this.trialPreviewConfig = null;")
    && stopTrialSource.includes("this.trialPresentationState.clearPlanningState();")
    && stopTrialSource.includes("this.hideCellTooltip();")
    && stopTrialSource.includes("this.layoutStateManager.exitTrial();")
    && stopTrialSource.includes("this.render();")
    && stopTrialSource.indexOf("this.trialPresentationState.clearPlanningState();")
        < stopTrialSource.indexOf("this.layoutStateManager.exitTrial();")
    && stopTrialSource.indexOf("this.layoutStateManager.exitTrial();")
        < stopTrialSource.indexOf("this.render();"),
"Trial stop clears temporary Presentation state, exits Trial layout, then re-renders marker cleanup");
trialPresentationState.clearPlanningState();
manager.exitTrial();
check(trialPresentationState.selectedInterceptCell === null
    && trialPresentationState.hoveredCell === null
    && trialPresentationState.previewDefenseAllocation === 0
    && trialPresentationState.activeEnemyRoute === null
    && trialPresentationState.interceptionPreview === null,
"Trial cleanup clears temporary selection, hover, allocation, route focus, and preview state");
check(manager.getState() === UI_LAYOUT_STATES.NORMAL
    && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE
    && manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.NORMAL
    && manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D
    && root.dataset.playerTrayMode === "normal"
    && root.dataset.boardView === "quarter"
    && camera.zoom === 1.35 && camera.panX === 44 && camera.panY === -18 && camera.selectedCell === "3:2",
"Trial exit restores normal Player Tray while preserving Board view and camera state");

console.log(`Trial UI integration: ${passed}/${passed} PASS`);
