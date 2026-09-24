import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    BOARD_CAPABILITIES,
    SPECIAL_BLOCK_TYPES,
    isSpecialBlockFunctional,
    readCellCapabilities,
    readSpecialBlockTrialTraits
} from "../game/src/core/special_block_domain.js";
import {
    SPECIAL_BLOCK_PRODUCTION_KINDS,
    SPECIAL_BLOCK_PRODUCTION_STATUS,
    SpecialBlockProductionResolver
} from "../game/src/core/special_block_production.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";

function makeCell(entity) {
    return {
        r: 0,
        c: 0,
        placed: true,
        isHQ: false,
        terrain: {
            id: "GL1_PLAINS",
            terrainId: "GL1_PLAINS",
            capabilities: []
        },
        specialBlock: entity,
        entities: []
    };
}

function makeState(entity) {
    return {
        turn: 8,
        food: 10,
        wood: 10,
        material: 10,
        defense: 5,
        currentDefense: 5,
        maxDefense: 5,
        mystic: 0,
        ember: 10,
        maxEmber: 20,
        grid: [[makeCell(entity)]],
        mergedBlocks: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        reserveSlots: [],
        handOffering: [],
        placedBlockProduction: {},
        stage: { id: 1, name: "Stage 1", size: 1, maxTiles: 1 }
    };
}

// Legacy save compatibility: missing state keeps the historical ACTIVE behavior.
{
    const legacyEntity = {
        instanceId: "WATCHTOWER@0:0",
        type: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        definitionId: SPECIAL_BLOCK_TYPES.WATCHTOWER
    };
    const cell = makeCell(legacyEntity);
    assert.equal(isSpecialBlockFunctional(legacyEntity), true);
    assert.equal(
        readCellCapabilities(cell).has(BOARD_CAPABILITIES.OBSERVATION_SITE),
        true
    );
}

// Explicit ACTIVE remains functional.
{
    const active = {
        instanceId: "PALISADE@0:0",
        type: SPECIAL_BLOCK_TYPES.PALISADE,
        definitionId: SPECIAL_BLOCK_TYPES.PALISADE,
        state: "ACTIVE"
    };
    const cell = makeCell(active);
    assert.equal(isSpecialBlockFunctional(active), true);
    assert.equal(readCellCapabilities(cell).has(BOARD_CAPABILITIES.MILITARY_SITE), true);
    assert.equal(readSpecialBlockTrialTraits(cell)?.interceptionAllowed, true);
}

// Any explicit non-ACTIVE lifecycle state suppresses function but does not erase the entity.
{
    const inactive = {
        instanceId: "PALISADE@0:0",
        type: SPECIAL_BLOCK_TYPES.PALISADE,
        definitionId: SPECIAL_BLOCK_TYPES.PALISADE,
        state: "DYSFUNCTIONAL"
    };
    const state = makeState(inactive);
    const service = new SpecialBlockService(state);
    const adapter = new BoardDomainAdapter({
        state,
        gridEngine: null,
        specialBlockService: service
    });

    assert.equal(adapter.isSpecialBlockFunctional({ r: 0, c: 0 }), false);
    assert.equal(
        adapter.readCapabilities({ r: 0, c: 0 }).has(BOARD_CAPABILITIES.MILITARY_SITE),
        false,
        "inactive Special Block exposes no functional capability"
    );
    assert.equal(
        adapter.readTrialTraits({ r: 0, c: 0 }),
        null,
        "inactive Special Block exposes no Trial traits"
    );
    assert.equal(
        adapter.hasEntity(SPECIAL_BLOCK_TYPES.PALISADE),
        true,
        "inactive Special Block remains a persisted Board entity"
    );

    const serialized = serializeGameState(state);
    assert.equal(
        serialized.grid[0][0].specialBlock.state,
        "DYSFUNCTIONAL",
        "lifecycle state persists through canonical Board serialization"
    );
}

// Production obeys the same lifecycle gate and distinguishes inactivity from unresolved balance.
{
    const resolver = new SpecialBlockProductionResolver({
        definitionResolver: () => ({
            id: "TEST_PRODUCTION",
            production: {
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.FIXED,
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: { food: 3 }
            }
        })
    });

    const inactiveCell = makeCell({
        type: "TEST_PRODUCTION",
        definitionId: "TEST_PRODUCTION",
        state: "DYSFUNCTIONAL"
    });
    const inactive = resolver.resolveCell({ grid: [[inactiveCell]] }, inactiveCell, { r: 0, c: 0 });
    assert.equal(inactive.status, SPECIAL_BLOCK_PRODUCTION_STATUS.NONE);
    assert.deepEqual(inactive.yields, { food: 0, wood: 0, defense: 0, mystic: 0 });

    const activeCell = makeCell({
        type: "TEST_PRODUCTION",
        definitionId: "TEST_PRODUCTION",
        state: "ACTIVE"
    });
    const active = resolver.resolveCell({ grid: [[activeCell]] }, activeCell, { r: 0, c: 0 });
    assert.equal(active.status, SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED);
    assert.deepEqual(active.yields, { food: 3, wood: 0, defense: 0, mystic: 0 });
}

console.log("test_special_block_lifecycle_functional_gate: PASS");
