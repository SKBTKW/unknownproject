import assert from "node:assert/strict";
import fs from "node:fs";
import { UILayoutConfig } from "../game/src/ui/layout_config.js";
import { TrialDefenseAllocationComponent } from "../game/src/ui/trial_defense_allocation_component.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const configSource = read("../game/src/ui/layout_config.js");
const componentSource = read("../game/src/ui/trial_defense_allocation_component.js");
const layerContractCss = read("../game/css/0_global_common/layer_contract.css");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- Right Context Geometry SSOT Contract Tests ---");

// Static contract checks
check(configSource.includes("trialDefenseAllocation: {")
    && configSource.includes('bottom: "auto"'),
    "UILayoutConfig defines trialDefenseAllocation with explicit mobile bottom: auto");

check(componentSource.includes("applyLayoutGeometry(root = this.containerEl)")
    && componentSource.includes("window.addEventListener(\"resize\", this._resizeHandler)"),
    "TrialDefenseAllocationComponent defines applyLayoutGeometry and listens to window resize");

const mediaQueryStart = layerContractCss.indexOf("@media (max-width: 768px)");
const mobileBlock = layerContractCss.slice(mediaQueryStart);
const mobilePanelBlock = mobileBlock.slice(mobileBlock.indexOf(".trial-defense-allocation-panel"));
const mobilePanelRule = mobilePanelBlock.slice(0, mobilePanelBlock.indexOf("}") + 1);

check(!mobilePanelRule.includes("!important"),
    "layer_contract.css mobile query has NO !important geometry overrides for .trial-defense-allocation-panel");
check(!mobilePanelRule.includes("top:") && !mobilePanelRule.includes("width:"),
    "layer_contract.css mobile geometry is removed (SSOT is UILayoutConfig via applyLayoutGeometry)");

// Functional behavior simulation
console.log("\n--- Functional Behavior Simulation ---");

// Test UILayoutConfig SSOT values
check(UILayoutConfig.trialDefenseAllocation.desktop.position === "fixed",
    "Desktop config has fixed position");
check(UILayoutConfig.trialDefenseAllocation.mobile.position === "fixed",
    "Mobile config has fixed position");
check(UILayoutConfig.trialDefenseAllocation.mobile.bottom === "auto",
    "Mobile config has explicit bottom: auto");

// Test component layout application with mock element
const mockElement = { style: {} };
const comp = new TrialDefenseAllocationComponent({}, { contextOwnerProvider: () => "TRIAL" });

// Desktop emulation (> 768px)
globalThis.window = { innerWidth: 1024 };
comp.applyLayoutGeometry(mockElement);
check(mockElement.style.top === "var(--layout-right-context-top)",
    "Desktop width sets desktop top CSS variable");
check(mockElement.style.bottom === "var(--layout-right-context-bottom)",
    "Desktop width sets desktop bottom CSS variable");

// Mobile emulation (<= 768px)
globalThis.window = { innerWidth: 500 };
comp.applyLayoutGeometry(mockElement);
check(mockElement.style.top === "var(--layout-right-context-mobile-top)",
    "Mobile width switches to mobile top CSS variable");
check(mockElement.style.bottom === "auto",
    "Mobile width switches to bottom: auto");

delete globalThis.window;

console.log(`\nRight Context Geometry tests passed: ${passed}/${passed}`);
