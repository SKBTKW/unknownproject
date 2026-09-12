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
check(indexHtml.indexOf("css/3_bottom_area/draw_card_select_area.css")
    < indexHtml.indexOf("css/3_bottom_area/player_tray_view_mode.css"),
"Player Tray placement authority loads after legacy hand styling");
check(indexHtml.indexOf("css/0_global_common/layer_contract.css")
    > indexHtml.indexOf("css/3_bottom_area/player_tray_view_mode.css"),
"final layer contract loads after feature-level tray styling");

check(tokensCss.includes("--layout-header-height")
    && tokensCss.includes("--layout-app-gap")
    && tokensCss.includes("--layout-system-overlay-inset"),
"layout tokens own shared app-shell geometry");

check(tokensCss.includes("--layout-player-tray-bottom")
    && tokensCss.includes("--layout-player-tray-top-left")
    && tokensCss.includes("--layout-player-tray-quarter-left")
    && tokensCss.includes("--layout-player-tray-mobile-left")
    && tokensCss.includes("--layout-trial-action-tray-width")
    && tokensCss.includes("--layout-right-context-width")
    && tokensCss.includes("--layout-advisor-right"),
"layout tokens cover Player Tray anchors, Trial Action Tray, Right Context, and Advisor geometry");

check(trayViewCss.includes("position: absolute")
    && trayViewCss.includes("display: flex")
    && trayViewCss.includes("width: auto !important")
    && trayViewCss.includes("var(--layout-player-tray-bottom)")
    && trayViewCss.includes("var(--layout-player-tray-motion-ms)"),
"Player Tray placement file is self-contained as the final screen-space geometry authority");
check(trayViewCss.includes('data-board-view="top"')
    && trayViewCss.includes('data-board-view="quarter"')
    && trayViewCss.includes("var(--layout-player-tray-top-left)")
    && trayViewCss.includes("var(--layout-player-tray-quarter-left)"),
"Player Tray placement consumes board-view only as a placement input");
check(trayViewCss.includes("var(--layout-player-tray-mobile-left)")
    && trayViewCss.includes("var(--layout-player-tray-mobile-bottom)"),
"Player Tray mobile placement is tokenized under Layout ownership");
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
check(tokensCss.includes("--layout-right-context-mobile-top")
    && tokensCss.includes("--layout-right-context-mobile-max-height")
    && layerContractCss.includes("bottom: auto !important")
    && layerContractCss.includes("var(--layout-right-context-mobile-top)")
    && layerContractCss.includes("var(--layout-right-context-mobile-max-height)"),
"mobile Right Context is reserved in the upper band instead of overlapping the Trial Action Tray");

check(layoutConfig.includes('right: "var(--layout-right-context-right)"')
    && layoutConfig.includes('width: "var(--layout-right-context-width)"')
    && layoutConfig.includes('width: "var(--layout-right-context-mobile-width)"'),
"legacy Trial Right Context geometry delegates to shared Layout tokens");

check(layerContractCss.includes(".top-bar")
    && layerContractCss.includes("var(--layout-header-height)")
    && layerContractCss.includes("var(--z-hud)"),
"Header shell geometry and stacking are normalized by the Layout layer contract");
check(layerContractCss.includes("#layerPlayerTray.layer-player-tray")
    && layerContractCss.includes("var(--z-player)"),
"Player Tray global stacking order is normalized by the Layout layer contract");
check(layerContractCss.includes("#advisorDockContainer")
    && layerContractCss.includes("var(--layout-advisor-right)")
    && layerContractCss.includes("var(--layout-advisor-bottom)")
    && layerContractCss.includes("var(--z-advisor)"),
"Advisor dock placement and stacking are normalized by the Layout layer contract");
check(layerContractCss.includes("#layerSystemOverlay.layer-system-overlay")
    && layerContractCss.includes("position: fixed !important")
    && layerContractCss.includes("var(--layout-system-overlay-inset)")
    && layerContractCss.includes("var(--z-overlay)"),
"System Overlay viewport geometry and stacking are normalized by the Layout layer contract");
check(layerContractCss.includes(".trial-defense-allocation-panel")
    && layerContractCss.includes("var(--z-right-context)"),
"Right Context global stacking order is normalized by the Layout layer contract");

console.log(`Layout geometry tokens: ${passed}/${passed} PASS`);
