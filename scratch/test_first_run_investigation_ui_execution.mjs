import assert from "node:assert/strict";
import { GameEngine, UIController } from "../game/src/app.js";
import { attachTrialRuntimeSubsystems } from "../game/src/trial/integration/trial_runtime_bootstrap.js";
import { WARNING_STATES } from "../game/src/warning/domain/warning_state.js";
import { resolvePlacementAnchor, resolvePlacementAttributeCells, resolvePlacementShape } from "../game/src/core/placement_geometry.js";

const engine = GameEngine.createGame({ runSeed: 20261002, firstRun: true });
assert.equal(attachTrialRuntimeSubsystems(engine).success, true);
const ui = new UIController(engine);
// Headless rendering only; the UI execution boundary and Domain remain live.
ui.render = () => {};
while (engine.state.turn < 8) {
    placement: for (let index = 0; index < engine.state.handOffering.length; index += 1) {
        const card = engine.state.handOffering[index];
        const definition = card?.terrain || card;
        if (definition?.category !== "LAND") continue;
        const shape = resolvePlacementShape(card);
        const anchor = resolvePlacementAnchor(card, shape);
        const cells = resolvePlacementAttributeCells(card);
        for (let r = 0; r < 5; r += 1) {
            for (let c = 0; c < 5; c += 1) {
                if (!engine.state.canPlaceShape(r - anchor.r, c - anchor.c, shape, definition, cells)?.can) continue;
                assert.equal(engine.placeLand(r, c, card, 0, { type: "OFFERING", index }).success, true);
                break placement;
            }
        }
    }
    engine.nextTurn();
}
const index = engine.state.handOffering.findIndex(card => (card?.terrain || card)?.category === "INVESTIGATION");
assert.notEqual(index, -1, "canonical Verse8 Offering must contain Investigation");
const card = engine.state.handOffering[index];
const shownReports = [];
ui.investigationCardPresentationRuntime.component = { show: report => shownReports.push(report) };
const reportsBefore = engine.state.knownEnemyState?.reports?.length || 0;

const mismatch = ui.playCommandCard(card, (index + 1) % engine.state.handOffering.length);
assert.equal(mismatch?.success, false);
assert.equal(mismatch?.reason, "INVESTIGATION_SOURCE_MISMATCH");
assert.equal(engine.state.hasPickedThisTurn, false);
assert.equal(engine.state.knownEnemyState?.reports?.length || 0, reportsBefore);

const result = ui.playCommandCard(card, index);
assert.equal(result?.success, true, `UI Investigation execution failed: ${result?.reason}`);
assert.equal(engine.state.knownEnemyState.reports.length, reportsBefore + 1);
assert.equal(engine.warningStateService.getState(), WARNING_STATES.WATCH);
assert.equal(engine.state.hasPickedThisTurn, true);
assert.notEqual(engine.state.handOffering[index], card);
assert.equal(engine.state.lastInvestigationReport, result.report);
assert.equal(shownReports.length, 1, "production UI dispatch presents exactly one report");
assert.equal(shownReports[0].available, true);
assert.equal(shownReports[0].report.observedAtVerse, 8);

const repeated = ui.playCommandCard(card, index);
assert.equal(repeated?.success, false);
assert.equal(engine.state.knownEnemyState.reports.length, reportsBefore + 1);
console.log("PASS FirstRun Verse8 UI Investigation execution / source rejection / no duplicate report");

// Initial canonical Threat must reach Truth even without a development action.
const undeveloped = GameEngine.createGame({ runSeed: 20261002, firstRun: true });
assert.equal(attachTrialRuntimeSubsystems(undeveloped).success, true);
while (undeveloped.state.turn < 8) undeveloped.nextTurn();
const noLandIndex = undeveloped.state.handOffering.findIndex(card => (card?.terrain || card)?.category === "INVESTIGATION");
assert.notEqual(noLandIndex, -1);
const noLandCard = undeveloped.state.handOffering[noLandIndex];
const noLandUi = new UIController(undeveloped);
noLandUi.render = () => {};
const noFragments = noLandUi.playCommandCard(noLandCard, noLandIndex);
assert.equal(noFragments?.success, true, "undeveloped Verse8 must observe actual initialized enemy truth");
assert.equal(undeveloped.state.hasPickedThisTurn, true);
assert.notEqual(undeveloped.state.handOffering[noLandIndex], noLandCard);
assert.equal(undeveloped.state.knownEnemyState.reports.length, 1);
console.log("PASS undeveloped Verse8 canonical Investigation records actual enemy observations");
