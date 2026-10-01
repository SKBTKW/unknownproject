import assert from "node:assert/strict";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy } from "../game/src/systems/card_runtime_policy.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { serializeGameState } from "../game/src/core/state_serializer_base.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state_base.js";

const festival = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_FESTIVAL");
assert.ok(festival, "Festival must exist in the live command master");
assert.equal(festival.rarity, "C");
assert.equal(festival.offering?.category, "SOCIAL_ACTIVITY");
assert.ok(festival.tags.includes("COMMUNITY"));
assert.equal(festival.maxUsesPerStage, 1);

function makeState(stageId = 1) {
    return {
        turn: 1,
        stage: { id: stageId, name: `Stage ${stageId}`, size: 5, maxTiles: 24 },
        ember: 10,
        maxEmber: 20,
        food: 500,
        wood: 500,
        material: 500,
        mystic: 0,
        warningState: "CALM",
        handOfferingSize: 3,
        handOffering: [],
        offeringCards: [],
        reserveSlots: [null],
        cardCooldowns: {},
        consumedUniqueCards: [],
        usedUniqueCards: [],
        cardStageUsage: {},
        grid: [[{ r: 0, c: 0, placed: false, isHQ: false }]],
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        addLog() {}
    };
}

function makeManager(state) {
    const manager = new DeckManager(state, {});
    attachCardRuntimePolicy(manager);
    return manager;
}

// Stage-scaled costs.
{
    const state = makeState(1);
    const manager = makeManager(state);
    assert.deepEqual(manager.quoteCardExecutionCost(festival).resources, { food: 20, wood: 20 });

    state.stage.id = 2;
    assert.deepEqual(manager.quoteCardExecutionCost(festival).resources, { food: 100, wood: 100 });

    state.stage.id = 3;
    assert.deepEqual(manager.quoteCardExecutionCost(festival).resources, { food: 200, wood: 200 });
}

// Offering gates: outside Warning, Ember <= 10, and current Stage cost affordable.
{
    const state = makeState(1);
    const manager = makeManager(state);

    state.food = 20;
    state.wood = 20;
    state.material = 20;
    assert.equal(manager.isCardEligible(festival, 1, 0), true);

    state.ember = 11;
    assert.equal(manager.isCardEligible(festival, 1, 0), false, "Ember above 10 must hide Festival");

    state.ember = 10;
    state.warningState = "OMEN";
    assert.equal(manager.isCardEligible(festival, 1, 0), false, "Warning phase must hide Festival");

    state.warningState = "CALM";
    state.food = 19;
    assert.equal(manager.isCardEligible(festival, 1, 0), false, "Unaffordable base cost must hide Festival");

    state.stage.id = 2;
    state.food = 99;
    state.wood = 100;
    state.material = 100;
    assert.equal(manager.isCardEligible(festival, 2, 0), false, "Stage 2 must require 5x cost");

    state.food = 100;
    assert.equal(manager.isCardEligible(festival, 2, 0), true);
}

// Effect and one-use-per-Stage lifecycle.
{
    const state = makeState(1);
    state.food = 20;
    state.wood = 20;
    state.material = 20;
    const manager = makeManager(state);

    const result = manager.playCommandCard(festival);
    assert.equal(result.success, true);
    assert.equal(state.food, 0);
    assert.equal(state.wood, 0);
    assert.equal(state.ember, 13);
    assert.equal(state.cardStageUsage?.["1"]?.CMD_FESTIVAL, 1);

    state.ember = 10;
    state.food = 20;
    state.wood = 20;
    state.material = 20;
    assert.equal(manager.isCardEligible(festival, 1, 0), false, "Festival may be used once per Stage");

    state.stage = { id: 2, name: "Stage 2", size: 7, maxTiles: 48 };
    state.food = 100;
    state.wood = 100;
    state.material = 100;
    assert.equal(manager.isCardEligible(festival, 2, 0), true, "A new Stage gets a new Festival use");

    const stage2 = manager.playCommandCard(festival);
    assert.equal(stage2.success, true);
    assert.equal(state.cardStageUsage?.["2"]?.CMD_FESTIVAL, 1);
}

// Per-stage use ledger survives save/restore.
{
    const state = makeState(1);
    state.cardStageUsage = {
        "1": { CMD_FESTIVAL: 1 },
        "2": { CMD_FESTIVAL: 1 }
    };
    const serialized = serializeGameState(state);
    assert.deepEqual(serialized.cardStageUsage, state.cardStageUsage);

    const restored = {};
    hydrateGameState(restored, serialized, {
        resolveCardMaster: id => COMMAND_CARDS_MASTER.find(card => card.id === id) || null
    });
    assert.deepEqual(restored.cardStageUsage, state.cardStageUsage);
}

console.log("✅ Festival card Offering / cost / recovery / per-stage lifecycle contracts PASS");
