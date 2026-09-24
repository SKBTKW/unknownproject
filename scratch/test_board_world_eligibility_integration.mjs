import assert from "node:assert/strict";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { ConditionEvaluator } from "../game/src/core/condition_evaluator.js";
import { CardOfferingEligibilityService } from "../game/src/cards/card_offering_eligibility_service.js";

const state = {
    grid: [
        [
            {
                placed: true,
                terrain: { terrainId: "E0_WETLAND" },
                socketResource: { id: "SOCKET_LAKE", capabilities: ["WATER_SOURCE"] }
            },
            {
                placed: true,
                terrain: { terrainId: "E2_HILL" },
                specialBlock: { type: "WATCHTOWER", definitionId: "WATCHTOWER" }
            }
        ],
        [
            {
                placed: true,
                terrain: { terrainId: "GL1_PLAINS" },
                specialBlock: { type: "MINE", definitionId: "MINE" }
            },
            null
        ]
    ]
};

const boardQuery = new BoardDomainAdapter({ state, gridEngine: null });

assert.equal(boardQuery.hasTerrain("WETLAND"), true);
assert.equal(boardQuery.hasTerrain("E0_WETLAND"), true);
assert.equal(boardQuery.hasTerrain("PLAINS"), true);
assert.equal(boardQuery.hasTerrain("DESERT"), false);
assert.equal(boardQuery.hasTerrain("WETLAND", { minimum: 2 }), false);

assert.equal(boardQuery.hasEntity("MINE"), true);
assert.equal(boardQuery.hasEntity("WATCHTOWER"), true);
assert.equal(boardQuery.hasEntity("PALISADE"), false);

assert.equal(boardQuery.hasCapability("WATER_SOURCE"), true);
assert.equal(boardQuery.hasCapability("OBSERVATION"), true);
assert.equal(boardQuery.hasCapability("OBSERVATION_SITE"), true);
assert.equal(
    boardQuery.hasCapability("MILITARY"),
    false,
    "WATCHTOWER observation capability must not imply MILITARY"
);
assert.equal(
    boardQuery.hasCapability("INVESTIGATION"),
    false,
    "WATCHTOWER observation capability must not imply INVESTIGATION"
);
assert.equal(boardQuery.hasCapability("PRODUCTION"), true);
assert.equal(boardQuery.hasCapability("MYSTIC_SOURCE"), false);

const worldContext = {
    state,
    boardQuery,
    historyQuery: { matches: () => false }
};

assert.equal(
    ConditionEvaluator.evaluateStrict(
        { type: "HAS_TERRAIN", terrain: "WETLAND", value: 1 },
        worldContext
    ),
    true
);
assert.equal(
    ConditionEvaluator.evaluateStrict(
        { type: "HAS_ENTITY", entity: "MINE" },
        worldContext
    ),
    true
);
assert.equal(
    ConditionEvaluator.evaluateStrict(
        { type: "HAS_CAPABILITY", capability: "OBSERVATION" },
        worldContext
    ),
    true
);
assert.equal(
    ConditionEvaluator.evaluateStrict(
        { type: "HAS_CAPABILITY", capability: "MYSTIC_SOURCE" },
        worldContext
    ),
    false
);

const offeringService = new CardOfferingEligibilityService({
    state,
    placementQuery: { hasAnyLegalPlacement: () => true },
    requirementEvaluator: requirement =>
        ConditionEvaluator.evaluateStrict(requirement, worldContext)
});

const eligibleCard = {
    id: "TEST_WORLD_ELIGIBLE",
    category: "COMMAND",
    offering: {
        requirements: [
            { type: "HAS_TERRAIN", terrain: "WETLAND" },
            { type: "HAS_ENTITY", entity: "MINE" },
            { type: "HAS_CAPABILITY", capability: "OBSERVATION" }
        ]
    }
};
assert.equal(offeringService.evaluate(eligibleCard).eligible, true);

const ineligibleCard = {
    id: "TEST_WORLD_INELIGIBLE",
    category: "COMMAND",
    offering: {
        requirements: [{ type: "HAS_TERRAIN", terrain: "DESERT" }]
    }
};
assert.equal(offeringService.evaluate(ineligibleCard).eligible, false);

console.log("PASS board world eligibility integration");
