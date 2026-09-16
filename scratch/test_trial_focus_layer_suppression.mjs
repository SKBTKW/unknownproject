import assert from "node:assert/strict";
import fs from "node:fs";
import { FocusLayerManager } from "../game/src/ui/focus_layer_system.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const focusSource = read("../game/src/ui/focus_layer_system.js");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- FocusLayer Trial Suppression Contract Tests ---");

// Static contract checks
check(focusSource.includes("isTrialModeActive()"),
    "FocusLayerManager defines isTrialModeActive()");
check(focusSource.includes("isTrialTray"),
    "FocusLayerManager distinguishes Trial Action Tray from normal Hand cards");
check(focusSource.includes("suspend()") && focusSource.includes("resume()"),
    "FocusLayerManager provides suspend() and resume() lifecycle controls");
check(focusSource.includes("if (this.isTrialModeActive()) {") && focusSource.includes("this.resetToNeutral();"),
    "updateLayerStates() immediately resets to neutral without dimming when in Trial");

// Functional behavior simulation
console.log("\n--- Functional Behavior Simulation ---");

class MockElement {
    constructor(id = "", className = "") {
        this.id = id;
        this.className = className;
        this.classList = {
            classes: new Set(className ? className.split(" ") : []),
            add: (...cls) => cls.forEach(c => this.classList.classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList.classes.delete(c)),
            contains: (c) => this.classList.classes.has(c)
        };
        this.style = {};
        this.dataset = {};
    }
}

const mockBoard = new MockElement("layerWorldBoard", "layer-world-board");
const mockGrid = new MockElement("gridBoard", "grid-with-headers");
const mockOffering = new MockElement("", "offering-section");

const flm = new FocusLayerManager();
flm.boardContainerEl = mockBoard;
flm.boardGridEl = mockGrid;
flm.offeringSectionEl = mockOffering;

// 1. Peace time: Hand hover dims board
flm.isHandHovered = true;
flm.isBoardHovered = false;
flm.updateLayerStates();
check(mockBoard.classList.contains("layer-dim-blur"),
    "Peace time: hand hover applies layer-dim-blur to board");

// 2. Trial mode via dataset: Board blur is cleared and suppressed
globalThis.document = {
    body: { dataset: { playerTrayMode: "trial" } },
    getElementById: (id) => null
};

flm.updateLayerStates();
check(!mockBoard.classList.contains("layer-dim-blur"),
    "Trial mode: board blur is cleared to neutral");
check(!mockGrid.classList.contains("board-dim-blur"),
    "Trial mode: grid blur is cleared to neutral");

// Even if isHandHovered is true, updateLayerStates does not dim board in trial mode
flm.isHandHovered = true;
flm.updateLayerStates();
check(!mockBoard.classList.contains("layer-dim-blur"),
    "Trial mode: isHandHovered cannot dim board");

// 3. Explicit suspend / resume
globalThis.document.body.dataset.playerTrayMode = "normal";
flm.suspend();
check(flm.isTrialModeActive(), "suspend() forces trial/suppressed state");
flm.updateLayerStates();
check(!mockBoard.classList.contains("layer-dim-blur"),
    "Suspended state: board blur is suppressed");

flm.resume();
check(!flm.isSuspended, "resume() restores normal behavior");
flm.isHandHovered = true;
flm.updateLayerStates();
check(mockBoard.classList.contains("layer-dim-blur"),
    "Resumed peace time: hand hover dims board again");

// Cleanup
flm.resetToNeutral();
delete globalThis.document;

console.log(`\nFocusLayer Trial suppression tests passed: ${passed}/${passed}`);
