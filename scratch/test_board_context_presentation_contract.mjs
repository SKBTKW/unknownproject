import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const layoutState = read("../game/src/ui/layout_state_manager.js");
const routeCss = read("../game/css/2_center_area/trial_route_board_selection.css");
const contextCss = read("../game/css/2_center_area/board_context_mode.css");
const presentationGrid = read("../game/src/ui/board_presentation_grid_component.js");
const legacyGrid = read("../game/src/ui/board_grid_component.js");

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nBoard presentation context contract");

check(layoutState.includes("this.boardPresentationState = null")
    && layoutState.includes("bindBoardPresentationState(presentationState)"),
"LayoutStateManager consumes BoardPresentationState instead of owning board semantics");
check(layoutState.includes("this.boardPresentationState?.viewMode")
    && layoutState.includes("this.boardPresentationState?.contextMode"),
"board view and context remain independent presentation inputs to Layout");

check(routeCss.startsWith('@import url("./board_context_mode.css");'),
"loaded Trial board stylesheet imports board-context presentation rules");
check(presentationGrid.includes("data-board-yields-visibility")
    && presentationGrid.includes("data-board-sockets-visibility"),
"2D board exposes presentation-profile visibility instead of hard-coding Trial disclosure");
check(contextCss.includes('[data-board-yields-visibility="SUPPRESSED"] .tile-yield-line')
    && contextCss.includes('[data-board-yields-visibility="SUPPRESSED"] .socket-yield-line')
    && contextCss.includes('[data-board-yields-visibility="SUPPRESSED"] .symbolic-yield-badge'),
"2D production labels, including symbolic mode, follow yield visibility");
check(contextCss.includes('[data-board-sockets-visibility="SECONDARY"] .socket-tile-content-box')
    && contextCss.includes('[data-board-sockets-visibility="SECONDARY"] .socket-star-icon')
    && contextCss.includes(".symbolic-socket-icon"),
"2D socket landmarks support secondary profile emphasis");
check(legacyGrid.includes("symbolic-socket-icon"),
"symbolic board marks its resource socket icon separately from terrain attributes");
check(!contextCss.includes('body[data-board-context="trial"] #gridBoard .tile-yield-line')
    && !contextCss.includes('body[data-board-context="trial"] #gridBoard .socket-yield-line'),
"2D yield visibility is no longer permanently suppressed by Trial context");
check(!contextCss.includes("footer-left-slot")
    && !contextCss.includes("footer-right-slot")
    && !contextCss.includes("corner-toggle-cell"),
"board context does not hide screen/action UI affordances");
check(!contextCss.includes("display: none !important")
    && !contextCss.includes("display: revert"),
"board context styling avoids migration-only forced display overrides");
check(contextCss.includes("trial-route-cell")
    && contextCss.includes("trial-interception-candidate")
    && contextCss.includes("trial-battle-pending")
    && contextCss.includes("trial-battle-active")
    && contextCss.includes("trial-battle-resolved")
    && contextCss.includes("trial-battle-current"),
"Trial spatial semantics remain eligible for board-context emphasis");

console.log(`Board presentation context: ${passed}/${passed} PASS`);
