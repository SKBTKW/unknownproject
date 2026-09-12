import assert from "node:assert/strict";
import {
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_MODES,
    LayoutStateManager,
    PLAYER_TRAY_MODES,
    UI_LAYOUT_STATES
} from "../game/src/ui/layout_state_manager.js";

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

const root = { dataset: {} };
const body = { dataset: {} };
const manager = new LayoutStateManager({ documentRef: { documentElement: root, body } });

console.log("\nBoard presentation two-axis contract");

check(manager.getBoardViewMode() === BOARD_VIEW_MODES.TOP, "renderer axis defaults to 2D/TOP");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "presentation context defaults to NORMAL");
check(root.dataset.boardView === "top" && root.dataset.boardContext === "normal", "root exposes both axes independently");

manager.setBoardViewMode(BOARD_VIEW_MODES.QUARTER);
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.QUARTER, "view axis can switch to QUARTER");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "view switch preserves NORMAL context");

manager.setBoardContextMode(BOARD_CONTEXT_MODES.TRIAL);
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.QUARTER, "context switch preserves QUARTER view");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.TRIAL, "context axis can switch to TRIAL");
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "TRIAL presentation context does not fake a live Trial gameplay state");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.NORMAL, "TRIAL presentation outside a live Trial keeps the normal Player Tray");

manager.setBoardContextMode(BOARD_CONTEXT_MODES.NORMAL);
manager.enterTrial();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "enterTrial still enters real Trial gameplay state");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.TRIAL, "real Trial defaults board presentation to TRIAL context");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.QUARTER, "enterTrial preserves renderer/view axis");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "live Trial activates Trial Player Tray");

manager.setBoardContextMode(BOARD_CONTEXT_MODES.NORMAL);
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "switching to NORMAL presentation does not exit Trial gameplay");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "live Trial Player Tray remains active while inspecting NORMAL board context");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.QUARTER, "context switch during Trial preserves view axis");

manager.exitTrial();
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "exitTrial returns gameplay layout to NORMAL");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "exitTrial restores NORMAL board presentation");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.QUARTER, "exitTrial does not alter renderer/view axis");

console.log(`Board presentation axes: ${passed}/${passed} PASS`);
