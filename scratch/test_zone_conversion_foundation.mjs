import assert from "node:assert/strict";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { BOARD_CAPABILITIES } from "../game/src/core/special_block_domain.js";
import {
    ZONE_CONVERSION_CAPABILITIES,
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_ESCALATION_SCOPES,
    ZONE_CONVERSION_STATES
} from "../game/src/core/zone_conversion_domain.js";
import { ZoneConversionService } from "../game/src/systems/zone_conversion_service.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";
import { TurnLifecycleService } from "../game/src/core/turn_lifecycle_service.js";

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
        capabilities: [
            ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE,
            ZONE_CONVERSION_CAPABILITIES.DEFENSE_ANCHOR
        ]
    },
    UNRESOLVED_COST: {
        id: "UNRESOLVED_COST",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: { food: 1 } },
        creationCost: { status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED },
        maintenance: { status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED },
        capabilities: []
    },
    UNRESOLVED_MAINTENANCE: {
        id: "UNRESOLVED_MAINTENANCE",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: { food: 1 } },
        creationCost: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: {}
        },
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

const injectedDefinitionState = makeState();
const injectedDefinitionAdapter = new BoardDomainAdapter({
    state: injectedDefinitionState,
    gridEngine: null,
    zoneConversionDefinitions: definitions
});
assert.equal(
    injectedDefinitionAdapter.enumerateZoneConversionCandidates("GARRISON_TEST").length,
    2,
    "Board runtime definition port constructs a usable ZoneConversionService"
);
assert.deepEqual(
    injectedDefinitionAdapter.quoteZoneConversionCost("GARRISON_TEST").resources,
    { wood: 6, ember: 1 }
);

assert.equal(service.validateCandidate("GARRISON_TEST", "zone_a").valid, true);
assert.equal(service.validateCandidate("GARRISON_TEST", "incomplete").valid, false);
assert.equal(service.validateCandidate("UNRESOLVED_COST", "zone_a").valid, false);
const unresolvedMaintenance = service.validateCandidate("UNRESOLVED_MAINTENANCE", "zone_a");
assert.equal(unresolvedMaintenance.valid, false);
assert.equal(
    unresolvedMaintenance.reasons.includes("MAINTENANCE_DEFINITION_UNRESOLVED"),
    true,
    "candidate fails closed before Offering when maintenance is not defined"
);

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
assert.equal(adapter.getZoneConversionCount("GARRISON_TEST"), 1);
assert.equal(adapter.readZoneConversion("zone_a").definitionId, "GARRISON_TEST");
assert.equal(adapter.isZoneConversionFunctional("zone_a"), true);
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
    resources: { food: 2 },
    startsVerse: 21,
    lastSettledVerse: null,
    lastPaymentSucceeded: null
});
assert.equal(
    createdA.conversion.capabilities.includes(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE),
    true
);
assert.equal(adapter.hasCapability("GARRISON"), true);
assert.equal(adapter.hasCapability(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE), true);

const activeFacts = adapter.readTrialDeploymentFacts({ r: 0, c: 1 });
assert.equal(
    activeFacts.capabilities.includes(BOARD_CAPABILITIES.DEFENSE_ANCHOR),
    true,
    "active converted Zone projects DEFENSE_ANCHOR to its cells"
);
const activeOrigins = adapter.listTrialDeploymentOrigins();
const zoneOrigin = activeOrigins.find(origin => origin.kind === BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN);
assert.ok(zoneOrigin, "active Garrison Zone projects one semantic reinforcement origin");
assert.deepEqual(
    zoneOrigin.cell,
    { r: 0, c: 0 },
    "Board owns a deterministic representative origin cell"
);
assert.equal(
    zoneOrigin.capabilities.includes(BOARD_CAPABILITIES.GARRISON_SITE),
    false,
    "facility identity must not leak into Trial origin semantics"
);

const creationVersePlan = adapter.getZoneConversionMaintenancePlan("zone_a", 20);
assert.equal(creationVersePlan.defined, true);
assert.equal(creationVersePlan.due, false, "maintenance starts on the Verse after conversion");

state.food = 1;
const duePlan = adapter.getZoneConversionMaintenancePlan("zone_a", 21);
assert.equal(duePlan.due, true);
assert.equal(duePlan.canPay, false);
assert.deepEqual(duePlan.shortfalls, { food: 1 });

const beforeFailedMaintenanceFood = state.food;
const maintenanceLifecycle = Object.create(TurnLifecycleService.prototype);
maintenanceLifecycle.engine = {
    state,
    zoneConversionService: service
};
const failedVerse = maintenanceLifecycle.settleZoneConversionMaintenanceForVerse(21);
assert.equal(failedVerse.results.length, 1);
assert.equal(failedVerse.results[0].success, true);
assert.equal(failedVerse.results[0].state, ZONE_CONVERSION_STATES.DYSFUNCTIONAL);
assert.equal(adapter.isZoneConversionFunctional("zone_a"), false);
assert.equal(state.food, beforeFailedMaintenanceFood, "failed maintenance never partially spends resources");
assert.equal(
    adapter.hasCapability(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE),
    false,
    "any maintenance failure disables all conversion capabilities"
);
assert.equal(
    adapter.readTrialDeploymentFacts({ r: 0, c: 1 }).capabilities.includes(BOARD_CAPABILITIES.DEFENSE_ANCHOR),
    false,
    "dysfunctional conversion must not project DEFENSE_ANCHOR"
);
assert.equal(
    adapter.listTrialDeploymentOrigins().some(origin => origin.kind === BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN),
    false,
    "dysfunctional conversion must not remain a reinforcement origin"
);
assert.equal(
    adapter.getZoneConversionMaintenancePlan("zone_a", 21).due,
    false,
    "same Verse cannot settle maintenance twice"
);

state.food = 30;
const recoveryPlan = adapter.getZoneConversionMaintenancePlan("zone_a", 22);
assert.equal(recoveryPlan.due, true);
assert.equal(recoveryPlan.canPay, true);
const recoveredVerse = maintenanceLifecycle.settleZoneConversionMaintenanceForVerse(22);
assert.equal(recoveredVerse.results.length, 1);
assert.equal(recoveredVerse.results[0].success, true);
assert.equal(recoveredVerse.results[0].state, ZONE_CONVERSION_STATES.ACTIVE);
assert.equal(adapter.isZoneConversionFunctional("zone_a"), true);
assert.equal(state.food, 28, "successful maintenance spends the full upkeep exactly once");
assert.equal(adapter.hasCapability(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE), true);
assert.equal(
    adapter.readTrialDeploymentFacts({ r: 0, c: 1 }).capabilities.includes(BOARD_CAPABILITIES.DEFENSE_ANCHOR),
    true,
    "recovered conversion restores DEFENSE_ANCHOR"
);
assert.equal(
    adapter.listTrialDeploymentOrigins().some(origin => origin.kind === BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN),
    true,
    "recovered conversion restores reinforcement origin"
);

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
assert.equal(adapter.getZoneConversionCount("GARRISON_TEST"), 2);
assert.equal(adapter.hasCapability("GARRISON_SITE", { minimum: 2 }), true);

const serialized = serializeGameState(state);
assert.equal(serialized.mergedBlocks.zone_a.conversion.definitionId, "GARRISON_TEST");
assert.equal(serialized.mergedBlocks.zone_b.conversion.definitionId, "GARRISON_TEST");

const restored = makeState();
hydrateGameState(restored, serialized, { resolveCardMaster: () => null });
assert.equal(restored.mergedBlocks.zone_a.conversion.definitionId, "GARRISON_TEST");
assert.equal(restored.mergedBlocks.zone_b.conversion.sequence, 2);

// Verse initialization order: increment Verse -> settle Zone upkeep -> generate Offering.
{
    const order = [];
    const lifecycle = Object.create(TurnLifecycleService.prototype);
    lifecycle.engine = {
        state: {
            turn: 30,
            hasPickedThisTurn: true,
            hasReservedThisTurn: true,
            hasMulliganedThisTurn: true
        },
        zoneConversionService: {
            enumerateMaintenanceDue(verse) {
                order.push(`maintenance:${verse}`);
                return [];
            },
            applyMaintenanceSettlement() {
                throw new Error("not expected");
            }
        },
        deckManager: {
            generateOfferingCards() {
                order.push("offering");
            }
        },
        globalEventManager: null
    };
    lifecycle._initializeNextTurn();
    assert.equal(lifecycle.engine.state.turn, 31);
    assert.deepEqual(order, ["maintenance:31", "offering"]);
    assert.equal(lifecycle.engine.lastZoneConversionMaintenanceResult.verse, 31);
}

console.log("PASS zone conversion foundation");
