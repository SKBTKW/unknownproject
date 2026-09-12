import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const indexHtml = read("../game/index.html");
const tokensCss = read("../game/css/0_global_common/layout_tokens.css");
const trayViewCss = read("../game/css/3_bottom_area/player_tray_view_mode.css");
const trialTrayCss = read("../game/css/3_bottom_area/trial_action_tray.css");
const layoutConfig = read("../game/src/ui/layout_config.js");

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nLayout geometry token contract");

check(indexHtml.includes("css/0_global_common/layout_tokens.css"), "shared layout tokens are loaded by the browser entry point");
check(tokensCss.includes("--layout-player-tray-bottom")
    && tokensCss.includes("--layout-trial-action-tray-width")
    && tokensCss.includes("--layout-right-context-width"),
"layout tokens cover Player Tray, Trial Action Tray, and Right Context geometry");

check(trayViewCss.includes("var(--layout-player-tray-bottom)")
    && trayViewCss.includes("var(--layout-player-tray-motion-ms)"),
"Player Tray placement consumes Layout-owned geometry tokens");
check(!trayViewCss.includes("data-board-context"), "Player Tray placement remains independent from Board Presentation context semantics");

check(trialTrayCss.includes("var(--layout-trial-action-tray-width)")
    && trialTrayCss.includes("var(--layout-trial-action-tray-width-compact)")
    && trialTrayCss.includes("var(--layout-trial-action-tray-width-mobile)"),
"Trial Action Tray responsive geometry consumes Layout-owned tokens");
check(trialTrayCss.includes('data-player-tray-mode="trial"'), "Trial Action Tray visibility remains driven by Layout player-tray mode");
check(!trialTrayCss.includes("data-board-context"), "Trial Action Tray visibility is not coupled to Board Presentation context");

check(layoutConfig.includes('right: "var(--layout-right-context-right)"')
    && layoutConfig.includes('width: "var(--layout-right-context-width)"')
    && layoutConfig.includes('width: "var(--layout-right-context-mobile-width)"'),
"legacy Trial Right Context geometry delegates to shared Layout tokens");

console.log(`Layout geometry tokens: ${passed}/${passed} PASS`);
