import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const layoutState = read("../game/src/ui/layout_state_manager.js");
const routeCss = read("../game/css/2_center_area/trial_route_board_selection.css");
const contextCss = read("../game/css/2_center_area/board_context_mode.css");

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
check(contextCss.includes('body[data-board-context="trial"] #gridBoard .tile-yield-line')
    && contextCss.includes('body[data-board-context="trial"] #gridBoard .socket-yield-line'),
"Trial context may suppress board-internal production labels");
check(!contextCss.includes("footer-left-slot")
    && !contextCss.includes("footer-right-slot")
    && !contextCss.includes("corner-toggle-cell"),
"board context does not hide screen/action UI affordances");
check(!contextCss.includes("display: none !important")
    && !contextCss.includes("display: revert"),
"board context styling avoids migration-only forced display overrides");
check(contextCss.includes("trial-route-cell")
    && contextCss.includes("trial-interception-candidate")
    && contextCss.includes("trial-battle-active"),
"Trial spatial semantics remain eligible for board-context emphasis");

console.log(`Board presentation context: ${passed}/${passed} PASS`);
