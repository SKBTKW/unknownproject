import assert from "node:assert/strict";

import {
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES,
    resolveSpecialBlockCreationCost
} from "../game/src/core/special_block_domain.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";

console.log("\nSpecial Block creation-cost quote boundary");

assert.deepEqual(
    resolveSpecialBlockCreationCost({ id: "UNRESOLVED" }),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null }
);

assert.deepEqual(
    resolveSpecialBlockCreationCost({
        id: "RESOLVED",
        creationCost: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: 6, ember: 1 }
        }
    }),
    {
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources: { wood: 6, ember: 1 }
    }
);

assert.deepEqual(
    resolveSpecialBlockCreationCost({
        id: "INVALID",
        creationCost: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: -1 }
        }
    }),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null }
);

const unresolvedService = new SpecialBlockService({ grid: [] });
assert.deepEqual(
    unresolvedService.quoteCost(SPECIAL_BLOCK_TYPES.FARM),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null },
    "foundation must not invent FARM balance values"
);
assert.deepEqual(
    unresolvedService.quoteCost(SPECIAL_BLOCK_TYPES.LOGGING_CAMP),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null },
    "foundation must not invent LOGGING_CAMP balance values"
);
assert.deepEqual(
    unresolvedService.quoteCost(SPECIAL_BLOCK_TYPES.ALTAR),
    { status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED, resources: null },
    "foundation must not invent ALTAR balance values"
);

function cell(r, c, terrain = null) {
    return {
        r,
        c,
        placed: Boolean(terrain),
        isHQ: false,
        terrain,
        specialBlock: null,
        capabilities: []
    };
}

const plains = {
    id: "GL1_PLAINS",
    terrainId: "GL1_PLAINS",
    gl: 1,
    e: 1,
    food: 1,
    wood: 0,
    defense: 0,
    mystic: 0
};

const state = {
    turn: 7,
    grid: [
        [cell(0, 0, plains), cell(0, 1), cell(0, 2)],
        [cell(1, 0), cell(1, 1), cell(1, 2)],
        [cell(2, 0), cell(2, 1), cell(2, 2)]
    ]
};

const service = new SpecialBlockService(state);
const adapter = new BoardDomainAdapter({
    state,
    gridEngine: null,
    specialBlockService: service
});

const resolvedDefinition = {
    id: SPECIAL_BLOCK_TYPES.GRANARY,
    placement: {
        mode: "OVERLAY",
        requirePlacedTerrain: true,
        excludeHQ: true,
        requireEmptySpecialBlock: true,
        terrainIds: ["GL1_PLAINS"]
    },
    baseTerrainInteraction: { kind: "TERRAIN_USING_OVERLAY" },
    creationCost: {
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources: { wood: 6, ember: 1 }
    },
    capabilities: [],
    trialTraits: {},
    lifecycle: { initialState: "ACTIVE" }
};

assert.deepEqual(
    adapter.quoteSpecialBlockCost(resolvedDefinition),
    {
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources: { wood: 6, ember: 1 }
    },
    "Card-side consumers can ask Board for the authoritative quote without reading definitions"
);

const validPostPayment = adapter.validateSpecialBlockTargetAfterPayment(
    resolvedDefinition,
    { r: 0, c: 0 },
    { wood: 6, ember: 1 }
);
assert.equal(validPostPayment.valid, true);
assert.deepEqual(validPostPayment.projectedPayment, { wood: 6, ember: 1 });

const wrongPayment = adapter.validateSpecialBlockTargetAfterPayment(
    resolvedDefinition,
    { r: 0, c: 0 },
    { wood: 5, ember: 1 }
);
assert.equal(wrongPayment.valid, false);
assert.equal(wrongPayment.reason, "PAYMENT_COST_MISMATCH");

// Commit-time guard is tested without authoring a gameplay balance value:
// override only this test instance's quote for canonical GRANARY.
service.quoteCost = () => ({
    status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
    resources: Object.freeze({ wood: 6, ember: 1 })
});

const noConfirmation = adapter.createSpecialBlock(
    SPECIAL_BLOCK_TYPES.GRANARY,
    { r: 0, c: 0 },
    {}
);
assert.equal(noConfirmation.success, false);
assert.equal(noConfirmation.reason, "PAYMENT_CONFIRMATION_REQUIRED");
assert.equal(state.grid[0][0].specialBlock, null);

const stalePayment = adapter.createSpecialBlock(
    SPECIAL_BLOCK_TYPES.GRANARY,
    { r: 0, c: 0 },
    {
        paymentConfirmed: true,
        paidCost: { wood: 5, ember: 1 }
    }
);
assert.equal(stalePayment.success, false);
assert.equal(stalePayment.reason, "PAYMENT_COST_MISMATCH");
assert.equal(state.grid[0][0].specialBlock, null, "stale payment must never mutate Board");

const committed = adapter.createSpecialBlock(
    SPECIAL_BLOCK_TYPES.GRANARY,
    { r: 0, c: 0 },
    {
        paymentConfirmed: true,
        paidCost: { wood: 6, ember: 1 },
        verse: 7
    }
);
assert.equal(committed.success, true);
assert.deepEqual(committed.entity.paidCost, { wood: 6, ember: 1 });
assert.deepEqual(state.grid[0][0].specialBlock.paidCost, { wood: 6, ember: 1 });
assert.equal(state.grid[0][0].specialBlock.createdVerse, 7);

console.log("  unresolved gameplay costs remain unresolved");
console.log("  Board exposes authoritative quote + post-payment validation");
console.log("  stale paid cost cannot mutate Board");
console.log("  successful commit persists paidCost");
console.log("✅ Special Block creation-cost quote boundary PASS");
