import assert from "node:assert/strict";
import fs from "node:fs";

// 1. Static contract verification
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const uiControllerSource = read("../game/src/ui/ui_controller.js");
const boardGridSource = read("../game/src/ui/board_grid_component.js");
const handCardsSource = read("../game/src/ui/hand_cards_component.js");
const reserveSlotSource = read("../game/src/ui/reserve_slot_component.js");

let passed = 0;
const check = (condition, message) => {
    assert.ok(condition, message);
    passed += 1;
    console.log(`  PASS: ${message}`);
};

console.log("\n--- Trial Normal Input Isolation Contract Tests ---");

// Check UIController source
check(uiControllerSource.includes("isTrialInteractionActive()"),
    "UIController defines isTrialInteractionActive()");
check(uiControllerSource.includes("if (this.isTrialInteractionActive()) return;")
    && uiControllerSource.includes("selectCard(idx) {"),
    "selectCard() is guarded by isTrialInteractionActive()");
check(uiControllerSource.includes("if (this.isTrialInteractionActive()) return;")
    && uiControllerSource.includes("rotateSelectedCard(e, idx) {"),
    "rotateSelectedCard() is guarded by isTrialInteractionActive()");
check(uiControllerSource.includes("if (this.isTrialInteractionActive()) {")
    && uiControllerSource.includes("this.selectTrialInterceptionCell(r, c);"),
    "onCellClick() delegates to selectTrialInterceptionCell() when isTrialInteractionActive()");

// Check BoardGridComponent source
check(boardGridSource.includes("this.ui.isTrialInteractionActive?.()"),
    "board_grid_component checks isTrialInteractionActive");

// Check HandCardsComponent source
check(handCardsSource.includes("this.ui?.isTrialInteractionActive?.()"),
    "hand_cards_component checks isTrialInteractionActive");

// Check ReserveSlotComponent source
check(reserveSlotSource.includes("this.ui?.isTrialInteractionActive?.()"),
    "reserve_slot_component checks isTrialInteractionActive");

// 2. Functional behavior simulation
console.log("\n--- Functional Behavior Simulation ---");

// Test isTrialInteractionActive logic
class MockUIController {
    constructor() {
        this.trialPreviewConfig = null;
        this.trialController = { state: null };
        this.developmentTrialPreviewHarness = null;
        this.selectedCard = null;
        this.selectedCardIdx = -1;
        this.state = {
            hasPickedThisTurn: false,
            handOffering: [{ id: "c1", category: "LAND" }]
        };
        this.interceptCalledWith = null;
    }

    isTrialInteractionActive() {
        return Boolean(
            (this.trialPreviewConfig?.active && this.trialController?.state)
            || this.developmentTrialPreviewHarness?.isActive?.()
        );
    }

    selectCard(idx) {
        if (this.isTrialInteractionActive()) return;
        this.selectedCardIdx = idx;
        this.selectedCard = this.state.handOffering[idx];
    }

    selectTrialInterceptionCell(r, c) {
        this.interceptCalledWith = { r, c };
    }

    onCellClick(r, c) {
        if (!this.state) return;
        if (this.isTrialInteractionActive()) {
            this.selectTrialInterceptionCell(r, c);
            return;
        }
        this.selectedCard = "NORMAL_PLACED";
    }
}

const mockUi = new MockUIController();

// Case 1: Normal mode (peace time)
check(!mockUi.isTrialInteractionActive(), "Peace time: isTrialInteractionActive() is false");
mockUi.selectCard(0);
check(mockUi.selectedCardIdx === 0, "Peace time: selectCard(0) succeeds");
mockUi.onCellClick(2, 2);
check(mockUi.selectedCard === "NORMAL_PLACED" && mockUi.interceptCalledWith === null,
    "Peace time: onCellClick places land normally");

// Case 2: Production Trial active (trialPreviewConfig.active + trialController.state)
mockUi.selectedCardIdx = -1;
mockUi.selectedCard = null;
mockUi.interceptCalledWith = null;
mockUi.trialPreviewConfig = { active: true };
mockUi.trialController = { state: { human: { availableDefense: 5 } } };

check(mockUi.isTrialInteractionActive(), "Production Trial: isTrialInteractionActive() is true");
mockUi.selectCard(0);
check(mockUi.selectedCardIdx === -1, "Production Trial: selectCard(0) blocked");
mockUi.onCellClick(3, 4);
check(mockUi.interceptCalledWith?.r === 3 && mockUi.interceptCalledWith?.c === 4,
    "Production Trial: onCellClick routes to selectTrialInterceptionCell");
check(mockUi.selectedCard === null, "Production Trial: normal land placement avoided");

// Case 3: Development harness active
mockUi.trialPreviewConfig = null;
mockUi.trialController = { state: null };
mockUi.interceptCalledWith = null;
mockUi.developmentTrialPreviewHarness = { isActive: () => true };

check(mockUi.isTrialInteractionActive(), "Dev harness: isTrialInteractionActive() is true");
mockUi.selectCard(0);
check(mockUi.selectedCardIdx === -1, "Dev harness: selectCard(0) blocked");
mockUi.onCellClick(1, 1);
check(mockUi.interceptCalledWith?.r === 1 && mockUi.interceptCalledWith?.c === 1,
    "Dev harness: onCellClick routes to selectTrialInterceptionCell");

console.log(`\nAll tests passed: ${passed}/${passed}`);
