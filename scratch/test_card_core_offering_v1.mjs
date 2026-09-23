import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DeckManager } from "../game/src/systems/deck_manager.js";
import { GameEngine } from "../game/src/core/game_engine.js";
import { UIController } from "../game/src/ui/ui_controller.js";
import { DefenseSystem } from "../game/src/systems/defense_system.js";
import { normalizeCardDefinitionV1 } from "../game/src/cards/card_definition_v1.js";
import { LandPlacementAvailabilityQuery } from "../game/src/cards/land_placement_availability_query.js";
import { CardOfferingEligibilityService } from "../game/src/cards/card_offering_eligibility_service.js";
import { CardExecutionRequirementService } from "../game/src/cards/card_execution_requirement_service.js";
import { pickWeightedCard } from "../game/src/cards/offering_weight_policy.js";
import {
    adaptLegacyOfferingRequirements,
    evaluateLegacyOfferingRequirements
} from "../game/src/cards/legacy_offering_requirement_adapter.js";
import { CardEffectHandlerRouter } from "../game/src/cards/card_effect_handler_router.js";
import { CARD_EFFECT_TYPES, CardEffectExecutor } from "../game/src/cards/card_effect_executor.js";
import {
    CARD_DOMAIN_ACTIONS,
    createCardDomainActionExecutor
} from "../game/src/cards/card_domain_action_executor.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import {
    LEGACY_COMMAND_EXECUTION_CLASS,
    DOMAIN_ACTION_OWNER,
    DOMAIN_ACTION_OWNER_BY_ID,
    CURRENT_SSOT_LOCAL_IDS,
    DOMAIN_ACTION_REQUIRED_IDS,
    LEGACY_ONLY_IDS,
    DUPLICATE_LEGACY_BRANCH_IDS,
    LEGACY_SHADOWED_BRANCH_IDS,
    classifyLegacyCommandExecution,
    resolveDomainActionOwner
} from "../game/src/cards/legacy_command_execution_inventory.js";

function makeGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({})));
}

// A. Legacy card definitions normalize without requiring a bulk master migration.
{
    const legacy = {
        id: "LAND_LEGACY",
        category: "LAND",
        rarity: "R",
        tags: ["TEST"],
        minStage: 2,
        weight: 0.25,
        nameKey: "LAND_LEGACY_NAME",
        offering: { requirements: [{ type: "FLAG", key: "omen" }] },
        execution: { requirements: [{ type: "RESOURCE", key: "wood", min: 3 }] }
    };
    const v1 = normalizeCardDefinitionV1(legacy);
    assert.equal(v1.schemaVersion, 1);
    assert.equal(v1.id, legacy.id);
    assert.equal(v1.lifecycle.minStage, 2);
    assert.equal(v1.offering.weight, 0.25);
    assert.equal(v1.offering.requirements.length, 1);
    assert.equal(v1.execution.requirements.length, 1);
    assert.equal(v1.legacy, legacy);
}

// B. LAND availability asks the Placement Domain and checks rotations.
{
    const state = {
        grid: makeGrid(2, 1),
        canPlaceShape(startR, startC, shape) {
            const occupied = [];
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (shape[r][c] === 1) occupied.push([startR + r, startC + c]);
                }
            }
            const inside = occupied.every(([r, c]) => r >= 0 && r < 2 && c >= 0 && c < 1);
            return { can: inside && occupied.length === 2 };
        }
    };
    const query = new LandPlacementAvailabilityQuery(state);
    assert.equal(query.hasAnyLegalPlacement({
        id: "LAND_1X2",
        category: "LAND",
        shape: [[1, 1]],
        anchor: { r: 0, c: 0 }
    }), true, "1x2 card must become eligible when its rotated 2x1 geometry is legal");
    assert.equal(query.hasAnyLegalPlacement({
        id: "LAND_3X1",
        category: "LAND",
        shape: [[1], [1], [1]]
    }), false, "LAND with no legal placement in any rotation must be rejected");
}

// C. Offering requirements and execution requirements are independent paths.
{
    const state = {
        omen: true,
        wood: 0,
        grid: makeGrid(1, 1),
        canPlaceShape: () => ({ can: true })
    };
    const offering = new CardOfferingEligibilityService({
        state,
        placementQuery: new LandPlacementAvailabilityQuery(state),
        requirementEvaluator: requirement => requirement.type !== "OMEN" || state.omen === true
    });
    const execution = new CardExecutionRequirementService({
        evaluator: requirement => requirement.type !== "WOOD" || state.wood >= requirement.min
    });
    const card = {
        id: "LAND_SPLIT_REQUIREMENTS",
        category: "LAND",
        shape: [[1]],
        offering: { requirements: [{ id: "OMEN_REQUIRED", type: "OMEN" }] },
        execution: { requirements: [{ id: "WOOD_REQUIRED", type: "WOOD", min: 1 }] }
    };

    assert.equal(offering.evaluate(card).eligible, true, "Offering eligibility can be true");
    assert.equal(execution.evaluate(normalizeCardDefinitionV1(card)).canExecute, false,
        "Execution legality may independently become false");
}

// D. Stage-3 fallback must not resurrect a LAND with no legal placement.
{
    const blocked = {
        id: "LAND_BLOCKED",
        category: "LAND",
        rarity: "C",
        minStage: 1,
        weight: 1,
        cyclePolicy: "LAND_STANDARD",
        shape: [[1]]
    };
    const state = {
        turn: 1,
        stage: { id: 1 },
        handOfferingSize: 1,
        reserveSlots: [],
        grid: makeGrid(1, 1),
        canPlaceShape: () => ({ can: false })
    };
    const manager = new DeckManager(state, {});
    manager.getLandCardMaster = () => [blocked];
    manager.cycleSystem = null;

    const offering = manager.generateOfferingCards();
    assert.deepEqual(offering, [], "fallback must not bypass LAND placement legality");
}

// E. Weighted selection uses one shared policy and remains deterministic.
{
    const cards = [
        { id: "A", category: "LAND", weight: 1 },
        { id: "B", category: "LAND", weight: 3 }
    ];
    assert.equal(pickWeightedCard(cards, {}, () => 0).id, "A");
    assert.equal(pickWeightedCard(cards, {}, () => 0.99).id, "B");
}

// F. Legacy req* fields adapt into Offering requirements without changing semantics.
{
    const legacy = {
        id: "LEGACY_REQUIREMENTS",
        reqE2HillsOnBoard: 2,
        reqHillOrMountain: true,
        reqWetland: 1,
        reqDiscoveredResourceTags: ["STONE", "IRON"],
        reqConnectedPlains: 4,
        reqEmptyCells: 3,
        maxPlacedBlocks: 8
    };
    const requirements = adaptLegacyOfferingRequirements(legacy, { h2Count: 2 });
    assert.ok(requirements.some(req => req.type === "LEGACY_E2_HILLS_AT_LEAST"));
    assert.ok(requirements.some(req => req.type === "HAS_HILL_OR_MOUNTAIN"));
    assert.ok(requirements.some(req => req.type === "HAS_WETLAND" && req.value === 1));
    assert.equal(requirements.filter(req => req.type === "SOCKET_FOUND").length, 2);
    assert.ok(requirements.some(req => req.type === "CONNECTED_TERRAIN_AT_LEAST" && req.terrainType === "PLAINS"));
    assert.ok(requirements.some(req => req.type === "EMPTY_CELLS_AT_LEAST"));
    assert.ok(requirements.some(req => req.type === "LEGACY_BOARD_PLACED_BLOCKS_AT_MOST"));

    const fakeConditionEvaluator = {
        evaluate(requirement) {
            return requirement.type !== "HAS_WETLAND";
        }
    };
    assert.equal(
        evaluateLegacyOfferingRequirements(legacy, { state: {}, h2Count: 2 }, fakeConditionEvaluator).eligible,
        false,
        "legacy adapter must fail on the same ConditionEvaluator-backed requirement"
    );
    assert.equal(
        evaluateLegacyOfferingRequirements(legacy, { state: null, h2Count: 2 }, fakeConditionEvaluator).eligible,
        true,
        "stateless synthetic callers preserve legacy board-check skip behavior"
    );
    assert.equal(
        evaluateLegacyOfferingRequirements(legacy, { state: null, h2Count: 1 }, fakeConditionEvaluator).eligible,
        false,
        "h2Count gate remains state-independent like the legacy implementation"
    );
}

// G. Legacy resource/timing fields preserve their previous Offering semantics.
{
    const evaluator = { evaluate: () => true };
    const state = {
        turn: 19,
        nextTrialTurn: 25,
        food: 50,
        wood: 10,
        mystic: 4,
        ember: 6,
        getTrialNotice: () => ({ active: false }),
        getFoodUpkeep: () => 20
    };

    assert.equal(evaluateLegacyOfferingRequirements({ reqStage2End: true }, { state }, evaluator).eligible, false);
    state.turn = 20;
    assert.equal(evaluateLegacyOfferingRequirements({ reqStage2End: true }, { state }, evaluator).eligible, true);

    assert.equal(evaluateLegacyOfferingRequirements({ reqWood: 15 }, { state }, evaluator).eligible, false);
    assert.equal(evaluateLegacyOfferingRequirements({ reqFood: 40 }, { state }, evaluator).eligible, true);
    assert.equal(evaluateLegacyOfferingRequirements({ reqMystic: 5 }, { state }, evaluator).eligible, false);
    assert.equal(evaluateLegacyOfferingRequirements({ maxEmber: 5 }, { state }, evaluator).eligible, false);

    assert.equal(evaluateLegacyOfferingRequirements({ reqTrialNotice: true }, { state }, evaluator).eligible, true,
        "T20 with next Trial T25 satisfies the legacy <=5 notice fallback");
    assert.equal(evaluateLegacyOfferingRequirements({ reqTrialWithin: 4 }, { state }, evaluator).eligible, false);
    assert.equal(evaluateLegacyOfferingRequirements({ reqTrialWithin: 5 }, { state }, evaluator).eligible, true);

    assert.equal(evaluateLegacyOfferingRequirements({ reqFoodDeficitOrFallback: true }, { state }, evaluator).eligible, false);
    state.food = 40;
    assert.equal(evaluateLegacyOfferingRequirements({ reqFoodDeficitOrFallback: true }, { state }, evaluator).eligible, true);
    assert.equal(evaluateLegacyOfferingRequirements({ reqWoodDeficit: true }, { state }, evaluator).eligible, true);
    state.wood = 31;
    assert.equal(evaluateLegacyOfferingRequirements({ reqWoodDeficit: true }, { state }, evaluator).eligible, false);
}

// H. DeckManager consumes board facts through the injectable Board Query boundary.
{
    const state = {
        turn: 1,
        stage: { id: 1 },
        reserveSlots: [],
        activeBuffs: []
    };
    const legacyNoGridManager = new DeckManager(state, {});
    legacyNoGridManager.cycleSystem = null;
    assert.equal(
        legacyNoGridManager.isCardEligible({ id: "CMD_QUERY_LEGACY_NO_GRID", category: "COMMAND", reqOreSocket: true }, 1, 0),
        true,
        "legacy state-backed query preserves the old no-grid eligibility skip"
    );

    const blockedManager = new DeckManager(state, {
        cardOfferingBoardQuery: {
            hasOreSocket: () => false
        }
    });
    blockedManager.cycleSystem = null;
    assert.equal(
        blockedManager.isCardEligible({ id: "CMD_QUERY_BLOCKED", category: "COMMAND", reqOreSocket: true }, 1, 0),
        false,
        "injected Board Query may reject a board-dependent Offering candidate"
    );

    const allowedManager = new DeckManager(state, {
        cardOfferingBoardQuery: {
            hasOreSocket: () => true
        }
    });
    allowedManager.cycleSystem = null;
    assert.equal(
        allowedManager.isCardEligible({ id: "CMD_QUERY_ALLOWED", category: "COMMAND", reqOreSocket: true }, 1, 0),
        true,
        "DeckManager must not rescan grid when Board Query already answers the requirement"
    );
}

// I. Card Effect Handler Router is opt-in; unregistered cards remain on legacy fallback.
{
    let routedCalls = 0;
    const router = new CardEffectHandlerRouter({
        CMD_ROUTED_TEST: ({ state }) => {
            routedCalls++;
            state.routedEffectApplied = true;
            return { success: true, marker: "ROUTED" };
        }
    });
    assert.equal(router.has("CMD_ROUTED_TEST"), true);
    assert.equal(router.execute({ id: "CMD_UNKNOWN" }).handled, false);

    const state = {
        turn: 1,
        food: 0,
        wood: 0,
        material: 0,
        mystic: 0,
        ember: 0,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        addLog() {}
    };
    const manager = new DeckManager(state, { cardEffectHandlerRouter: router });
    manager.cycleSystem = null;

    const routed = manager.playCommandCard({
        id: "CMD_ROUTED_TEST",
        category: "COMMAND",
        nameKey: "CMD_ROUTED_TEST_NAME",
        cost: {}
    });
    assert.equal(routed.success, true);
    assert.equal(routed.marker, "ROUTED");
    assert.equal(state.routedEffectApplied, true);
    assert.equal(routedCalls, 1);

    const legacyFallback = manager.playCommandCard({
        id: "CMD_UNREGISTERED_TEST",
        category: "COMMAND",
        nameKey: "CMD_UNREGISTERED_TEST_NAME",
        cost: {}
    });
    assert.equal(legacyFallback.success, true,
        "unregistered command cards must continue through the legacy fallback path");
}

// J. Authored Card Definition v1 effects execute without adding DeckManager ID branches.
{
    const state = {
        turn: 1,
        food: 0,
        wood: 2,
        material: 2,
        mystic: 0,
        ember: 0,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog() {}
    };
    const manager = new DeckManager(state, {});
    manager.cycleSystem = null;

    const result = manager.playCommandCard({
        id: "CMD_DECLARATIVE_EFFECT_TEST",
        category: "COMMAND",
        nameKey: "CMD_DECLARATIVE_EFFECT_TEST_NAME",
        cost: {},
        effects: [
            { type: CARD_EFFECT_TYPES.RESOURCE_DELTA, resource: "wood", amount: 5 },
            { type: CARD_EFFECT_TYPES.STATE_SET, key: "guidedDefenseActive", value: true },
            { type: CARD_EFFECT_TYPES.STATE_INCREMENT, key: "testCounter", amount: 2 },
            {
                type: CARD_EFFECT_TYPES.BUFF_ADD,
                buff: { id: "CMD_DECLARATIVE_EFFECT_TEST", category: "CARD_EFFECT" }
            },
            {
                type: CARD_EFFECT_TYPES.DRAW_BIAS_SET,
                bias: { targetCategory: "LAND", type: "TURNS", remainingTurns: 1 }
            },
            {
                type: CARD_EFFECT_TYPES.PROJECT_ADD,
                project: { name: "TEST_PROJECT", remainingTurns: 2 }
            }
        ]
    });

    assert.equal(result.success, true);
    assert.equal(state.wood, 7);
    assert.equal(state.material, 2, "resource delta mutates only the authored resource");
    assert.equal(state.guidedDefenseActive, true);
    assert.equal(state.testCounter, 2);
    assert.equal(state.activeBuffs.length, 1);
    assert.equal(state.activeDrawBias.targetCategory, "LAND");
    assert.equal(state.activeConstructionProjects[0].name, "TEST_PROJECT");
}

// K. DOMAIN_ACTION stays delegated to the owning domain instead of mutating board/world here.
{
    let received = null;
    const executor = new CardEffectExecutor({
        domainActionExecutor(effect, context) {
            received = { effect, context };
            return { success: true, domainResult: "OK" };
        }
    });
    const result = executor.executeAll([
        { type: CARD_EFFECT_TYPES.DOMAIN_ACTION, action: "PLACE_SPECIAL_BLOCK", payload: { kind: "FARM" } }
    ], { state: {} });

    assert.equal(result.success, true);
    assert.equal(received.effect.action, "PLACE_SPECIAL_BLOCK");
    assert.equal(received.effect.payload.kind, "FARM");
}

// L. Declarative effects preflight before mutation; cross-domain action stays atomic.
{
    const state = { wood: 1, material: 1 };
    const executor = new CardEffectExecutor();

    const invalid = executor.executeAll([
        { type: CARD_EFFECT_TYPES.RESOURCE_DELTA, resource: "wood", amount: 5 },
        { type: CARD_EFFECT_TYPES.STATE_SET }
    ], { state });
    assert.equal(invalid.success, false);
    assert.equal(invalid.reason, "STATE_KEY_REQUIRED");
    assert.equal(state.wood, 1, "preflight failure must leave earlier effects unapplied");

    const mixedDomain = new CardEffectExecutor({
        domainActionExecutor: () => ({ success: true })
    }).executeAll([
        { type: CARD_EFFECT_TYPES.STATE_SET, key: "flag", value: true },
        { type: CARD_EFFECT_TYPES.DOMAIN_ACTION, action: "BOARD_MUTATION" }
    ], { state });
    assert.equal(mixedDomain.success, false);
    assert.equal(mixedDomain.reason, "DOMAIN_ACTION_MUST_BE_EXCLUSIVE");
    assert.equal(state.flag, undefined);
}

// M. Declarative effect preflight occurs before command cost and source-slot consumption.
{
    const state = {
        turn: 1,
        food: 0,
        wood: 10,
        material: 10,
        mystic: 0,
        ember: 0,
        reserveSlots: [],
        handOffering: [{ id: "slot" }],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        addLog() {}
    };
    const manager = new DeckManager(state, {});
    manager.cycleSystem = null;

    const blocked = manager.playCommandCard({
        id: "CMD_BAD_EFFECT_TEST",
        category: "COMMAND",
        nameKey: "CMD_BAD_EFFECT_TEST_NAME",
        cost: { wood: 5 },
        effects: [
            { type: CARD_EFFECT_TYPES.STATE_SET }
        ]
    }, null, 0, -1);

    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, "STATE_KEY_REQUIRED");
    assert.equal(state.wood, 10);
    assert.equal(state.material, 10);
    assert.equal(state.handOffering[0].id, "slot");
}

// N. Execution requirements are checked again at play time before cost or slot consumption.
{
    const state = {
        turn: 1,
        food: 10,
        wood: 10,
        material: 10,
        mystic: 0,
        ember: 0,
        reserveSlots: [],
        handOffering: [{ id: "slot" }],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        addLog() {}
    };
    const manager = new DeckManager(state, {
        cardExecutionRequirementEvaluator(requirement) {
            return requirement.type !== "RESOURCE_AT_LEAST"
                || state.wood >= requirement.value;
        }
    });
    manager.cycleSystem = null;

    const card = {
        id: "CMD_EXECUTION_GATE_TEST",
        category: "COMMAND",
        nameKey: "CMD_EXECUTION_GATE_TEST_NAME",
        cost: { wood: 5 },
        execution: {
            requirements: [
                { id: "WOOD_15", type: "RESOURCE_AT_LEAST", value: 15 }
            ]
        },
        effects: [
            { type: CARD_EFFECT_TYPES.STATE_SET, key: "shouldNotRun", value: true }
        ]
    };

    const blocked = manager.playCommandCard(card, null, 0, -1);
    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, "WOOD_15");
    assert.equal(state.wood, 10, "execution failure must occur before cost deduction");
    assert.equal(state.handOffering[0].id, "slot", "execution failure must not consume the source slot");
    assert.equal(state.shouldNotRun, undefined);
}

// O. First real migrations preserve legacy state/cost semantics without DeckManager ID branches.
{
    const emergency = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_EMERGENCY_LEVY");
    const loggingCamp = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_LOGGING_CAMP");
    assert.ok(Array.isArray(emergency?.effects) && emergency.effects.length === 3);
    assert.ok(Array.isArray(loggingCamp?.effects) && loggingCamp.effects.length === 3);

    const emergencyState = {
        turn: 1,
        food: 30,
        wood: 4,
        material: 99,
        mystic: 0,
        ember: 3,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog(log) { this.logs.push(log); }
    };
    const emergencyManager = new DeckManager(emergencyState, {});
    emergencyManager.cycleSystem = null;
    const emergencyResult = emergencyManager.playCommandCard(emergency);

    assert.equal(emergencyResult.success, true);
    assert.equal(emergencyState.food, 10, "legacy food cost remains 20");
    assert.equal(emergencyState.wood, 19, "legacy immediate material gain remains +15 wood");
    assert.equal(emergencyState.material, 99, "legacy effect did not mirror gained wood into material");
    assert.equal(emergencyState.activeBuffs.length, 1);
    assert.equal(emergencyState.activeBuffs[0].id, "CMD_EMERGENCY_LEVY");
    assert.equal(emergencyState.activeBuffs[0].icon, "🧱");
    assert.equal(emergencyState.activeBuffs[0].category, "CARD_EFFECT");
    assert.equal(emergencyState.logs.length, 1);

    const campState = {
        turn: 1,
        food: 10,
        wood: 2,
        material: 77,
        mystic: 0,
        ember: 2,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog(log) { this.logs.push(log); }
    };
    const campManager = new DeckManager(campState, {});
    campManager.cycleSystem = null;
    const campResult = campManager.playCommandCard(loggingCamp);

    assert.equal(campResult.success, true);
    assert.equal(campState.ember, 1, "legacy ember cost remains 1");
    assert.equal(campState.wood, 10, "legacy immediate gain remains +8 wood");
    assert.equal(campState.material, 77);
    assert.equal(campState.activeBuffs.length, 1);
    assert.equal(campState.activeBuffs[0].id, "CMD_LOGGING_CAMP");
    assert.equal(campState.activeBuffs[0].icon, "🪵");
    assert.equal(campState.logs.length, 1);
}

// P. Simple Mystic cards migrated from ID branches remain behavior-equivalent.
{
    const cases = [
        {
            id: "CMD_LEYLINE_RESONANCE",
            initialMystic: 20,
            expectedMystic: 12,
            stateKey: "leylineResonanceActive",
            stateValue: true,
            icon: "✨",
            unique: false
        },
        {
            id: "CMD_VOICE_BENEATH_EARTH",
            initialMystic: 20,
            expectedMystic: 15,
            stateKey: "voiceBeneathEarthTurns",
            stateValue: 1,
            icon: "🔮",
            unique: false
        },
        {
            id: "CMD_REVELATION_CHOICE",
            initialMystic: 20,
            expectedMystic: 5,
            stateKey: "revelationChoiceTurns",
            stateValue: 1,
            icon: "✨",
            unique: false
        },
        {
            id: "CMD_TWO_FUTURES",
            initialMystic: 30,
            expectedMystic: 10,
            stateKey: "twoFuturesTurns",
            stateValue: 1,
            icon: "🔮",
            unique: true
        }
    ];

    for (const testCase of cases) {
        const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === testCase.id);
        assert.ok(card, `missing generated master card ${testCase.id}`);
        assert.ok(Array.isArray(card.effects) && card.effects.length === 3,
            `${testCase.id} must execute declaratively`);

        const state = {
            turn: 1,
            food: 50,
            wood: 50,
            material: 50,
            mystic: testCase.initialMystic,
            ember: 10,
            reserveSlots: [],
            consumedUniqueCards: [],
            usedUniqueCards: [],
            activeBuffs: [],
            logs: [],
            addBuff(buff) { this.activeBuffs.push(buff); },
            addLog(log) { this.logs.push(log); }
        };
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;

        const result = manager.playCommandCard(card);
        assert.equal(result.success, true, testCase.id);
        assert.equal(state.mystic, testCase.expectedMystic, `${testCase.id} cost drift`);
        assert.equal(state[testCase.stateKey], testCase.stateValue, `${testCase.id} state effect drift`);
        assert.equal(state.activeBuffs.length, 1, `${testCase.id} buff count drift`);
        assert.equal(state.activeBuffs[0].id, testCase.id, `${testCase.id} buff id drift`);
        assert.equal(state.activeBuffs[0].icon, testCase.icon, `${testCase.id} buff icon drift`);
        assert.equal(state.activeBuffs[0].category, "CARD_EFFECT", `${testCase.id} buff category drift`);
        assert.equal(state.logs.length, 1, `${testCase.id} log count drift`);

        if (testCase.stateKey !== "leylineResonanceActive") {
            assert.equal(state.activeBuffs[0].remainingTurns, 1, `${testCase.id} remainingTurns drift`);
            assert.ok(state.activeBuffs[0].badgeText, `${testCase.id} must keep remaining-turn badge`);
        }

        if (testCase.unique) {
            assert.ok(state.consumedUniqueCards.includes(testCase.id)
                || state.usedUniqueCards.includes(testCase.id),
                `${testCase.id} UNIQUE consumption must remain active`);
        }
    }
}

// Q. Mystic utility migrations preserve multi-effect legacy behavior.
{
    const makeState = ({ mystic = 20, ember = 5 } = {}) => ({
        turn: 1,
        food: 50,
        wood: 50,
        material: 50,
        mystic,
        ember,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog(log) { this.logs.push(log); }
    });

    {
        const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_FILL_THE_VOID");
        const state = makeState();
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        assert.equal(manager.playCommandCard(card).success, true);
        assert.equal(state.fillTheVoidTurns, 1);
        assert.equal(state.activeBuffs[0].remainingTurns, 1);
        assert.equal(state.activeBuffs[0].id, card.id);
        assert.equal(state.logs.length, 1);
    }

    {
        const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_MEDITATION");
        const state = makeState({ mystic: 10 });
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        assert.equal(manager.playCommandCard(card).success, true);
        assert.equal(state.mystic, 13, "meditation must preserve immediate mystic +3");
        assert.deepEqual(state.activeDrawBias, {
            targetCategory: "LAND",
            type: "TURNS",
            remainingTurns: 1,
            startsNextTurn: true
        });
        assert.equal(state.activeBuffs[0].startsNextTurn, true);
        assert.equal(state.activeBuffs[0].remainingTurns, 1);
        assert.equal(state.logs.length, 1);
    }

    {
        const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_REKINDLE_EMBER");
        const state = makeState({ mystic: 20, ember: 4 });
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        assert.equal(manager.playCommandCard(card).success, true);
        assert.equal(state.mystic, 10, "rekindle mystic cost drift");
        assert.equal(state.ember, 7, "rekindle ember gain drift");
        assert.equal(state.reserveFeeWaivedTurns, 3);
        assert.equal(state.reserveFeeWaivedStartsNextTurn, true);
        assert.equal(state.activeBuffs[0].remainingTurns, 3);
        assert.equal(state.activeBuffs[0].startsNextTurn, true);
        assert.equal(state.logs.length, 1);
    }

    {
        const card = COMMAND_CARDS_MASTER.find(c => c.id === "CMD_MANIFEST_MIRACLE");
        const state = makeState({ mystic: 20 });
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        assert.equal(manager.playCommandCard(card).success, true);
        assert.equal(state.mystic, 10, "manifest miracle mystic cost drift");
        assert.equal(state.manifestMiracleTurns, 3);
        assert.equal(state.manifestMiracleStartsNextTurn, true);
        assert.equal(state.activeBuffs[0].remainingTurns, 3);
        assert.equal(state.activeBuffs[0].startsNextTurn, true);
        assert.equal(state.logs.length, 2,
            "legacy Manifest Miracle emits two activation logs; preserve during refactor");
    }
}

// R. Next declarative migrations preserve legacy behavior.
{
    const cases = [
        {
            id: "CMD_RATIONING",
            initial: { food: 10, wood: 10, material: 10, mystic: 5, ember: 5 },
            assertState(state) {
                assert.equal(state.foodCostRationingActive, true);
                assert.equal(state.foodCostRationingDiscount, 0.4);
                assert.equal(state.foodCostHalvedTurns, 1);
                assert.equal(state.activeBuffs[0].remainingTurns, 1);
                assert.equal(state.activeBuffs[0].icon, "🌾");
                assert.equal(state.logs.length, 1);
            }
        },
        {
            id: "CMD_VIGILANCE",
            initial: { food: 10, wood: 30, material: 30, mystic: 5, ember: 5 },
            assertState(state) {
                assert.equal(state.wood, 15, "vigilance cost drift");
                assert.equal(state.vigilanceTurns, 2);
                assert.equal(state.vigilanceStartsNextTurn, true);
                assert.equal(state.temporaryDefenseTurns, 2);
                assert.equal(state.activeBuffs[0].remainingTurns, 2);
                assert.equal(state.activeBuffs[0].startsNextTurn, true);
                assert.equal(state.activeBuffs[0].icon, "🛡️");
                assert.equal(state.logs.length, 1);
            }
        },
        {
            id: "CMD_MYSTIC_FOCUS",
            initial: { food: 10, wood: 10, material: 10, mystic: 20, ember: 5 },
            assertState(state) {
                assert.equal(state.mystic, 10, "mystic focus cost drift");
                assert.deepEqual(state.activeDrawBias, {
                    targetCategory: "MYSTIC",
                    type: "TURNS",
                    remainingTurns: 3,
                    startsNextTurn: true
                });
                assert.equal(state.activeBuffs[0].remainingTurns, 3);
                assert.equal(state.activeBuffs[0].startsNextTurn, true);
                assert.equal(state.activeBuffs[0].icon, "✨");
                assert.equal(state.logs.length, 0,
                    "legacy Mystic Focus emits no activation log; preserve during refactor");
            }
        }
    ];

    for (const testCase of cases) {
        const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === testCase.id);
        assert.ok(card, `missing generated master card ${testCase.id}`);
        assert.ok(Array.isArray(card.effects) && card.effects.length > 0);

        const state = {
            turn: 1,
            reserveSlots: [],
            consumedUniqueCards: [],
            usedUniqueCards: [],
            activeBuffs: [],
            logs: [],
            addBuff(buff) { this.activeBuffs.push(buff); },
            addLog(log) { this.logs.push(log); },
            ...testCase.initial
        };
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        const result = manager.playCommandCard(card);

        assert.equal(result.success, true, testCase.id);
        assert.equal(state.activeBuffs[0].id, testCase.id);
        assert.equal(state.activeBuffs[0].category, "CARD_EFFECT");
        testCase.assertState(state);
    }
}

// S. Granary migration preserves legacy behavior.
{
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_GRANARY");
    assert.ok(card?.effects?.length === 3);

    const state = {
        turn: 1,
        food: 20,
        wood: 30,
        material: 30,
        mystic: 0,
        ember: 5,
        granaryCount: 2,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog(log) { this.logs.push(log); }
    };
    const manager = new DeckManager(state, {});
    manager.cycleSystem = null;
    const result = manager.playCommandCard(card);

    assert.equal(result.success, true);
    assert.equal(state.wood, 10, "granary wood cost drift");
    assert.equal(state.material, 10, "shared command cost keeps material mirror behavior");
    assert.equal(state.granaryCount, 3);
    assert.equal(state.activeBuffs[0].id, "CMD_GRANARY");
    assert.equal(state.activeBuffs[0].icon, "🏛️");
    assert.equal(state.logs.length, 1);
}

// T. Agricultural Reform migration preserves legacy behavior.
{
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_AGRICULTURAL_REFORM");
    assert.ok(card?.effects?.length === 3);

    const state = {
        turn: 1,
        food: 20,
        wood: 30,
        material: 30,
        mystic: 0,
        ember: 5,
        permanentPlainsFoodBonus: 2,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        addLog(log) { this.logs.push(log); }
    };
    const manager = new DeckManager(state, {});
    manager.cycleSystem = null;
    const result = manager.playCommandCard(card);

    assert.equal(result.success, true);
    assert.equal(state.wood, 10, "agricultural reform wood cost drift");
    assert.equal(state.material, 10, "shared command cost keeps material mirror behavior");
    assert.equal(state.permanentPlainsFoodBonus, 3);
    assert.equal(state.activeBuffs[0].id, "CMD_AGRICULTURAL_REFORM");
    assert.equal(state.activeBuffs[0].icon, "📜");
    assert.equal(state.logs.length, 1);
}

// U. Military Focus migration preserves legacy immediate conditional reconciliation.
{
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_MILITARY_FOCUS");
    assert.ok(card?.effects?.length === 4);

    const makeState = defense => ({
        turn: 1,
        food: 20,
        wood: 40,
        material: 40,
        mystic: 0,
        ember: 5,
        defense,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addBuff(buff) { this.activeBuffs.push(buff); },
        removeBuff(id) { this.activeBuffs = this.activeBuffs.filter(buff => buff.id !== id); },
        addLog(log) { this.logs.push(log); },
        calculateTotalDefense() { return this.defense; },
        checkConditionalBuffs() {
            if (this.activeDrawBias?.type === "UNTIL_DEFENSE"
                && this.calculateTotalDefense() >= (this.activeDrawBias.untilValue || 20)) {
                this.activeDrawBias = null;
                this.removeBuff("CMD_MILITARY_FOCUS");
            }
        }
    });

    {
        const state = makeState(19);
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        const result = manager.playCommandCard(card);
        assert.equal(result.success, true);
        assert.equal(state.wood, 20);
        assert.equal(state.material, 20);
        assert.deepEqual(state.activeDrawBias, {
            targetCategory: "MILITARY",
            type: "UNTIL_DEFENSE",
            untilValue: 20
        });
        assert.equal(state.activeBuffs[0].id, "CMD_MILITARY_FOCUS");
        assert.equal(state.activeBuffs[0].icon, "🛡️");
        assert.equal(state.logs.length, 1);
    }

    {
        const state = makeState(20);
        const manager = new DeckManager(state, {});
        manager.cycleSystem = null;
        const result = manager.playCommandCard(card);
        assert.equal(result.success, true);
        assert.equal(state.activeDrawBias, null,
            "legacy exact-threshold behavior immediately clears Military Focus bias");
        assert.equal(state.activeBuffs.length, 0,
            "legacy exact-threshold behavior immediately removes Military Focus buff");
        assert.equal(state.logs.length, 1);
    }
}

// V. Iron Rampart migrates through Defense domain with legacy-equivalent results.
{
    const card = COMMAND_CARDS_MASTER.find(candidate => candidate.id === "CMD_IRON_RAMPART");
    assert.ok(card?.effects?.length === 1);
    assert.equal(card.effects[0].action, CARD_DOMAIN_ACTIONS.APPLY_DEFENSE_DEVELOPMENT);

    const grid = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ placed: false }))
    );
    const state = {
        turn: 1,
        food: 20,
        wood: 40,
        material: 40,
        mystic: 0,
        ember: 5,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        defenseCapacityBonus: 0,
        permanentVicinityDefenseBonus: 0,
        placedBlockCount: 0,
        grid,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        activeBuffs: [],
        logs: [],
        addLog(log) { this.logs.push(log); }
    };
    const defenseSystem = new DefenseSystem(state);
    state.defenseSystem = defenseSystem;
    const engine = { defenseSystem };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

    const manager = new DeckManager(state, engine);
    manager.cycleSystem = null;
    const result = manager.playCommandCard(card);

    assert.equal(result.success, true);
    assert.equal(state.wood, 20, "iron rampart wood cost drift");
    assert.equal(state.material, 20, "shared command cost material mirror drift");
    assert.equal(state.defenseCapacityBonus, 25);
    assert.equal(state.defense, 35, "legacy defense compatibility value must include capacity bonus");
    assert.equal(state.permanentVicinityDefenseBonus, 2);
    assert.equal(defenseSystem.getMaxDefense(), 35);
    assert.equal(state.logs.length, 1);
}

// W. Migrated effects stay identical between JSON SSOT and generated command master.



{
    const economySource = JSON.parse(readFileSync(
        new URL("../game/src/data/economy_cards.json", import.meta.url),
        "utf8"
    ));
    const militarySource = JSON.parse(readFileSync(
        new URL("../game/src/data/military_cards.json", import.meta.url),
        "utf8"
    ));
    const mysticSource = JSON.parse(readFileSync(
        new URL("../game/src/data/mystic_cards.json", import.meta.url),
        "utf8"
    ));
    const sourceCards = [...economySource, ...militarySource, ...mysticSource];
    const migratedIds = [
        "CMD_EMERGENCY_LEVY",
        "CMD_LOGGING_CAMP",
        "CMD_LEYLINE_RESONANCE",
        "CMD_VOICE_BENEATH_EARTH",
        "CMD_REVELATION_CHOICE",
        "CMD_TWO_FUTURES",
        "CMD_FILL_THE_VOID",
        "CMD_MEDITATION",
        "CMD_REKINDLE_EMBER",
        "CMD_MANIFEST_MIRACLE",
        "CMD_RATIONING",
        "CMD_VIGILANCE",
        "CMD_MYSTIC_FOCUS",
        "CMD_GRANARY",
        "CMD_AGRICULTURAL_REFORM",
        "CMD_MILITARY_FOCUS",
        "CMD_IRON_RAMPART"
    ];

    for (const id of migratedIds) {
        const source = sourceCards.find(card => card.id === id);
        const generated = COMMAND_CARDS_MASTER.find(card => card.id === id);
        assert.ok(source, `missing SSOT card ${id}`);
        assert.ok(generated, `missing generated card ${id}`);
        assert.deepEqual(
            generated.effects,
            source.effects,
            `${id} generated effects must match JSON SSOT exactly`
        );
    }
}

// X. Every remaining DeckManager command ID branch belongs to exactly one migration class.
{
    const deckManagerSource = readFileSync(
        new URL("../game/src/systems/deck_manager.js", import.meta.url),
        "utf8"
    );
    const branchIds = [...deckManagerSource.matchAll(/cId === "([^"]+)"/g)].map(match => match[1]);
    const uniqueBranchIds = [...new Set(branchIds)];

    const classifiedIds = [
        ...CURRENT_SSOT_LOCAL_IDS,
        ...DOMAIN_ACTION_REQUIRED_IDS,
        ...LEGACY_ONLY_IDS
    ];
    assert.equal(new Set(classifiedIds).size, classifiedIds.length,
        "legacy command inventory classes must be mutually exclusive");
    assert.deepEqual(
        [...uniqueBranchIds].sort(),
        [...classifiedIds].sort(),
        "every remaining command branch must be explicitly classified"
    );

    for (const id of uniqueBranchIds) {
        assert.ok(classifyLegacyCommandExecution(id), `unclassified command branch: ${id}`);
    }

    const duplicateIds = [...new Set(
        branchIds.filter((id, index) => branchIds.indexOf(id) !== index)
    )].sort();
    assert.deepEqual(
        duplicateIds,
        [...DUPLICATE_LEGACY_BRANCH_IDS].sort(),
        "duplicate ID branches must stay explicit until their migration removes them"
    );
}

// Y. SSOT ownership and execution classification must agree.
{
    const economySource = JSON.parse(readFileSync(
        new URL("../game/src/data/economy_cards.json", import.meta.url),
        "utf8"
    ));
    const militarySource = JSON.parse(readFileSync(
        new URL("../game/src/data/military_cards.json", import.meta.url),
        "utf8"
    ));
    const mysticSource = JSON.parse(readFileSync(
        new URL("../game/src/data/mystic_cards.json", import.meta.url),
        "utf8"
    ));
    const ssotIds = new Set(
        [...economySource, ...militarySource, ...mysticSource].map(card => card.id)
    );

    for (const id of CURRENT_SSOT_LOCAL_IDS) {
        assert.ok(ssotIds.has(id), `${id} CURRENT_SSOT_LOCAL must exist in a current JSON SSOT`);
        assert.equal(
            classifyLegacyCommandExecution(id),
            LEGACY_COMMAND_EXECUTION_CLASS.CURRENT_SSOT_LOCAL
        );
    }

    for (const id of DOMAIN_ACTION_REQUIRED_IDS) {
        assert.ok(ssotIds.has(id), `${id} DOMAIN_ACTION_REQUIRED must exist in a current JSON SSOT`);
        assert.equal(
            classifyLegacyCommandExecution(id),
            LEGACY_COMMAND_EXECUTION_CLASS.DOMAIN_ACTION_REQUIRED
        );
    }

    for (const id of LEGACY_ONLY_IDS) {
        assert.equal(
            ssotIds.has(id),
            false,
            `${id} LEGACY_ONLY must not silently regain current SSOT status without reclassification`
        );
        assert.equal(
            classifyLegacyCommandExecution(id),
            LEGACY_COMMAND_EXECUTION_CLASS.LEGACY_ONLY
        );
    }
}

// Z. Every DOMAIN_ACTION_REQUIRED card has exactly one owning domain.
{
    const validOwners = new Set(Object.values(DOMAIN_ACTION_OWNER));
    assert.deepEqual(
        Object.keys(DOMAIN_ACTION_OWNER_BY_ID).sort(),
        [...DOMAIN_ACTION_REQUIRED_IDS].sort(),
        "domain owner map must cover exactly the domain-action migration set"
    );

    for (const id of DOMAIN_ACTION_REQUIRED_IDS) {
        const owner = resolveDomainActionOwner(id);
        assert.ok(validOwners.has(owner), `${id} must resolve to a known domain owner`);
    }

    for (const id of [...CURRENT_SSOT_LOCAL_IDS, ...LEGACY_ONLY_IDS]) {
        assert.equal(
            resolveDomainActionOwner(id),
            null,
            `${id} must not acquire a domain owner outside DOMAIN_ACTION_REQUIRED`
        );
    }
}

// Y. Domain actions preflight against Board before command cost / source consumption.
{
    const calls = [];
    const boardDomainAdapter = {
        validateSpecialBlockTarget(type, target, context) {
            calls.push({ phase: "validate", type, target, context });
            return target?.r === 1 && target?.c === 2
                ? { valid: true }
                : { valid: false, reason: "TARGET_BLOCKED" };
        },
        createSpecialBlock(type, target, context) {
            calls.push({ phase: "create", type, target, context });
            return { success: true, entity: { type }, target };
        }
    };
    const engine = { boardDomainAdapter };
    const domainExecutor = createCardDomainActionExecutor(engine);
    const effectExecutor = new CardEffectExecutor({ domainActionExecutor: domainExecutor });

    const effect = {
        type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
        action: CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK,
        blockType: "MINE"
    };

    const blocked = effectExecutor.preflight([effect], {
        state: { turn: 7 },
        targetTile: { r: 0, c: 0 },
        cardDefinition: { id: "CMD_DOMAIN_PREFLIGHT_TEST" }
    });
    assert.equal(blocked.success, false);
    assert.equal(blocked.reason, "TARGET_BLOCKED");
    assert.equal(calls.filter(call => call.phase === "create").length, 0);

    const allowed = effectExecutor.executeAll([effect], {
        state: { turn: 7 },
        targetTile: { r: 1, c: 2 },
        cardDefinition: { id: "CMD_DOMAIN_EXECUTE_TEST" }
    });
    assert.equal(allowed.success, true);
    assert.equal(calls.filter(call => call.phase === "create").length, 1);
    const createCall = calls.find(call => call.phase === "create");
    assert.equal(createCall.type, "MINE");
    assert.deepEqual(createCall.target, { r: 1, c: 2 });
    assert.equal(createCall.context.verse, 7);
    assert.equal(createCall.context.cardId, "CMD_DOMAIN_EXECUTE_TEST");
}

// Z. DeckManager rejects invalid domain target before deducting command cost.
{
    const state = {
        turn: 4,
        food: 0,
        wood: 30,
        material: 30,
        mystic: 0,
        ember: 0,
        reserveSlots: [],
        handOffering: [{ id: "source-slot" }],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        addLog() {}
    };
    const engine = {
        boardDomainAdapter: {
            validateSpecialBlockTarget() {
                return { valid: false, reason: "SPECIAL_BLOCK_OCCUPIED" };
            },
            createSpecialBlock() {
                throw new Error("must not execute after failed preflight");
            }
        }
    };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

    const manager = new DeckManager(state, engine);
    manager.cycleSystem = null;
    const card = {
        id: "CMD_DOMAIN_COST_GUARD_TEST",
        category: "COMMAND",
        nameKey: "CMD_DOMAIN_COST_GUARD_TEST_NAME",
        cost: { wood: 20 },
        effects: [{
            type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
            action: CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK,
            blockType: "MINE"
        }]
    };

    const result = manager.playCommandCard(card, { r: 1, c: 1 }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "SPECIAL_BLOCK_OCCUPIED");
    assert.equal(state.wood, 30);
    assert.equal(state.material, 30);
    assert.equal(state.handOffering[0].id, "source-slot");
}

// AA. GameEngine command boundary carries optional target without changing legacy callers.
{
    const calls = [];
    const fakeEngine = {
        deckManager: {
            playCommandCard(card, target, offeringIdx, reserveIdx) {
                calls.push({ card, target, offeringIdx, reserveIdx });
                return { success: true };
            }
        },
        executeAction(_type, pipeline) {
            const result = typeof pipeline === "function" ? pipeline() : pipeline.execute();
            return result;
        }
    };

    const card = { id: "CMD_TARGET_BRIDGE_TEST", category: "COMMAND" };
    const target = { r: 2, c: 3 };
    const result = GameEngine.prototype.playCommandCard.call(
        fakeEngine,
        card,
        { type: "OFFERING", index: 1 },
        target
    );

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].target, target);
    assert.equal(calls[0].offeringIdx, 1);
    assert.equal(calls[0].reserveIdx, -1);

    GameEngine.prototype.playCommandCard.call(
        fakeEngine,
        card,
        { type: "RESERVE", index: 0 }
    );
    assert.equal(calls[1].target, null, "legacy two-argument caller keeps null target");
    assert.equal(calls[1].offeringIdx, -1);
    assert.equal(calls[1].reserveIdx, 0);
}

// AB. Legal execution targets flow Board -> Domain executor -> Effect router -> DeckManager.
{
    const expectedTargets = [{ r: 1, c: 2 }, { r: 2, c: 2 }];
    const engine = {
        boardDomainAdapter: {
            enumerateLegalSpecialBlockTargets(type, context) {
                assert.equal(type, "MINE");
                assert.equal(context.cardId, "CMD_TARGET_QUERY_TEST");
                return expectedTargets.map(target => ({ ...target }));
            },
            validateSpecialBlockTarget() {
                return { valid: true };
            },
            createSpecialBlock() {
                return { success: true };
            }
        }
    };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);

    const state = {
        turn: 9,
        reserveSlots: [],
        consumedUniqueCards: [],
        usedUniqueCards: []
    };
    const manager = new DeckManager(state, engine);
    manager.cycleSystem = null;

    const card = {
        id: "CMD_TARGET_QUERY_TEST",
        category: "COMMAND",
        effects: [{
            type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
            action: CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK,
            blockType: "MINE"
        }]
    };

    assert.deepEqual(
        manager.enumerateCardExecutionTargets(card),
        expectedTargets,
        "DeckManager must expose Board-owned legal target enumeration without rescanning the grid"
    );
    assert.deepEqual(
        manager.enumerateCardExecutionTargets({ id: "CMD_LOCAL_ONLY", category: "COMMAND", effects: [
            { type: CARD_EFFECT_TYPES.STATE_SET, key: "x", value: true }
        ] }),
        [],
        "non-domain declarative effects have no board execution targets"
    );
}

// AC. GameEngine exposes command target enumeration without UI reaching into DeckManager internals.
{
    const expected = [{ r: 3, c: 4 }];
    const fakeEngine = {
        deckManager: {
            enumerateCardExecutionTargets(card) {
                assert.equal(card.id, "CMD_ENGINE_TARGET_QUERY");
                return expected;
            }
        }
    };

    assert.deepEqual(
        GameEngine.prototype.getCommandCardExecutionTargets.call(
            fakeEngine,
            { id: "CMD_ENGINE_TARGET_QUERY", category: "COMMAND" }
        ),
        expected
    );
    assert.deepEqual(
        GameEngine.prototype.getCommandCardExecutionTargets.call(
            { deckManager: null },
            { id: "CMD_ENGINE_TARGET_QUERY", category: "COMMAND" }
        ),
        []
    );
}

// AD. Targeted domain cards never enter Offering without at least one legal Board target.
{
    const card = {
        id: "CMD_TARGETED_OFFERING_TEST",
        category: "COMMAND",
        rarity: "C",
        minStage: 1,
        effects: [{
            type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
            action: CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK,
            blockType: "MINE"
        }]
    };

    const makeState = () => ({
        turn: 1,
        stage: { id: 1 },
        reserveSlots: [],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: []
    });

    const blockedEngine = {
        boardDomainAdapter: {
            enumerateLegalSpecialBlockTargets() { return []; },
            validateSpecialBlockTarget() { return { valid: false, reason: "NO_TARGET" }; },
            createSpecialBlock() { return { success: false, reason: "NO_TARGET" }; }
        }
    };
    blockedEngine.cardDomainActionExecutor = createCardDomainActionExecutor(blockedEngine);
    const blockedManager = new DeckManager(makeState(), blockedEngine);
    blockedManager.cycleSystem = null;
    assert.equal(
        blockedManager.isCardEligible(card, 1, 0),
        false,
        "targeted domain card with zero legal targets must not enter Offering"
    );

    const allowedEngine = {
        boardDomainAdapter: {
            enumerateLegalSpecialBlockTargets() { return [{ r: 1, c: 1 }]; },
            validateSpecialBlockTarget() { return { valid: true }; },
            createSpecialBlock() { return { success: true }; }
        }
    };
    allowedEngine.cardDomainActionExecutor = createCardDomainActionExecutor(allowedEngine);
    const allowedManager = new DeckManager(makeState(), allowedEngine);
    allowedManager.cycleSystem = null;
    assert.equal(
        allowedManager.isCardEligible(card, 1, 0),
        true,
        "targeted domain card may enter Offering when Board reports a legal target"
    );

    const failClosedService = new CardOfferingEligibilityService({
        state: makeState(),
        placementQuery: null,
        executionTargetRequired: () => true
    });
    assert.equal(
        failClosedService.evaluate(card).reason,
        "EXECUTION_TARGET_QUERY_REQUIRED",
        "targeted domain Offering must fail closed when no target query boundary is available"
    );
}

// AE. Targeted command UI path prioritizes Board target selection over land undo / instant confirm.
{
    const played = [];
    const fakeUi = {
        state: { hasPickedThisTurn: false },
        selectedCard: { id: "CMD_UI_TARGET_TEST", category: "COMMAND" },
        selectedCardIdx: 2,
        selectedReserveIdx: -1,
        isTrialInteractionActive() { return false; },
        commandCardRequiresTarget() { return true; },
        hideCellTooltip() {},
        isCommandExecutionTarget(_card, r, c) { return r === 2 && c === 3; },
        playCommandCard(card, idx, target) {
            played.push({ card, idx, target });
            return { success: true };
        },
        undoSys: {
            isCellPlacedThisTurn() {
                throw new Error("targeted command path must run before land undo");
            }
        }
    };

    const rejected = UIController.prototype.onCellClick.call(fakeUi, 0, 0);
    assert.equal(rejected, false);
    assert.equal(played.length, 0);

    const accepted = UIController.prototype.onCellClick.call(fakeUi, 2, 3);
    assert.equal(accepted, true);
    assert.equal(played.length, 1);
    assert.deepEqual(played[0].target, { r: 2, c: 3 });
    assert.equal(played[0].idx, 2);
}

// AF. UI target queries remain Engine-facade only and CSS uses a distinct semantic class.
{
    const fakeUi = {
        engine: {
            commandCardRequiresTarget(card) {
                return card.id === "CMD_TARGETED";
            },
            getCommandCardExecutionTargets(card) {
                return card.id === "CMD_TARGETED" ? [{ r: 1, c: 4 }] : [];
            }
        },
        selectedCard: null
    };
    const card = { id: "CMD_TARGETED", category: "COMMAND" };
    assert.equal(UIController.prototype.commandCardRequiresTarget.call(fakeUi, card), true);
    assert.deepEqual(
        UIController.prototype.getCommandCardExecutionTargets.call(fakeUi, card),
        [{ r: 1, c: 4 }]
    );
    fakeUi.getCommandCardExecutionTargets = UIController.prototype.getCommandCardExecutionTargets;
    assert.equal(UIController.prototype.isCommandExecutionTarget.call(fakeUi, card, 1, 4), true);
    assert.equal(UIController.prototype.isCommandExecutionTarget.call(fakeUi, card, 4, 1), false);

    const uiSource = readFileSync(
        new URL("../game/src/ui/ui_controller.js", import.meta.url),
        "utf8"
    );
    const gridCss = readFileSync(
        new URL("../game/css/2_center_area/land_grid.css", import.meta.url),
        "utf8"
    );
    assert.ok(uiSource.includes("command-target-candidate"));
    assert.ok(gridCss.includes(".cell.command-target-candidate"));
    assert.ok(uiSource.includes("this.engine.playCommandCard(card, source, target)"));
}

// AG. Target requirement semantics come from the owning Domain Action, not Card Core.
{
    const targetedEngine = {
        boardDomainAdapter: {
            enumerateLegalSpecialBlockTargets() { return [{ r: 1, c: 1 }]; },
            validateSpecialBlockTarget() { return { valid: true }; },
            createSpecialBlock() { return { success: true }; }
        }
    };
    targetedEngine.cardDomainActionExecutor = createCardDomainActionExecutor(targetedEngine);
    const targetedManager = new DeckManager({
        turn: 1,
        reserveSlots: [],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: []
    }, targetedEngine);
    targetedManager.cycleSystem = null;

    assert.equal(
        targetedManager.cardRequiresExecutionTarget({
            id: "CMD_TARGET_SEMANTIC_TEST",
            category: "COMMAND",
            effects: [{
                type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
                action: CARD_DOMAIN_ACTIONS.CREATE_SPECIAL_BLOCK,
                blockType: "MINE"
            }]
        }),
        true
    );

    const customDomainExecutor = () => ({ success: true });
    customDomainExecutor.requiresTarget = () => false;
    const nonTargetExecutor = new CardEffectExecutor({
        domainActionExecutor: customDomainExecutor
    });
    assert.equal(
        nonTargetExecutor.requiresTarget([{
            type: CARD_EFFECT_TYPES.DOMAIN_ACTION,
            action: "DEFENSE_CAPACITY_CHANGE"
        }]),
        false,
        "non-targeted domain actions must not inherit Special Block targeting semantics"
    );
}

// AH. Shadowed duplicate legacy branches stay explicit and Great Rampart remains Project-owned.
{
    assert.deepEqual(
        [...LEGACY_SHADOWED_BRANCH_IDS],
        ["CMD_GREAT_RAMPART_PROJECT"]
    );
    assert.equal(
        resolveDomainActionOwner("CMD_GREAT_RAMPART_PROJECT"),
        DOMAIN_ACTION_OWNER.PROJECT
    );

    const deckManagerSource = readFileSync(
        new URL("../game/src/systems/deck_manager.js", import.meta.url),
        "utf8"
    );
    const first = deckManagerSource.indexOf('cId === "CMD_GREAT_RAMPART_PROJECT"');
    const second = deckManagerSource.indexOf('cId === "CMD_GREAT_RAMPART_PROJECT"', first + 1);
    assert.ok(first >= 0 && second > first, "Great Rampart legacy duplicate must remain detectable until Project migration");
    const firstBranch = deckManagerSource.slice(first, second);
    assert.ok(firstBranch.includes("greatRampartTurns = 4"),
        "first reachable Great Rampart branch must remain the 4T project behavior");
}

console.log("✅ Card Core / Offering v1 contract tests PASS");
