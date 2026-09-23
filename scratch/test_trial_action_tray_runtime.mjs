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

const lifecycle = {
    reviewRequested: false,
    confirmed: false,
    activated: false,
    battleActive: false,
    battleResolved: false,
    completed: false
};
const ui = {
    trialPreviewConfig: {},
    trialController: { state: {} },
    trialPresentationState: {
        get planningReviewRequested() { return lifecycle.reviewRequested; }
    },
    isTrialPlanningConfirmed: () => lifecycle.confirmed,
    isTrialPlanActivated: () => lifecycle.activated,
    isTrialBattleActive: () => lifecycle.battleActive,
    isTrialBattleResolved: () => lifecycle.battleResolved,
    isTrialCompleted: () => lifecycle.completed,
    layoutStateManager: { getPlayerTrayMode: () => PLAYER_TRAY_MODES.NORMAL }
};
const component = new TrialActionTrayComponent(ui);
check(component.isActive() === false, "tray is inactive outside Trial player-tray mode");
ui.layoutStateManager.getPlayerTrayMode = () => PLAYER_TRAY_MODES.TRIAL;
check(component.isActive() === true, "tray activates during editable Trial planning");

lifecycle.reviewRequested = true;
check(component.isActive() === false, "tray closes when planning enters review");
lifecycle.reviewRequested = false;
check(component.isActive() === true, "tray reopens when Modify returns from review to planning");

lifecycle.confirmed = true;
check(component.isActive() === false, "tray stays closed after planning confirmation");
lifecycle.confirmed = false;
lifecycle.activated = true;
check(component.isActive() === false, "tray stays closed after plan activation");
lifecycle.activated = false;
lifecycle.battleActive = true;
check(component.isActive() === false, "tray stays closed during an active battle");
lifecycle.battleActive = false;
lifecycle.battleResolved = true;
check(component.isActive() === false, "tray stays closed while a battle result owns Trial progression");
lifecycle.battleResolved = false;
lifecycle.completed = true;
check(component.isActive() === false, "tray stays closed after Trial completion");

lifecycle.completed = false;
ui.trialPreviewConfig = null;
check(component.isActive() === false, "tray does not activate without Trial preview context");

check(trayCss.includes('body[data-player-tray-mode="trial"] #layerPlayerTray .offering-section')
    && trayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost'),
    "Trial mode swaps normal Offering presentation for the Trial tray");
check(trayCss.includes(".trial-defense-allocation-controls")
    && trayCss.includes(".trial-route-decision-actions")
    && trayCss.includes("display: none !important"),
    "legacy right context does not duplicate point-specific Trial controls");
check(
    trayCss.includes("point-specific controls now belong to the bottom Trial Action Tray")
    && trayCss.includes("route/global")
    && trayCss.includes("planning progression"),
    "presentation contract keeps point planning in the tray and Trial progression in right context"
);

console.log(`Trial Action Tray runtime: ${passed}/${passed} PASS`);
