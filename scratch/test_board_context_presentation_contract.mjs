import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const layoutState = read("../game/src/ui/layout_state_manager.js");
const boardGrid = read("../game/src/ui/board_grid_component.js");
const routeCss = read("../game/css/2_center_area/trial_route_board_selection.css");
const contextCss = read("../game/css/2_center_area/board_context_mode.css");

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nBoard presentation context contract");

check(layoutState.includes('BOARD_VIEW_MODES')
    && layoutState.includes('BOARD_CONTEXT_MODES'),
"board renderer/view mode and presentation context remain separate axes");
check(layoutState.includes('root.dataset.boardView = boardViewMode')
    && layoutState.includes('root.dataset.boardContext = boardContextMode'),
"layout state exposes independent board-view and board-context root datasets");
check(layoutState.includes('this.boardContextMode = BOARD_CONTEXT_MODES.TRIAL')
    && layoutState.includes('this.boardContextMode = BOARD_CONTEXT_MODES.NORMAL'),
"Trial enter/exit reconciles board presentation context without changing renderer mode");

check(routeCss.startsWith('@import url("./board_context_mode.css");'),
"loaded Trial board stylesheet imports the board-context presentation rules");
check(contextCss.includes('body[data-board-context="trial"] #gridBoard .tile-yield-line')
    && contextCss.includes('body[data-board-context="trial"] #gridBoard .socket-yield-line'),
"Trial board presentation suppresses normal production yield labels");
check(contextCss.includes('body[data-board-context="trial"] #gridBoard .footer-left-slot')
    && contextCss.includes('body[data-board-context="trial"] #gridBoard .footer-right-slot'),
"Trial board presentation suppresses normal board footer actions/status slots");
check(contextCss.includes('body[data-board-context="normal"] #gridBoard .tile-yield-line'),
"normal board presentation explicitly restores economic labels");

check(boardGrid.includes('class="tile-yield-line"')
    && boardGrid.includes('class="socket-yield-line"')
    && boardGrid.includes('footer-left-slot')
    && boardGrid.includes('footer-right-slot'),
"presentation selectors correspond to BoardGrid-owned rendered affordances");

console.log(`Board presentation context: ${passed}/${passed} PASS`);
