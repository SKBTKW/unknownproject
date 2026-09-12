import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const indexHtml = read("../game/index.html");
const tokensCss = read("../game/css/0_global_common/layout_tokens.css");
const layerContractCss = read("../game/css/0_global_common/layer_contract.css");
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
check(indexHtml.includes("css/0_global_common/layer_contract.css"), "final screen-space layer contract is loaded by the browser entry point");
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

check(tokensCss.includes("--layout-right-context-bottom: calc(")
    && tokensCss.includes("var(--layout-trial-action-tray-min-height)")
    && tokensCss.includes("var(--layout-trial-action-tray-clearance)"),
"desktop Right Context reserves vertical clearance above the Trial Action Tray");
check(tokensCss.includes("--layout-right-context-max-height: calc(")
    && tokensCss.includes("var(--layout-right-context-top)")
    && tokensCss.includes("var(--layout-right-context-bottom)"),
"Right Context max height is derived from the same Layout-owned boundaries");

check(layoutConfig.includes('right: "var(--layout-right-context-right)"')
    && layoutConfig.includes('width: "var(--layout-right-context-width)"')
    && layoutConfig.includes('width: "var(--layout-right-context-mobile-width)"'),
"legacy Trial Right Context geometry delegates to shared Layout tokens");

check(layerContractCss.includes("#layerPlayerTray.layer-player-tray")
    && layerContractCss.includes("var(--z-player)"),
"Player Tray global stacking order is normalized by the Layout layer contract");
check(layerContractCss.includes("#advisorDockContainer")
    && layerContractCss.includes("var(--z-advisor)"),
"Advisor global stacking order is normalized by the Layout layer contract");
check(layerContractCss.includes("#layerSystemOverlay.layer-system-overlay")
    && layerContractCss.includes("var(--z-overlay)"),
"System Overlay global stacking order is normalized by the Layout layer contract");
check(layerContractCss.includes(".trial-defense-allocation-panel")
    && layerContractCss.includes("var(--z-right-context)"),
"Right Context global stacking order is normalized by the Layout layer contract");

console.log(`Layout geometry tokens: ${passed}/${passed} PASS`);
