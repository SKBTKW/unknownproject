import assert from "node:assert/strict";
import fs from "node:fs";
import { TrialActionTrayComponent } from "../game/src/ui/trial_action_tray_component.js";
import { PLAYER_TRAY_MODES } from "../game/src/ui/layout_state_manager.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const indexSource = read("../game/index.html");
const bridgeSource = read("../game/src/ui/trial_action_tray_runtime_bridge.js");
const trayCss = read("../game/css/3_bottom_area/trial_action_tray.css");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\nTrial Action Tray runtime contract");

check(indexSource.includes("attachTrialActionTray(ui)"),
    "bootstrap activates the Trial Action Tray bridge");
check(indexSource.includes('id="trialActionTrayHost"'),
    "Player Tray owns a dedicated Trial Action Tray host");
check(bridgeSource.includes("new TrialActionTrayComponent(uiController)")
    && bridgeSource.includes('"selectTrialInterceptionCell"')
    && bridgeSource.includes('"selectTrialRoute"')
    && bridgeSource.includes('"setTrialDefenseAllocation"'),
    "runtime bridge owns tray construction and refresh triggers");

const ui = {
    trialPreviewConfig: {},
    trialController: { state: {} },
    layoutStateManager: { getPlayerTrayMode: () => PLAYER_TRAY_MODES.NORMAL }
};
const component = new TrialActionTrayComponent(ui);
check(component.isActive() === false, "tray is inactive outside Trial player-tray mode");
ui.layoutStateManager.getPlayerTrayMode = () => PLAYER_TRAY_MODES.TRIAL;
check(component.isActive() === true, "tray activates from canonical Player Tray mode");
ui.trialPreviewConfig = null;
check(component.isActive() === false, "tray does not activate without Trial preview context");

check(trayCss.includes('body[data-player-tray-mode="trial"] #layerPlayerTray .offering-section')
    && trayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost'),
    "Trial mode swaps normal Offering presentation for the Trial tray");
check(trayCss.includes(".trial-defense-allocation-controls")
    && trayCss.includes(".trial-route-decision-actions")
    && trayCss.includes("display: none !important"),
    "legacy right context does not duplicate point-specific Trial controls");

console.log(`Trial Action Tray runtime: ${passed}/${passed} PASS`);
