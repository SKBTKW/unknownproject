import assert from "node:assert/strict";
import fs from "node:fs";
import { TrialActionTrayComponent } from "../game/src/ui/trial_action_tray_component.js";
import { PLAYER_TRAY_MODES } from "../game/src/ui/layout_state_manager.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const indexSource = read("../game/index.html");
const bridgeSource = read("../game/src/ui/trial_action_tray_runtime_bridge.js");
const componentSource = read("../game/src/ui/trial_action_tray_component.js");
const uiControllerSource = read("../game/src/ui/ui_controller.js");
const i18nSource = read("../game/src/i18n.js");
const trayCss = read("../game/css/3_bottom_area/trial_action_tray.css");

function extractMethod(source, startSignature, nextSignature) {
    const start = source.indexOf(startSignature);
    const end = start >= 0 ? source.indexOf(nextSignature, start + startSignature.length) : -1;
    return start >= 0 && end > start ? source.slice(start, end) : "";
}

const startBattleSource = extractMethod(uiControllerSource, "startTrialBattle() {", "resolveCurrentTrialBattle() {");
const resolveBattleSource = extractMethod(uiControllerSource, "resolveCurrentTrialBattle() {", "advanceCurrentTrialBattle() {");
const advanceBattleSource = extractMethod(uiControllerSource, "advanceCurrentTrialBattle() {", "getCurrentTrialTraversalResult() {");
const transitionBattleSource = extractMethod(uiControllerSource, "transitionTrialAfterCurrentBattle() {", "isTrialBattleSequenceAdvanced() {");
const completeTrialSource = extractMethod(uiControllerSource, "completeTrial() {", "isTrialCompleted() {");
const completedReadSource = extractMethod(uiControllerSource, "isTrialCompleted() {", "getTrialResult() {");
const trialResultReadSource = extractMethod(uiControllerSource, "getTrialResult() {", "/**");

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
check(component.isActive() === true, "tray remains active when planning enters review");
lifecycle.reviewRequested = false;
check(component.isActive() === true, "tray reopens when Modify returns from review to planning");

lifecycle.confirmed = true;
check(component.isActive() === true, "tray remains the Trial operation surface after planning confirmation");
lifecycle.confirmed = false;
lifecycle.activated = true;
check(component.isActive() === true, "tray remains active after plan activation");
lifecycle.activated = false;
lifecycle.battleActive = true;
check(component.isActive() === true, "tray remains active during an active battle");
lifecycle.battleActive = false;
lifecycle.battleResolved = true;
check(component.isActive() === true, "tray presents battle result progression inside the same surface");
lifecycle.battleResolved = false;
lifecycle.completed = true;
check(component.isActive() === true, "tray can present the completed Trial summary until settlement exit");

lifecycle.completed = false;
ui.trialPreviewConfig = null;
check(component.isActive() === false, "tray does not activate without Trial preview context");

check(trayCss.includes('body[data-player-tray-mode="trial"] #layerPlayerTray .offering-section')
    && trayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost'),
    "Trial mode swaps normal Offering presentation for the canonical Trial tray");
check(!trayCss.includes(".trial-defense-allocation-panel")
    && trayCss.includes(".trial-action-tray-progress"),
    "Player Tray presentation no longer depends on the legacy right Trial panel");
check(bridgeSource.includes("attachTrialRouteBoardSelection(uiController)")
    && bridgeSource.includes("uiController.trialActionTrayComponent.render?.()"),
    "bootstrap preserves board-route wiring when UIController already owns the tray");

check(componentSource.includes('btnStartBattle.onclick = () => this.ui.startTrialBattle()')
    && componentSource.includes('btnResolveBattle.onclick = () => this.ui.resolveCurrentTrialBattle()')
    && componentSource.includes('btnAdvanceEnemy.onclick = () => this.ui.advanceCurrentTrialBattle()')
    && componentSource.includes('btnNextBattle.onclick = () => this.ui.transitionTrialAfterCurrentBattle()')
    && componentSource.includes('btnCompleteTrial.onclick = () => this.ui.completeTrial()'),
    "Trial tray progression buttons delegate through UIController instead of mutating Trial state directly");

check(startBattleSource.includes("this.trialController.startNextBattle()")
    && resolveBattleSource.includes("this.trialController.resolveCurrentBattle()")
    && advanceBattleSource.includes("this.trialController.advanceAfterCurrentBattle()")
    && transitionBattleSource.includes("this.trialController.transitionAfterCurrentBattle()"),
    "UIController battle progression methods delegate to canonical TrialController lifecycle operations");

check(componentSource.includes("const completionResult = this.ui.getTrialResult?.()")
    && completedReadSource.includes("this.trialController.isTrialCompleted()")
    && trialResultReadSource.includes("this.trialController.getTrialResult()"),
    "completed Trial tray summary reads canonical completion state/result through UIController");

check(completeTrialSource.includes("this.trialController.completeTrial()")
    && !completeTrialSource.includes("settleTrialResult")
    && !completeTrialSource.includes("postTrialProgression")
    && !completeTrialSource.includes("completePostTrialStagePrelude")
    && !completeTrialSource.includes("advanceStage"),
    "Presentation completeTrial stops at TrialController completion and does not own settlement or Stage progression");

check(componentSource.includes("getTrialPlanningDeploymentPreview")
    && componentSource.includes("deploymentPreview.foodCost")
    && componentSource.includes("deploymentPreview.materialCost")
    && componentSource.includes('id="trialDeploymentCostPreview"'),
    "review surface renders deployment food/material cost before execution");
check(componentSource.includes("deploymentBlocksConfirm")
    && componentSource.includes('disabled aria-disabled="true"'),
    "unaffordable or unresolved deployment preview disables confirm/execute actions");
check(uiControllerSource.includes("previewPlanningDraftDeployment")
    && uiControllerSource.includes("UI_TRIAL_DEPLOYMENT_INSUFFICIENT_RESOURCES")
    && uiControllerSource.includes("UI_TRIAL_DEPLOYMENT_COST_UNAVAILABLE"),
    "UIController resolves draft deployment preview and fails closed before plan confirmation");
check(i18nSource.includes('UI_TRIAL_DEPLOYMENT_COST_TITLE: "配備コスト"')
    && i18nSource.includes('UI_TRIAL_DEPLOYMENT_COST_TITLE: "Deployment Cost"'),
    "deployment cost presentation is localized in Japanese and English");
check(trayCss.includes(".trial-deployment-cost-box")
    && trayCss.includes(".trial-action-progress .btn-trial-action:disabled"),
    "Trial tray styles deployment cost state and disabled confirmation controls");

console.log(`Trial Action Tray runtime: ${passed}/${passed} PASS`);
