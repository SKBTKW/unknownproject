import assert from "node:assert/strict";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    ZONE_CONVERSION_CAPABILITIES,
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_ESCALATION_SCOPES
} from "../game/src/core/zone_conversion_domain.js";
import { ZoneConversionService } from "../game/src/systems/zone_conversion_service.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";

function makeCell(r, c, terrainId = "E2_HILL") {
    return {
        r, c,
        placed: true,
        isHQ: false,
        merged: true,
        mergeGroupId: "zone_a",
        mergeType: "L_SHAPE",
        placementGroupId: null,
        terrain: {
            id: terrainId,
            terrainId,
            zoneCategory: terrainId,
            food: 0,
            wood: 1,
            defense: 1,
            mystic: 0
        },
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

function makeState() {
    const grid = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => ({
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
        }))
    );

    const zoneACells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }];
    for (const pt of zoneACells) grid[pt.r][pt.c] = makeCell(pt.r, pt.c);

    const zoneBCells = [{ r: 3, c: 2 }, { r: 4, c: 1 }, { r: 4, c: 2 }, { r: 4, c: 3 }];
    for (const pt of zoneBCells) {
        grid[pt.r][pt.c] = {
            ...makeCell(pt.r, pt.c, "E3_MOUNTAIN"),
            mergeGroupId: "zone_b",
            mergeType: "T_SHAPE"
        };
    }

    return {
        turn: 20,
        ember: 8,
        maxEmber: 20,
        food: 30,
        wood: 25,
        material: 25,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 5,
        reserveSlots: [],
        handOffering: [],
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        grid,
        mergedBlocks: {
            zone_a: {
                groupId: "zone_a",
                terrainId: "E2_HILL",
                zoneCategory: "E2_HILL",
                mergeType: "L_SHAPE",
                cells: zoneACells,
                yieldMultiplier: 1.2,
                createdTurn: 10
            },
            zone_b: {
                groupId: "zone_b",
                terrainId: "E3_MOUNTAIN",
                zoneCategory: "E3_MOUNTAIN",
                mergeType: "T_SHAPE",
                cells: zoneBCells,
                yieldMultiplier: 1.2,
                createdTurn: 12
            },
            incomplete: {
                groupId: "incomplete",
                terrainId: "GL1_PLAINS",
                zoneCategory: "PLAINS",
                mergeType: "1x3",
                cells: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }]
            }
        },
        placedBlockProduction: {},
        stage: { id: 1, name: "Stage 1", size: 5, maxTiles: 24 }
    };
}

const definitions = {
    GARRISON_TEST: {
        id: "GARRISON_TEST",
        eligibleZoneAttributes: ["E2_HILL", "E3_MOUNTAIN"],
        requirements: {
            resources: { food: 10, wood: 8 }
        },
        creationCost: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: { wood: 6, ember: 1 },
            escalation: {
                scope: ZONE_CONVERSION_ESCALATION_SCOPES.SAME_DEFINITION,
                perConversion: { wood: 3 }
            }
        },
        maintenance: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: { food: 2 }
        },
        capabilities: [ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE]
    },
    UNRESOLVED_COST: {
        id: "UNRESOLVED_COST",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: { food: 1 } },
        creationCost: { status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED },
        maintenance: { status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED },
        capabilities: []
    }
};

const state = makeState();
const service = new ZoneConversionService({ state, definitions });
const adapter = new BoardDomainAdapter({
    state,
    gridEngine: null,
    zoneConversionService: service
});

assert.equal(service.validateCandidate("GARRISON_TEST", "zone_a").valid, true);
assert.equal(service.validateCandidate("GARRISON_TEST", "incomplete").valid, false);
assert.equal(service.validateCandidate("UNRESOLVED_COST", "zone_a").valid, false);

const initialCandidates = service.enumerateCandidates("GARRISON_TEST");
assert.equal(initialCandidates.length, 2, "both completed eligible Zones are candidates");

const initialCost = service.quoteCost("GARRISON_TEST");
assert.equal(initialCost.status, ZONE_CONVERSION_COST_STATUS.RESOLVED);
assert.deepEqual(initialCost.resources, { wood: 6, ember: 1 });
assert.equal(initialCost.conversionCount, 0);

const beforeResources = {
    food: state.food,
    wood: state.wood,
    ember: state.ember
};
const beforeZone = JSON.parse(JSON.stringify(state.mergedBlocks.zone_a));

const paymentRequired = service.createConversion("GARRISON_TEST", "zone_a");
assert.equal(paymentRequired.success, false);
assert.equal(paymentRequired.reason, "PAYMENT_CONFIRMATION_REQUIRED");
assert.equal(state.mergedBlocks.zone_a.conversion, undefined);

const createdA = service.createConversion("GARRISON_TEST", "zone_a", {
    paymentConfirmed: true,
    createdVerse: 20
});
assert.equal(createdA.success, true);
assert.equal(state.mergedBlocks.zone_a.terrainId, beforeZone.terrainId);
assert.equal(state.mergedBlocks.zone_a.mergeType, beforeZone.mergeType);
assert.deepEqual(state.mergedBlocks.zone_a.cells, beforeZone.cells);
assert.deepEqual(
    { food: state.food, wood: state.wood, ember: state.ember },
    beforeResources,
    "Board records paid cost but never spends Card/Economy resources itself"
);
assert.deepEqual(createdA.conversion.paidCost, { wood: 6, ember: 1 });
assert.deepEqual(createdA.conversion.maintenance, {
    status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
    resources: { food: 2 }
});
assert.equal(
    createdA.conversion.capabilities.includes(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE),
    true
);
assert.equal(adapter.hasCapability("GARRISON"), true);
assert.equal(adapter.hasCapability(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE), true);

assert.equal(service.validateCandidate("GARRISON_TEST", "zone_a").valid, false);
assert.equal(service.validateCandidate("GARRISON_TEST", "zone_a").reasons[0], "ZONE_ALREADY_CONVERTED");

const escalated = service.quoteCost("GARRISON_TEST");
assert.deepEqual(escalated.resources, { wood: 9, ember: 1 });
assert.equal(escalated.conversionCount, 1);

const createdB = service.createConversion("GARRISON_TEST", "zone_b", {
    paymentConfirmed: true
});
assert.equal(createdB.success, true);
assert.deepEqual(createdB.conversion.paidCost, { wood: 9, ember: 1 });
assert.equal(service.getConversionCount("GARRISON_TEST"), 2);
assert.equal(adapter.hasCapability("GARRISON_SITE", { minimum: 2 }), true);

const serialized = serializeGameState(state);
assert.equal(serialized.mergedBlocks.zone_a.conversion.definitionId, "GARRISON_TEST");
assert.equal(serialized.mergedBlocks.zone_b.conversion.definitionId, "GARRISON_TEST");

const restored = makeState();
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
assert.equal(restored.mergedBlocks.zone_a.conversion.definitionId, "GARRISON_TEST");
assert.equal(restored.mergedBlocks.zone_b.conversion.sequence, 2);

console.log("PASS zone conversion foundation");
