import assert from "node:assert/strict";
import { GameEngine, UIController } from "../game/src/app.js";

const engine = GameEngine.createGame({ runSeed: 20261002, firstRun: true });
const ui = new UIController(engine);
// Headless rendering only; the UI execution boundary and Domain remain live.
ui.render = () => {};
while (engine.state.turn < 8) engine.nextTurn();
const index = engine.state.handOffering.findIndex(card => (card?.terrain || card)?.category === "INVESTIGATION");
assert.notEqual(index, -1, "canonical Verse8 Offering must contain Investigation");
const card = engine.state.handOffering[index];
const reportsBefore = engine.state.knownEnemyState?.reports?.length || 0;

const mismatch = ui.playCommandCard(card, (index + 1) % engine.state.handOffering.length);
assert.equal(mismatch?.success, false);
assert.equal(mismatch?.reason, "INVESTIGATION_SOURCE_MISMATCH");
assert.equal(engine.state.hasPickedThisTurn, false);
assert.equal(engine.state.knownEnemyState?.reports?.length || 0, reportsBefore);

const result = ui.playCommandCard(card, index);
// An undeveloped board currently has no observable fragments. This is a
// separate Domain issue; the UI must preserve that rejection instead of
// sending Investigation through legacy Command execution.
assert.equal(result?.success, false);
assert.equal(result?.reason, "NO_OBSERVABLE_FRAGMENTS");
assert.equal(engine.state.knownEnemyState.reports.length, reportsBefore);
assert.equal(engine.state.hasPickedThisTurn, false);
assert.equal(engine.state.handOffering[index], card);
console.log("PASS FirstRun Verse8 UI Investigation source/no-fragment rejection preserves card and action");
