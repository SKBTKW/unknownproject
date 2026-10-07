import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    SPECIAL_BLOCK_TYPES
} from "../game/src/core/special_block_domain.js";
import {
    resolveSpecialBlockDevelopmentModifiers
} from "../game/src/core/special_block_development_domain.js";
import { resolveSpecialBlockProduction } from "../game/src/core/special_block_production.js";
import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { ECONOMY_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { DefenseSystem } from "../game/src/systems/defense_system.js";
import {
    attachCardRuntimePolicy,
    isCardRuntimeActive
} from "../game/src/systems/card_runtime_policy.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { I18n } from "../game/src/i18n.js";

const card = ECONOMY_CARDS_MASTER.find(candidate => candidate.id === "CMD_SITE_DEVELOPMENT");
const sourceCard = JSON.parse(
    readFileSync(new URL("../game/src/data/economy_cards.json", import.meta.url), "utf8")
).find(candidate => candidate.id === "CMD_SITE_DEVELOPMENT");

function makeCell(r, c) {
    return {
        r,
        c,
        placed: true,
        isHQ: false,
        terrain: { id: "GL1_PLAINS", terrainId: "GL1_PLAINS", e: 1, gl: 1 },
        specialBlock: null,
        placementGroupId: null,
        mergeGroupId: null,
        merged: false,
        mergeType: null,
        searched: false,
        hasSocket: false,
        socketResource: null
    };
}

function setup({ food = 150, wood = 150 } = {}) {
    const size = 5;
    const grid = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => makeCell(r, c))
    );
    const state = {
        turn: 8,
        stage: { id: 1, name: "Stage 1", size, maxTiles: size * size },
        food,
        wood,
        material: wood,
        defense: 5,
        currentDefense: 5,
        maxDefense: 5,
        defenseCapacityBonus: 0,
        permanentVicinityDefenseBonus: 0,
        mystic: 0,
        ember: 20,
        maxEmber: 20,
        warningState: "CALM",
        grid,
        mergedBlocks: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        reserveSlots: [null],
        handOffering: [card],
        handOfferingSize: 3,
        activeBuffs: [],
        usedUniqueCards: [],
        consumedUniqueCards: [],
        cardStageUsage: {},
        cardCooldowns: {},
        placedBlockProduction: {},
        logs: [],
        addLog(message) { this.logs.push(message); },
        addBuff(buff) { this.activeBuffs.push(buff); }
    };

    grid[0][0].specialBlock = {
        instanceId: "FARM@0:0",
        type: SPECIAL_BLOCK_TYPES.FARM,
        definitionId: SPECIAL_BLOCK_TYPES.FARM,
        state: "ACTIVE"
    };
    grid[0][1].specialBlock = {
        instanceId: "WATCHTOWER@0:1",
        type: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        definitionId: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        state: "ACTIVE"
    };
    grid[0][2].specialBlock = {
        instanceId: "BARRACKS@0:2",
        type: SPECIAL_BLOCK_TYPES.BARRACKS,
        definitionId: SPECIAL_BLOCK_TYPES.BARRACKS,
        state: "ACTIVE",
        footprint: [{ r: 0, c: 2 }, { r: 0, c: 3 }]
    };
    grid[0][3].specialBlock = {
        ...grid[0][2].specialBlock,
        footprint: [{ r: 0, c: 2 }, { r: 0, c: 3 }]
    };

    const board = new BoardDomainAdapter({ state });
    const engine = { state, boardDomainAdapter: board };
    const defenseSystem = new DefenseSystem(state);
    state.defenseSystem = defenseSystem;
    engine.defenseSystem = defenseSystem;
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

    const deck = new DeckManager(state, engine);
    deck.cycleSystem = null;
    engine.deckManager = deck;
    attachCardRuntimePolicy(deck);

    return { state, board, engine, deck, defenseSystem };
}

function withOptions(baseCard, optionIds) {
    return {
        ...baseCard,
        effects: baseCard.effects.map(effect => ({
            ...effect,
            selectedOptionIds: [...optionIds]
        }))
    };
}

let count = 0;
function test(name, fn) {
    fn();
    count++;
    console.log(`  ✅ [${count}] ${name}`);
}

console.log("\n🧪 Running Site Development card v1 tests...");

test("card data matches Economy JSON SSOT and is runtime active", () => {
    assert.ok(card);
    assert.deepEqual(card, sourceCard);
    assert.equal(card.minStage, 1);
    assert.equal(card.rarity, "UC");
    assert.equal(card.weight, 0.25);
    assert.deepEqual(card.cost, { food: 50, wood: 50 });
    assert.equal(card.cyclePolicy, "RARITY");
    assert.equal(card.effects.length, 1);
    assert.equal(card.effects[0].action, "APPLY_SPECIAL_BLOCK_DEVELOPMENT");
    assert.equal(card.effects[0].developmentDefinitionId, "BASIC_SITE_DEVELOPMENT");
    assert.equal(card.effects[0].selection.exactCount, 2);
    assert.equal(card.effects[0].selection.options.length, 4);
    assert.equal(isCardRuntimeActive(card), true);
});

test("Offering requires affordability and at least one eligible civilian Special Block instance", () => {
    const { state, deck } = setup();
    assert.equal(deck.isCardEligible(card, 1), true);

    state.food = 49;
    assert.equal(deck.isCardEligible(card, 1), false, "food shortfall hides card");
    state.food = 150;
    state.wood = state.material = 49;
    assert.equal(deck.isCardEligible(card, 1), false, "material shortfall hides card");

    state.wood = state.material = 150;
    state.grid[0][0].specialBlock.state = "DYSFUNCTIONAL";
    assert.equal(
        deck.isCardEligible(card, 1),
        false,
        "Watchtower and Barracks cannot keep civilian Site Development eligible"
    );
});

test("execution target enumeration includes civilian footprint cells and excludes Trial-causality facilities", () => {
    const { deck } = setup();
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.ok(targets.some(target => target.instanceId === "FARM@0:0" && target.r === 0 && target.c === 0));
    assert.equal(targets.some(target => target.instanceId === "WATCHTOWER@0:1"), false);
    assert.equal(targets.some(target => target.instanceId === "BARRACKS@0:2"), false);
});

test("2 selected effects apply atomically with 50/50 payment and defense one-shot recovery", () => {
    const { state, deck, defenseSystem } = setup();
    const selectedCard = withOptions(card, ["FOOD_YIELD", "DEFENSE_CAPACITY"]);
    const target = deck.enumerateCardExecutionTargets(selectedCard)
        .find(candidate => candidate.instanceId === "FARM@0:0");
    assert.ok(target);

    const beforeMax = defenseSystem.getMaxDefense();
    const beforeCurrent = defenseSystem.getCurrentDefense();
    const result = deck.playCommandCard(selectedCard, target, 0, -1);
    assert.equal(result.success, true);

    assert.equal(state.food, 100);
    assert.equal(state.wood, 100);
    assert.equal(state.material, 100);
    assert.equal(defenseSystem.getMaxDefense(), beforeMax + 1);
    assert.equal(defenseSystem.getCurrentDefense(), Math.min(beforeCurrent + 1, beforeMax + 1));

    const record = state.grid[0][0].specialBlock.developments.BASIC;
    assert.deepEqual(record.optionIds, ["DEFENSE_CAPACITY", "FOOD_YIELD"]);
    assert.equal(record.definitionId, "BASIC_SITE_DEVELOPMENT");
    assert.equal(record.appliedStage, 1);
    assert.equal(record.appliedVerse, 8);

    const modifiers = resolveSpecialBlockDevelopmentModifiers(state, "FARM@0:0");
    assert.equal(modifiers.defenseCapacityBonus, 1);
    assert.deepEqual(modifiers.yields, { food: 2, wood: 0, defense: 0, mystic: 0 });

    const production = resolveSpecialBlockProduction(state, state.grid[0][0], { r: 0, c: 0 });
    assert.equal(production.developmentYields.food, 2);
    assert.equal(production.developmentYields.defense, 0);

    assert.equal(state.handOffering[0].isBlank, true);
    assert.equal(state.hasPickedThisTurn, true);
});

test("invalid selection and tactical target fail before payment", () => {
    const { state, deck } = setup();
    const duplicateCard = withOptions(card, ["FOOD_YIELD", "FOOD_YIELD"]);
    const civilian = deck.enumerateCardExecutionTargets(card)
        .find(candidate => candidate.instanceId === "FARM@0:0");

    const before = { food: state.food, wood: state.wood, material: state.material };
    const duplicate = deck.playCommandCard(duplicateCard, civilian, 0, -1);
    assert.equal(duplicate.success, false);
    assert.equal(duplicate.reason, "DEVELOPMENT_OPTIONS_MUST_BE_DISTINCT");
    assert.deepEqual(
        { food: state.food, wood: state.wood, material: state.material },
        before
    );
    assert.equal(state.grid[0][0].specialBlock.developments, undefined);

    const validCard = withOptions(card, ["FOOD_YIELD", "MYSTIC_YIELD"]);
    const tacticalTarget = {
        r: 0,
        c: 1,
        instanceId: "WATCHTOWER@0:1"
    };
    const tactical = deck.playCommandCard(validCard, tacticalTarget, 0, -1);
    assert.equal(tactical.success, false);
    assert.equal(tactical.reason, "TACTICAL_SPECIAL_BLOCK_EXCLUDED");
    assert.deepEqual(
        { food: state.food, wood: state.wood, material: state.material },
        before
    );
});

test("occupied BASIC layer is revalidated and cannot consume another card payment", () => {
    const { state, deck } = setup();
    const firstCard = withOptions(card, ["FOOD_YIELD", "MYSTIC_YIELD"]);
    const target = deck.enumerateCardExecutionTargets(firstCard)
        .find(candidate => candidate.instanceId === "FARM@0:0");
    assert.equal(deck.playCommandCard(firstCard, target, -1, -1).success, true);
    assert.equal(state.food, 100);
    assert.equal(state.wood, 100);

    state.hasPickedThisTurn = false;
    const secondCard = withOptions(card, ["FOOD_YIELD", "MATERIAL_YIELD"]);
    const before = { food: state.food, wood: state.wood, material: state.material };
    const second = deck.playCommandCard(secondCard, target, -1, -1);
    assert.equal(second.success, false);
    assert.equal(second.reason, "DEVELOPMENT_LAYER_OCCUPIED");
    assert.deepEqual(
        { food: state.food, wood: state.wood, material: state.material },
        before
    );
});

test("generic UI multi-option selection canonically writes 2 choices and fails closed without selector UI", () => {
    const target = { r: 0, c: 0, instanceId: "FARM@0:0" };
    let playedCard = null;
    let playedTarget = null;
    const ui = {
        getPendingCommandEffectSelection: UIController.prototype.getPendingCommandEffectSelection,
        withCommandEffectSelection: UIController.prototype.withCommandEffectSelection,
        promptCommandEffectSelection: UIController.prototype.promptCommandEffectSelection,
        onCommandEffectSelectionPrompt(options, exactCount) {
            assert.equal(options.length, 4);
            assert.equal(exactCount, 2);
            return ["MYSTIC_YIELD", "FOOD_YIELD"];
        },
        playCommandCard(selectedCard, _cardIdx, selectedTarget) {
            playedCard = selectedCard;
            playedTarget = selectedTarget;
            return { success: true };
        }
    };

    const pending = UIController.prototype.getPendingCommandEffectSelection.call(ui, card);
    assert.ok(pending);
    const result = UIController.prototype.promptCommandEffectSelection.call(
        ui,
        card,
        0,
        target,
        pending
    );
    assert.equal(result.success, true);
    assert.deepEqual(
        playedCard.effects[0].selectedOptionIds,
        ["FOOD_YIELD", "MYSTIC_YIELD"]
    );
    assert.deepEqual(playedTarget, target);

    const failClosedUi = {
        getPendingCommandEffectSelection: UIController.prototype.getPendingCommandEffectSelection,
        withCommandEffectSelection: UIController.prototype.withCommandEffectSelection,
        promptCommandEffectSelection: UIController.prototype.promptCommandEffectSelection,
        playCommandCard() {
            throw new Error("must not execute without a safe selector");
        }
    };
    const unavailable = UIController.prototype.promptCommandEffectSelection.call(
        failClosedUi,
        card,
        0,
        target,
        UIController.prototype.getPendingCommandEffectSelection.call(failClosedUi, card)
    );
    assert.equal(unavailable.success, false);
    assert.equal(unavailable.reason, "COMMAND_EFFECT_SELECTION_UI_UNAVAILABLE");
});

test("Site Development localization exists for card, selection, and all four options", () => {
    for (const key of [
        "CMD_SITE_DEVELOPMENT_NAME",
        "CMD_SITE_DEVELOPMENT_DESC",
        "UI_SITE_DEVELOPMENT_SELECT_TITLE",
        "UI_SITE_DEVELOPMENT_SELECT_DESC",
        "UI_SITE_DEVELOPMENT_CONFIRM_TITLE",
        "SITE_DEVELOPMENT_OPTION_FOOD",
        "SITE_DEVELOPMENT_OPTION_MATERIAL",
        "SITE_DEVELOPMENT_OPTION_MYSTIC",
        "SITE_DEVELOPMENT_OPTION_DEFENSE"
    ]) {
        assert.ok(I18n.t(key), key);
    }
});

console.log(`test_site_development_card_v1: PASS (${count} cases)`);
