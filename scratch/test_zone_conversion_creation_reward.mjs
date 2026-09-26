import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_REWARD_STATUS
} from "../game/src/core/zone_conversion_domain.js";
import { ZoneConversionService } from "../game/src/systems/zone_conversion_service.js";

function makeCell(r, c) {
    return {
        r,
        c,
        placed: true,
        isHQ: false,
        merged: true,
        mergeGroupId: "zone_a",
        mergeType: "L_SHAPE",
        terrain: {
            id: "E2_HILL",
            terrainId: "E2_HILL",
            zoneCategory: "E2_HILL",
            food: 0,
            wood: 1,
            defense: 1,
            mystic: 0
        },
        specialBlock: null
    };
}

function makeState() {
    const cells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 1, c: 0 }];
    const grid = Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => ({
            r, c,
            placed: false,
            isHQ: false,
            merged: false,
            mergeGroupId: null,
            mergeType: null,
            terrain: null,
            specialBlock: null
        }))
    );
    for (const pt of cells) grid[pt.r][pt.c] = makeCell(pt.r, pt.c);

    const state = {
        turn: 12,
        food: 10,
        wood: 10,
        material: 10,
        mystic: 2,
        ember: 19,
        maxEmber: 20,
        currentDefense: 4,
        maxDefense: 5,
        grid,
        mergedBlocks: {
            zone_a: {
                groupId: "zone_a",
                terrainId: "E2_HILL",
                zoneCategory: "E2_HILL",
                mergeType: "L_SHAPE",
                cells
            }
        }
    };

    state.emberSystem = {
        recoverInstant(amount) {
            const before = state.ember;
            state.ember = Math.min(state.maxEmber, state.ember + amount);
            return state.ember - before;
        }
    };
    state.defenseSystem = {
        recoverCurrentDefense(amount) {
            const before = state.currentDefense;
            state.currentDefense = Math.min(state.maxDefense, state.currentDefense + amount);
            return { recovered: state.currentDefense - before };
        }
    };
    return state;
}

const definitions = {
    REWARD_TEST: {
        id: "REWARD_TEST",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: {} },
        creationCost: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: {}
        },
        maintenance: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: {}
        },
        creationReward: {
            status: ZONE_CONVERSION_REWARD_STATUS.RESOLVED,
            resources: {
                food: 3,
                wood: 4,
                mystic: 1,
                ember: 2,
                defense: 2
            }
        },
        capabilities: []
    },
    INVALID_REWARD: {
        id: "INVALID_REWARD",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: {} },
        creationCost: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: {}
        },
        maintenance: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: {}
        },
        creationReward: {
            status: ZONE_CONVERSION_REWARD_STATUS.RESOLVED,
            resources: { unknownResource: 2 }
        },
        capabilities: []
    },
    NO_REWARD: {
        id: "NO_REWARD",
        eligibleZoneAttributes: ["E2_HILL"],
        requirements: { resources: {} },
        creationCost: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: {}
        },
        maintenance: {
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: {}
        },
        capabilities: []
    }
};

{
    const state = makeState();
    const service = new ZoneConversionService({ state, definitions });
    const adapter = new BoardDomainAdapter({
        state,
        gridEngine: null,
        zoneConversionService: service
    });

    assert.deepEqual(
        adapter.resolveZoneConversionCreationReward("NO_REWARD"),
        { status: ZONE_CONVERSION_REWARD_STATUS.NONE, resources: {} }
    );

    const invalid = service.validateCandidate("INVALID_REWARD", "zone_a");
    assert.equal(invalid.valid, false);
    assert.equal(invalid.reasons.includes("CREATION_REWARD_UNRESOLVED"), true);

    assert.deepEqual(
        adapter.resolveZoneConversionCreationReward("REWARD_TEST"),
        {
            status: ZONE_CONVERSION_REWARD_STATUS.RESOLVED,
            resources: { food: 3, wood: 4, mystic: 1, ember: 2, defense: 2 }
        }
    );

    const created = service.createConversion("REWARD_TEST", "zone_a", {
        paymentConfirmed: true,
        createdVerse: 12
    });
    assert.equal(created.success, true);

    assert.equal(state.food, 13);
    assert.equal(state.wood, 14);
    assert.equal(state.material, 14);
    assert.equal(state.mystic, 3);
    assert.equal(state.ember, 20, "Ember reward respects canonical max");
    assert.equal(state.currentDefense, 5, "Defense reward respects canonical max");

    assert.deepEqual(created.creationReward, {
        status: ZONE_CONVERSION_REWARD_STATUS.RESOLVED,
        requested: { food: 3, wood: 4, mystic: 1, ember: 2, defense: 2 },
        applied: { food: 3, wood: 4, mystic: 1, ember: 1, defense: 1 }
    });
    assert.deepEqual(
        state.mergedBlocks.zone_a.conversion.creationReward,
        created.creationReward,
        "applied reward snapshot persists with the conversion"
    );

    const afterFirst = {
        food: state.food,
        wood: state.wood,
        mystic: state.mystic,
        ember: state.ember,
        defense: state.currentDefense
    };
    const second = service.createConversion("REWARD_TEST", "zone_a", {
        paymentConfirmed: true,
        createdVerse: 12
    });
    assert.equal(second.success, false);
    assert.equal(second.reason, "ZONE_ALREADY_CONVERTED");
    assert.deepEqual(
        {
            food: state.food,
            wood: state.wood,
            mystic: state.mystic,
            ember: state.ember,
            defense: state.currentDefense
        },
        afterFirst,
        "creation reward is never applied twice"
    );
}

console.log("test_zone_conversion_creation_reward: PASS");
