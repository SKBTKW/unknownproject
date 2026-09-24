import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_PRODUCTION_KINDS,
    ZONE_CONVERSION_PRODUCTION_STATUS,
    ZONE_CONVERSION_STATES
} from "../game/src/core/zone_conversion_domain.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { ProductionCalculator } from "../game/src/systems/production_calculator.js";
import { ZoneConversionService } from "../game/src/systems/zone_conversion_service.js";

console.log("\nZone Conversion production modifier boundary");

function emptyCell(r, c) {
    return {
        r, c,
        placed: false,
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId: null,
        terrain: null,
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

function plainsCell(r, c) {
    return {
        ...emptyCell(r, c),
        placed: true,
        merged: true,
        mergeGroupId: "zone_food",
        mergeType: "2x2",
        terrain: {
            id: "GL1_PLAINS",
            terrainId: "GL1_PLAINS",
            zoneCategory: "PLAINS",
            food: 4,
            wood: 0,
            material: 0,
            defense: 0,
            mystic: 0
        }
    };
}

function makeState() {
    const grid = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => emptyCell(r, c))
    );
    const cells = [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 1, c: 0 },
        { r: 1, c: 1 }
    ];
    for (const pt of cells) grid[pt.r][pt.c] = plainsCell(pt.r, pt.c);
    grid[2][2] = {
        ...emptyCell(2, 2),
        placed: true,
        isHQ: true,
        terrain: { id: "HQ", food: 5, wood: 5, defense: 5, mystic: 1 }
    };

    return {
        turn: 10,
        ember: 8,
        maxEmber: 20,
        food: 100,
        wood: 100,
        material: 100,
        defense: 5,
        currentDefense: 5,
        maxDefense: 5,
        mystic: 0,
        reserveSlots: [],
        handOffering: [],
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        grid,
        mergedBlocks: {
            zone_food: {
                groupId: "zone_food",
                terrainId: "GL1_PLAINS",
                zoneCategory: "PLAINS",
                mergeType: "2x2",
                cells,
                yieldMultiplier: 1.2,
                createdTurn: 5
            }
        },
        placedBlockProduction: {},
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 },
        isHQVicinity() {
            return false;
        }
    };
}

const resolvedDefinition = {
    id: "FOOD_ZONE_TEST",
    eligibleZoneAttributes: ["PLAINS"],
    requirements: { resources: {} },
    creationCost: {
        status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
        base: {}
    },
    maintenance: {
        status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
        resources: {}
    },
    production: {
        status: ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED,
        kind: ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL,
        perMemberYields: { food: 1 }
    },
    capabilities: []
};

const unresolvedDefinition = {
    ...resolvedDefinition,
    id: "UNRESOLVED_PRODUCTION",
    production: {
        status: ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
        kind: ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL
    }
};

const invalidDefinition = {
    ...resolvedDefinition,
    id: "INVALID_PRODUCTION",
    production: {
        status: ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED,
        kind: ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL,
        perMemberYields: { defense: 1 }
    }
};

const state = makeState();
const service = new ZoneConversionService({
    state,
    definitions: {
        FOOD_ZONE_TEST: resolvedDefinition,
        UNRESOLVED_PRODUCTION: unresolvedDefinition,
        INVALID_PRODUCTION: invalidDefinition
    }
});
state.zoneConversionService = service;

const adapter = new BoardDomainAdapter({
    state,
    gridEngine: null,
    zoneConversionService: service
});

const baseline = ProductionCalculator.calculateTotalProduction(state);
assert.deepEqual(adapter.sumZoneConversionProduction(), {
    yields: { food: 0, wood: 0, mystic: 0 },
    unresolved: []
});

const created = service.createConversion("FOOD_ZONE_TEST", "zone_food", {
    createdVerse: 10
});
assert.equal(created.success, true);

const resolved = adapter.resolveZoneConversionProduction("zone_food");
assert.equal(resolved.status, ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED);
assert.equal(resolved.kind, ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL);
assert.equal(resolved.memberCount, 4);
assert.deepEqual(resolved.yields, { food: 4, wood: 0, mystic: 0 });
assert.deepEqual(adapter.sumZoneConversionProduction().yields, {
    food: 4,
    wood: 0,
    mystic: 0
});

const active = ProductionCalculator.calculateTotalProduction(state);
assert.equal(
    active.grossFood - baseline.grossFood,
    4,
    "ACTIVE PER_MEMBER_CELL conversion production is included exactly once"
);
assert.equal(active.totalWood, baseline.totalWood);
assert.equal(active.totalMystic, baseline.totalMystic);
assert.equal(active.zoneConversionProduction.yields.food, 4);

const breakdown = ProductionCalculator.getResourceBreakdown(state);
assert.equal(breakdown.food.zoneConversions, 4);
assert.equal(breakdown.wood.zoneConversions, 0);
assert.equal(breakdown.mystic.zoneConversions, 0);

const cellBreakdown = ProductionCalculator.calculateCellYieldBreakdown(state, 0, 0);
const zoneModifier = cellBreakdown.modifiers.find(modifier => modifier.type === "ZONE_CONVERSION");
assert.ok(zoneModifier, "cell breakdown must expose the active Zone Conversion modifier");
assert.equal(zoneModifier.resource, "food");
assert.equal(zoneModifier.amount, 1);
assert.equal(zoneModifier.definitionId, "FOOD_ZONE_TEST");
assert.equal(zoneModifier.groupId, "zone_food");
assert.equal(
    cellBreakdown.totalYields.food,
    cellBreakdown.baseYields.food + 1,
    "cell breakdown and aggregate production must use the same per-member definition authority"
);

const failedMaintenance = service.applyMaintenanceSettlement("zone_food", {
    verse: 11,
    paymentSucceeded: false
});
assert.equal(failedMaintenance.success, true);
assert.equal(failedMaintenance.state, ZONE_CONVERSION_STATES.DYSFUNCTIONAL);
assert.deepEqual(adapter.sumZoneConversionProduction().yields, {
    food: 0,
    wood: 0,
    mystic: 0
});
assert.equal(
    ProductionCalculator.calculateTotalProduction(state).grossFood,
    baseline.grossFood,
    "DYSFUNCTIONAL conversion contributes zero production"
);

const recovered = service.applyMaintenanceSettlement("zone_food", {
    verse: 12,
    paymentSucceeded: true
});
assert.equal(recovered.success, true);
assert.equal(recovered.state, ZONE_CONVERSION_STATES.ACTIVE);
assert.equal(
    ProductionCalculator.calculateTotalProduction(state).grossFood - baseline.grossFood,
    4
);

// Persisted identity + injected definition authority reconstruct the same modifier after restore.
const serialized = serializeGameState(state);
const restored = makeState();
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
const restoredService = new ZoneConversionService({
    state: restored,
    definitions: { FOOD_ZONE_TEST: resolvedDefinition }
});
restored.zoneConversionService = restoredService;
assert.deepEqual(restoredService.sumProduction().yields, {
    food: 4,
    wood: 0,
    mystic: 0
});

// Missing or unresolved definition must fail closed and never invent production.
restored.mergedBlocks.zone_food.conversion = Object.freeze({
    ...restored.mergedBlocks.zone_food.conversion,
    definitionId: "UNRESOLVED_PRODUCTION"
});
const unresolvedService = new ZoneConversionService({
    state: restored,
    definitions: { UNRESOLVED_PRODUCTION: unresolvedDefinition }
});
assert.equal(
    unresolvedService.resolveProduction("zone_food").status,
    ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED
);
assert.equal(unresolvedService.sumProduction().unresolved.length, 1);
assert.deepEqual(unresolvedService.sumProduction().yields, {
    food: 0,
    wood: 0,
    mystic: 0
});

// Active conversion on a no-longer-completed Zone fails closed instead of inventing yields.
const malformed = makeState();
malformed.mergedBlocks.zone_food.conversion = Object.freeze({
    instanceId: "ZONE_CONVERSION@zone_food@FOOD_ZONE_TEST",
    definitionId: "FOOD_ZONE_TEST",
    state: ZONE_CONVERSION_STATES.ACTIVE,
    createdVerse: 10,
    sequence: 1,
    paidCost: Object.freeze({}),
    maintenance: Object.freeze({
        status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
        resources: Object.freeze({}),
        startsVerse: 11,
        lastSettledVerse: null,
        lastPaymentSucceeded: null
    }),
    capabilities: Object.freeze([])
});
malformed.mergedBlocks.zone_food.cells = malformed.mergedBlocks.zone_food.cells.slice(0, 3);
const malformedService = new ZoneConversionService({
    state: malformed,
    definitions: { FOOD_ZONE_TEST: resolvedDefinition }
});
assert.equal(
    malformedService.resolveProduction("zone_food").status,
    ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
    "incomplete/corrupt Zone must never keep producing through a stale conversion record"
);
assert.deepEqual(malformedService.sumProduction().yields, {
    food: 0,
    wood: 0,
    mystic: 0
});

const missingDefinitionService = new ZoneConversionService({
    state: restored,
    definitions: {}
});
assert.equal(
    missingDefinitionService.resolveProduction("zone_food").status,
    ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED
);

const invalidService = new ZoneConversionService({
    state: restored,
    definitions: { UNRESOLVED_PRODUCTION: invalidDefinition }
});
assert.equal(
    invalidService.resolveProduction("zone_food").status,
    ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
    "unsupported production resource fails closed"
);

console.log("  ACTIVE PER_MEMBER_CELL production aggregates once");
console.log("  Production breakdown exposes Zone Conversion contribution");
console.log("  DYSFUNCTIONAL conversion contributes zero");
console.log("  restore + definition authority reproduces production");
console.log("  missing/unresolved/invalid definitions fail closed");
console.log("✅ Zone Conversion production modifier boundary PASS");
