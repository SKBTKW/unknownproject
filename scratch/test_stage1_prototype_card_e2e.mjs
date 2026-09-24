import assert from "node:assert/strict";

import { GameEngine } from "../game/src/core/game_engine.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";

const IDS = Object.freeze([
    "CMD_EMERGENCY_LEVY",
    "CMD_VIGILANCE",
    "CMD_REKINDLE_EMBER"
]);

function definition(id) {
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate?.id === id);
    assert.ok(card, `${id} must exist in command card master`);
    return card;
}

function createPrototypeEngine(id, seed) {
    const engine = GameEngine.createGame({
        runSeed: seed,
        cardRuntimeActivationProvider: () => ({
            activeCardIds: [id]
        })
    });
    engine.deckManager._landCardMasterCache = [definition(id)];
    engine.state.handOffering = [];
    engine.state.offeringCards = [];
    engine.state.cardCooldowns = {};
    engine.state.hasPickedThisTurn = false;
    engine.state.hasReservedThisTurn = false;
    engine.state.hasMulliganedThisTurn = false;
    return engine;
}

function offeringMasterId(card) {
    return card?.cardMasterId || card?.terrain?.id || card?.id || null;
}

function generateOnlyPrototype(engine, id) {
    const offering = engine.deckManager.generateOfferingCards();
    const offered = offering.find(card => offeringMasterId(card) === id) || null;
    assert.ok(offered, `${id} must enter an actual Offering when its eligibility conditions are met`);
    assert.equal(
        offering.filter(card => offeringMasterId(card) === id).length,
        1,
        `${id} must not duplicate inside one Offering`
    );
    return offered;
}

console.log("\nStage1 prototype cards: Offering -> payment -> effect -> Verse progression");

{
    const id = "CMD_EMERGENCY_LEVY";
    const card = definition(id);
    const engine = createPrototypeEngine(id, 2026092401);
    const state = engine.state;

    state.food = 50;
    state.wood = 20;
    state.material = 20;

    assert.equal(engine.deckManager.isCardEligible(card, 1, 0), true);
    generateOnlyPrototype(engine, id);

    const before = { food: state.food, wood: state.wood };
    const played = state.playCommandCard(card);
    assert.equal(played.success, true);
    assert.equal(state.food, before.food - 20, "Levy must pay 🌾20");
    assert.equal(state.wood, before.wood + 15, "Levy must gain 🧱15 after payment");
    assert.equal(state.hasPickedThisTurn, true);

    const turnBefore = state.turn;
    const next = engine.nextTurn();
    assert.notEqual(next?.success, false);
    assert.equal(state.turn, turnBefore + 1);
    assert.equal(state.hasPickedThisTurn, false);
    assert.equal(state.emergencyLevyTurns || 0, 0, "current Levy must not add a hidden upkeep penalty");

    const blocked = createPrototypeEngine(id, 2026092402);
    blocked.state.food = 19;
    blocked.state.wood = 20;
    blocked.state.material = 20;
    assert.equal(blocked.deckManager.isCardEligible(card, 1, 0), false);
    const blockedSnapshot = { food: blocked.state.food, wood: blocked.state.wood };
    assert.equal(blocked.state.playCommandCard(card).success, false);
    assert.deepEqual(
        { food: blocked.state.food, wood: blocked.state.wood },
        blockedSnapshot,
        "failed Levy must not mutate resources"
    );
}

{
    const id = "CMD_VIGILANCE";
    const card = definition(id);
    const engine = createPrototypeEngine(id, 2026092403);
    const state = engine.state;

    state.wood = 30;
    state.material = 30;
    state.currentDefense = Math.min(5, state.maxDefense || 5);

    assert.equal(engine.deckManager.isCardEligible(card, 1, 0), true);
    generateOnlyPrototype(engine, id);

    const maxBefore = state.getMaxDefense();
    const played = state.playCommandCard(card);
    assert.equal(played.success, true);
    assert.equal(state.wood, 15, "Vigilance must pay 🧱15");
    assert.equal(state.vigilanceTurns, 2);
    assert.equal(state.vigilanceStartsNextTurn, true);
    assert.equal(state.getMaxDefense(), maxBefore, "Vigilance bonus must not start on the activation Verse");

    const turnBefore = state.turn;
    const next = engine.nextTurn();
    assert.notEqual(next?.success, false);
    assert.equal(state.turn, turnBefore + 1);
    assert.equal(state.vigilanceStartsNextTurn, false);
    assert.equal(state.vigilanceTurns, 2, "first transition arms the 2-Verse duration without consuming it");
    assert.equal(state.getMaxDefense(), maxBefore + 3, "armed Vigilance must raise the defense ceiling by +3");

    const blocked = createPrototypeEngine(id, 2026092404);
    blocked.state.wood = 14;
    blocked.state.material = 14;
    const snapshot = { wood: blocked.state.wood, turns: blocked.state.vigilanceTurns };
    const denied = blocked.state.playCommandCard(card);
    assert.equal(denied.success, false);
    assert.deepEqual(
        { wood: blocked.state.wood, turns: blocked.state.vigilanceTurns },
        snapshot,
        "failed Vigilance payment must not arm the buff"
    );
}

{
    const id = "CMD_REKINDLE_EMBER";
    const card = definition(id);
    const engine = createPrototypeEngine(id, 2026092405);
    const state = engine.state;

    state.mystic = 10;
    state.ember = 5;
    state.reserveSlots = [{ id: "prototype_hold", isBlank: false }];

    assert.equal(engine.deckManager.isCardEligible(card, 1, 0), true);
    generateOnlyPrototype(engine, id);

    const played = state.playCommandCard(card);
    assert.equal(played.success, true);
    assert.equal(state.mystic, 0, "Rekindle must pay ✨10");
    assert.equal(state.ember, 8, "Rekindle must restore 🔥+3");
    assert.equal(state.reserveFeeWaivedTurns || 0, 0,
        "Rekindle v1 must not create a reserve-upkeep waiver");
    assert.equal(Boolean(state.reserveFeeWaivedStartsNextTurn), false,
        "Rekindle v1 must remain immediate-only");

    const turnBefore = state.turn;
    const emberBeforeNext = state.ember;
    const next = engine.nextTurn();
    assert.notEqual(next?.success, false);
    assert.equal(state.turn, turnBefore + 1);
    assert.equal(Boolean(state.reserveFeeWaivedStartsNextTurn), false);
    assert.equal(state.reserveFeeWaivedTurns || 0, 0);
    assert.equal(
        state.ember,
        emberBeforeNext - 2,
        "without a Rekindle waiver, the normal Verse cost plus held-card reserve fee must apply"
    );

    const hidden = createPrototypeEngine(id, 2026092406);
    hidden.state.mystic = 10;
    hidden.state.ember = 6;
    assert.equal(
        hidden.deckManager.isCardEligible(card, 1, 0),
        false,
        "Rekindle must stay out of Offering above the current low-Ember threshold"
    );

    const blocked = createPrototypeEngine(id, 2026092407);
    blocked.state.mystic = 9;
    blocked.state.ember = 5;
    const snapshot = { mystic: blocked.state.mystic, ember: blocked.state.ember };
    const denied = blocked.state.playCommandCard(card);
    assert.equal(denied.success, false);
    assert.deepEqual(
        { mystic: blocked.state.mystic, ember: blocked.state.ember },
        snapshot,
        "failed Rekindle payment must not mutate resources"
    );
}

{
    const production = GameEngine.createGame({ runSeed: 2026092499 });
    for (const id of IDS) {
        assert.equal(
            production.deckManager.isCardEligible(definition(id), 1, 0),
            false,
            `production-default runtime must keep ${id} dormant`
        );
    }
}

console.log("  CMD_EMERGENCY_LEVY: Offering + 🌾 payment + 🧱 conversion + next Verse PASS");
console.log("  CMD_VIGILANCE: Offering + 🧱 payment + delayed defense buff PASS");
console.log("  CMD_REKINDLE_EMBER: Offering + ✨ payment + 🔥 recovery + no persistent waiver PASS");
console.log("  production default remains dormant for all 3");
console.log("✅ Stage1 prototype card E2E PASS");
