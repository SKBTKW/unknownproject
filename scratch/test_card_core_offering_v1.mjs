import assert from "node:assert/strict";

import { DeckManager } from "../game/src/systems/deck_manager.js";
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
    assert.equal(state.material, 7, "wood resource delta keeps legacy material mirror in sync");
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

console.log("✅ Card Core / Offering v1 contract tests PASS");
