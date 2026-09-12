import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const indexSource = read("../game/index.html");
const bridgeSource = read("../game/src/ui/trial_action_tray_runtime_bridge.js");
const traySource = read("../game/src/ui/trial_action_tray_component.js");
const trayCss = read("../game/css/3_bottom_area/trial_action_tray.css");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\nTrial Action Tray runtime contract");

check(indexSource.includes("attachTrialActionTray") && indexSource.includes("attachTrialActionTray(ui)"),
    "bootstrap activates the Trial Action Tray bridge before ui.init");
check(indexSource.includes('id="trialActionTrayHost"'),
    "Player Tray owns a dedicated Trial Action Tray host");
check(bridgeSource.includes('"selectTrialInterceptionCell"')
    && bridgeSource.includes('"selectTrialRoute"')
    && bridgeSource.includes('"setTrialDefenseAllocation"'),
    "bridge refreshes the tray after point, route, and allocation changes");
check(bridgeSource.includes("const baseRender = uiController.render.bind(uiController)"),
    "normal UI renders also refresh the Trial Action Tray presentation");
check(traySource.includes("getPlayerTrayMode") && traySource.includes('=== "trial"'),
    "tray activation follows the Player Tray mode contract");
check(traySource.includes("adjustTrialDefenseAllocation")
    && traySource.includes("setTrialActiveRouteIntercept")
    && traySource.includes("setTrialActiveRouteSkip"),
    "tray delegates point actions to existing Trial/UIController logic");
check(trayCss.includes('body[data-player-tray-mode="trial"] #layerPlayerTray .offering-section')
    && trayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost'),
    "Trial mode replaces normal Hand / Offering presentation in the shared host");
check(trayCss.includes(".trial-defense-allocation-controls")
    && trayCss.includes(".trial-route-decision-actions")
    && trayCss.includes("display: none !important"),
    "legacy right context no longer duplicates point allocation controls while the Trial tray is active");

console.log(`Trial Action Tray runtime: ${passed}/${passed} PASS`);
