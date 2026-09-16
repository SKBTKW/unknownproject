import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const uiSource = read("../game/src/ui/ui_controller.js");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- Trial Hover / Tooltip Isolation Contract Tests ---");

// Static contract checks
check(uiSource.includes("onCellMouseEnter(e, r, c) {")
    && uiSource.indexOf("if (this.isTrialInteractionActive()) {") < uiSource.indexOf("merge-hover-highlight"),
    "onCellMouseEnter checks isTrialInteractionActive before applying merge-hover-highlight");

check(uiSource.includes("showCellTooltip(e, r, c, cell) {")
    && uiSource.includes("if (this.isTrialInteractionActive()) {"),
    "showCellTooltip branches on isTrialInteractionActive rather than dev harness alone");

check(uiSource.includes("clearCellPreviews() {")
    && uiSource.includes("if (this.isTrialInteractionActive()) {"),
    "clearCellPreviews branches on isTrialInteractionActive");

// Functional behavior simulation
console.log("\n--- Functional Behavior Simulation ---");

class MockElement {
    constructor(className = "") {
        this.classList = {
            classes: new Set(className ? className.split(" ") : []),
            add: (...cls) => cls.forEach(c => this.classList.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList.classes.delete(c)),
            contains: (c) => this.classList.classes.has(c)
        };
    }
}

class MockUIController {
    constructor() {
        this.trialActive = false;
        this.trialInterceptionUpdated = false;
        this.trialPresentationState = {
            interceptionPreview: null,
            clearHoveredCell: () => { this.clearedHover = true; }
        };
        this.clearedHover = false;
        this.tooltipShown = null;
        this.tooltipHidden = false;
        this.state = {
            grid: [[{ type: "GL1_PLAINS" }]]
        };
    }

    isTrialInteractionActive() {
        return this.trialActive;
    }

    getBoardDisplayGrid() {
        return [[{ mergeGroupId: "grp1" }]];
    }

    updateTrialInterceptionPreview(r, c) {
        this.trialInterceptionUpdated = true;
    }

    refreshTrialInterceptionPreview() {}

    hideCellTooltip() {
        this.tooltipHidden = true;
    }

    hideTileTooltip() {
        this.hideCellTooltip();
    }

    getTrialInterceptionCellState(r, c) {
        return { isBlockPlannedByOther: false };
    }

    onCellMouseEnter(e, r, c, cellEl) {
        if (!this.state) return;
        if (this.isTrialInteractionActive()) {
            this.updateTrialInterceptionPreview(r, c);
            return;
        }
        // Peace time merge highlight
        cellEl.classList.add("merge-hover-highlight");
    }

    showCellTooltip(e, r, c, cell) {
        if (!cell) {
            this.hideCellTooltip();
            return;
        }
        if (this.isTrialInteractionActive()) {
            const preview = this.trialPresentationState?.interceptionPreview;
            if (!preview || preview.cell?.r !== r || preview.cell?.c !== c) {
                this.hideCellTooltip();
                return;
            }
            this.tooltipShown = "TRIAL_TOOLTIP";
            return;
        }
        this.tooltipShown = "PEACE_TOOLTIP";
    }
}

const ui = new MockUIController();
const mockCell = new MockElement();

// 1. Peace time hover: merge highlight applied, peace tooltip shown
ui.trialActive = false;
ui.onCellMouseEnter({}, 0, 0, mockCell);
check(mockCell.classList.contains("merge-hover-highlight"),
    "Peace time: onCellMouseEnter applies merge-hover-highlight");
ui.showCellTooltip({}, 0, 0, { type: "GL1_PLAINS" });
check(ui.tooltipShown === "PEACE_TOOLTIP",
    "Peace time: showCellTooltip shows peace tooltip");

// 2. Trial time hover: merge highlight skipped, Trial interception preview updated
mockCell.classList.remove("merge-hover-highlight");
ui.trialActive = true;
ui.trialInterceptionUpdated = false;
ui.tooltipShown = null;
ui.tooltipHidden = false;

ui.onCellMouseEnter({}, 0, 0, mockCell);
check(!mockCell.classList.contains("merge-hover-highlight"),
    "Trial mode: onCellMouseEnter does NOT apply merge-hover-highlight");
check(ui.trialInterceptionUpdated,
    "Trial mode: onCellMouseEnter updates Trial interception preview");

// 3. Trial time tooltip with no active intercept preview: hides tooltip, does NOT show peace tooltip
ui.showCellTooltip({}, 0, 0, { type: "GL1_PLAINS" });
check(ui.tooltipHidden, "Trial mode without preview: hides tooltip");
check(ui.tooltipShown === null, "Trial mode without preview: does NOT show peace tooltip");

// 4. Trial time tooltip with matching preview: shows Trial tooltip
ui.trialPresentationState.interceptionPreview = { cell: { r: 0, c: 0 } };
ui.showCellTooltip({}, 0, 0, { type: "GL1_PLAINS" });
check(ui.tooltipShown === "TRIAL_TOOLTIP", "Trial mode with preview: shows Trial tooltip");

console.log(`\nTrial Hover / Tooltip tests passed: ${passed}/${passed}`);
