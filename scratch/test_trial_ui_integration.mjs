import assert from "node:assert/strict";
import fs from "node:fs";
import {
    HAND_LAYOUT_STATES,
    LayoutStateManager,
    PLAYER_TRAY_MODES,
    RIGHT_CONTEXT_OWNERS,
    UI_LAYOUT_STATES
} from "../game/src/ui/layout_state_manager.js";

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const uiSource = read("../game/src/ui/ui_controller.js");
const boardSource = read("../game/src/ui/board_grid_component.js");
const panelSource = read("../game/src/ui/trial_defense_allocation_component.js");
const panelCss = read("../game/css/2_center_area/land_grid.css");
const handCss = read("../game/css/3_bottom_area/draw_card_select_area.css");
const layoutConfig = read("../game/src/ui/layout_config.js");

const root = { dataset: {} };
const body = { dataset: {} };
const visibility = [];
const trayModes = [];
const camera = { zoom: 1.35, panX: 44, panY: -18, selectedCell: "3:2" };
const manager = new LayoutStateManager({ documentRef: { documentElement: root, body } });
manager.setAdapters({
    setTrialContextVisible: visible => visibility.push(visible),
    setPlayerTrayMode: mode => trayModes.push(mode)
});

console.log("\nPhase 5 Trial UI integration tests");
manager.enterTrial();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL, "Trial starts in TRIAL layout state");
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.TRIAL, "Trial owns the right context");
check(manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED, "Trial hand uses TRIAL_COLLAPSED compatibility state");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "Trial switches Player Tray into dedicated TRIAL mode");
check(root.dataset.handState === "trial-collapsed", "root dataset exposes Trial hand state");
check(root.dataset.playerTrayMode === "trial", "root dataset exposes Trial Player Tray mode");
check(trayModes.at(-1) === PLAYER_TRAY_MODES.TRIAL, "Player Tray adapter receives TRIAL mode");
check(uiSource.includes("trial-hand-collapsed-bar") && uiSource.includes("UI_TRIAL_HAND_COLLAPSED"), "Trial renders the existing compact hand bar until Trial Action Tray presentation is mounted");
check(handCss.includes(".offering-section.is-trial-collapsed") && handCss.includes("height: 42px"), "Trial hand bar has bounded compact geometry");
check(layoutConfig.includes('width: "360px"') && layoutConfig.includes('maxHeight: "calc(100vh - 168px)"'), "legacy right Trial context keeps current PC bounds during migration");
check(panelCss.includes("overflow-y: auto") && panelCss.includes("overscroll-behavior: contain"), "legacy right Trial context scrolls internally during migration");
check(panelSource.includes('this.contextOwnerProvider() === "trial"'), "Trial panel visibility follows the context-owner contract");
check(panelSource.includes("trial-context-summary") && panelSource.includes("activeRoute?.suppression"), "right context exposes route and enemy strength summary");
check(uiSource.includes("getTrialRouteVisualState") && uiSource.includes("routeDirection:"), "route visual state exposes entry and direction metadata separately");
check(boardSource.includes('data-trial-direction') && boardSource.includes("trial-route-entry"), "Board consumes route direction and entry metadata");
check(panelCss.includes("pointer-events: none") && panelCss.includes(".cell.trial-route-cell::before"), "visual route markers do not block Board input");
check(panelSource.includes("this.ui.selectTrialRoute(rId)"), "legacy right-panel Route selection remains available during migration");

manager.openAdvisor();
manager.claimAdvisorContext();
check(manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ADVISOR && visibility.at(-1) === false, "Advisor suspends Trial context exclusively");
check(manager.getHandState() === HAND_LAYOUT_STATES.TRIAL_COLLAPSED, "Advisor does not expand the Trial hand");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL && trayModes.at(-1) === PLAYER_TRAY_MODES.TRIAL, "Advisor overlay preserves Trial Player Tray mode");
manager.closeAdvisor();
check(manager.getState() === UI_LAYOUT_STATES.TRIAL && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.TRIAL && visibility.at(-1) === true, "closing Advisor restores Trial context");
check(manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.TRIAL, "closing Advisor restores Trial with the Trial Player Tray still active");
manager.exitTrial();
check(manager.getState() === UI_LAYOUT_STATES.NORMAL
    && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE
    && manager.getPlayerTrayMode() === PLAYER_TRAY_MODES.NORMAL
    && root.dataset.playerTrayMode === "normal"
    && camera.zoom === 1.35 && camera.panX === 44 && camera.panY === -18 && camera.selectedCell === "3:2",
"Trial exit restores normal Player Tray mode without mutating Board camera state");

console.log(`Trial UI integration: ${passed}/${passed} PASS`);