import assert from "node:assert/strict";
import fs from "node:fs";
import { UI_LAYOUT_STATES, RIGHT_CONTEXT_OWNERS, LayoutStateManager } from "../game/src/ui/layout_state_manager.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const uiControllerSource = read("../game/src/ui/ui_controller.js");
const layoutConfigSource = read("../game/src/ui/layout_config.js");
const layerContractCss = read("../game/css/0_global_common/layer_contract.css");
const landGridCss = read("../game/css/2_center_area/land_grid.css");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- Trial Right Context Retirement Contract Tests ---");

check(
    !fs.existsSync(new URL("../game/src/ui/trial_defense_allocation_component.js", import.meta.url)),
    "standalone TrialDefenseAllocationComponent is removed"
);

check(
    !uiControllerSource.includes("TrialDefenseAllocationComponent")
        && !uiControllerSource.includes("trialDefenseAllocationComponent"),
    "UIController has no standalone Trial right-panel dependency"
);

check(
    !layoutConfigSource.includes("trialDefenseAllocation"),
    "UILayoutConfig has no retired Trial right-panel geometry"
);

check(
    !layerContractCss.includes(".trial-defense-allocation-panel")
        && !landGridCss.includes(".trial-defense-allocation-panel"),
    "global and board CSS have no retired Trial panel shell rules"
);

const root = { dataset: {} };
const body = { dataset: {} };
const visibility = [];
const manager = new LayoutStateManager({
    rootElement: root,
    bodyElement: body
});
manager.setAdapters({
    setTrialContextVisible: visible => visibility.push(visible)
});

manager.enterTrial();
check(
    manager.getState() === UI_LAYOUT_STATES.TRIAL
        && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE,
    "Trial leaves Right Context unowned"
);
check(visibility.at(-1) === false, "Trial does not expose a standalone right panel");

manager.openAdvisor();
manager.claimAdvisorContext();
check(
    manager.getState() === UI_LAYOUT_STATES.ADVISOR_EXPANDED
        && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.ADVISOR,
    "Advisor can own Right Context during Trial"
);

manager.closeAdvisor();
check(
    manager.getState() === UI_LAYOUT_STATES.TRIAL
        && manager.getContextOwner() === RIGHT_CONTEXT_OWNERS.NONE,
    "closing Advisor returns to Trial without resurrecting a Trial right panel"
);

console.log(`\nTrial Right Context retirement: ${passed}/${passed} PASS`);
