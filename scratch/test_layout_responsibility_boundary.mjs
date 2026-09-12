import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const layoutSource = read("../game/src/ui/layout_state_manager.js");
const trayViewCss = read("../game/css/3_bottom_area/player_tray_view_mode.css");
const trialTrayCss = read("../game/css/3_bottom_area/trial_action_tray.css");

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

check(trayViewCss.includes('body[data-board-view="top"] #layerPlayerTray.layer-player-tray')
    && trayViewCss.includes('body[data-board-view="quarter"] #layerPlayerTray.layer-player-tray'),
"Player Tray geometry consumes board-view mode as a layout input");

check(!trayViewCss.includes("data-board-context"),
"Player Tray screen-space geometry does not depend on NORMAL/TRIAL board semantics");

check(trialTrayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost')
    && !trialTrayCss.includes("data-board-context"),
"Trial Action Tray visibility follows layout-owned Player Tray mode, not board context mode");

check(layoutSource.includes("getPlayerTrayMode()")
    && layoutSource.includes("UI_LAYOUT_STATES.TRIAL"),
"Player Tray content mode remains derived from actual layout Trial state");

console.log(`Layout responsibility boundary: ${passed}/${passed} PASS`);
