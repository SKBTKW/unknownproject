import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const indexSource = read("../game/index.html");
const traySource = read("../game/src/ui/trial_action_tray_component.js");
const trayCss = read("../game/css/3_bottom_area/trial_action_tray.css");

let passed = 0;
function check(condition, message) {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
}

console.log("\nTrial Action Tray contract tests");
check(indexSource.includes('id="trialActionTrayHost"'), "Player Tray host contains a dedicated Trial Action Tray mount");
check(indexSource.includes("new TrialActionTrayComponent(ui)"), "bootstrap composes Trial Action Tray with UIController");
check(indexSource.includes("trialActionTray.render();"), "Trial Action Tray is refreshed after canonical UI rendering");
check(trayCss.includes('body[data-player-tray-mode="trial"] #layerPlayerTray .offering-section'), "normal Hand / Offering is hidden only in Trial tray mode");
check(trayCss.includes('body[data-player-tray-mode="trial"] #trialActionTrayHost'), "Trial Action Tray is shown only in Trial tray mode");
check(traySource.includes("selectedInterceptCell"), "Trial Action Tray is driven by the selected interception point");
check(traySource.includes("getMaxAllocationForRoute") && traySource.includes("previewDefenseAllocation"), "allocation UI reuses Trial presentation state instead of owning defense values");
check(traySource.includes("adjustTrialDefenseAllocation") && traySource.includes("setTrialDefenseAllocation"), "slider and step controls delegate allocation changes to UIController");
check(traySource.includes("setTrialActiveRouteIntercept") && traySource.includes("setTrialActiveRouteSkip"), "route decisions delegate to existing Trial operations");
check(!traySource.includes('id="trialDefenseAllocationSlider"') && !traySource.includes('id="btnTrialDefenseDecrease"'), "Trial Action Tray avoids legacy right-panel control IDs");

console.log(`Trial Action Tray contract: ${passed}/${passed} PASS`);
