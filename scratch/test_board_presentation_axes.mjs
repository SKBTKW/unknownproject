import assert from "node:assert/strict";
import {
    LayoutStateManager,
    PLAYER_TRAY_MODES,
    UI_LAYOUT_STATES
} from "../game/src/ui/layout_state_manager.js";
import {
    BoardPresentationState,
    BOARD_CONTEXT_MODES,
    BOARD_VIEW_MODES
} from "../game/src/presentation/board_presentation_state.js";

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

const root = { dataset: {} };
const body = { dataset: {} };
const manager = new LayoutStateManager({ documentRef: { documentElement: root, body } });
const board = new BoardPresentationState();
manager.bindBoardPresentationState(board);

console.log("\nBoard presentation two-axis contract");

check(manager.getBoardViewMode() === BOARD_VIEW_MODES.STRATEGIC_2D, "renderer axis defaults to STRATEGIC_2D");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "presentation context defaults to NORMAL");
check(root.dataset.boardView === "top" && root.dataset.boardContext === "normal", "root exposes both axes independently");

board.setViewMode(BOARD_VIEW_MODES.WORLD_2_5D);
manager.applyContract();
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D, "view axis can switch to WORLD_2_5D");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "view switch preserves NORMAL context");

board.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
manager.applyContract();
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D, "context switch preserves 2.5D view");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.TRIAL, "context axis can switch to TRIAL");
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "TRIAL presentation context does not fake a live Trial gameplay state");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.NORMAL, "TRIAL presentation outside a live Trial keeps the normal Player Tray");

board.setContextMode(BOARD_CONTEXT_MODES.NORMAL);
manager.applyContract();
manager.enterTrial();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "enterTrial still enters real Trial gameplay state");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.NORMAL, "enterTrial does not mutate BoardPresentation context");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D, "enterTrial preserves renderer/view axis");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "live Trial activates Trial Player Tray");

board.setContextMode(BOARD_CONTEXT_MODES.TRIAL);
manager.applyContract();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "switching Board context does not change live Trial layout");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "live Trial Player Tray remains active while Board context changes");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D, "context switch during Trial preserves view axis");

manager.exitTrial();
check(manager.getState() === UI_LAYOUT_STATES.NORMAL, "exitTrial returns gameplay layout to NORMAL");
check(manager.getBoardContextMode() === BOARD_CONTEXT_MODES.TRIAL, "exitTrial does not silently rewrite BoardPresentation context");
check(manager.getBoardViewMode() === BOARD_VIEW_MODES.WORLD_2_5D, "exitTrial does not alter renderer/view axis");

console.log(`Board presentation axes: ${passed}/${passed} PASS`);
