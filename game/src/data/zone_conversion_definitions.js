import {
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_PRODUCTION_KINDS,
    ZONE_CONVERSION_PRODUCTION_STATUS,
    ZONE_CONVERSION_REWARD_STATUS
} from "../core/zone_conversion_domain.js";

export const ZONE_CONVERSION_DEFINITION_IDS = Object.freeze({
    AGRICULTURAL_REFORM: "AGRICULTURAL_REFORM",
    RESETTLEMENT_PLAINS_2X2: "RESETTLEMENT_PLAINS_2X2"
});

export const ZONE_CONVERSION_DEFINITIONS = Object.freeze({
    [ZONE_CONVERSION_DEFINITION_IDS.AGRICULTURAL_REFORM]: Object.freeze({
        id: ZONE_CONVERSION_DEFINITION_IDS.AGRICULTURAL_REFORM,
        eligibleZoneAttributes: Object.freeze(["PLAINS"]),
        requirements: Object.freeze({
            resources: Object.freeze({})
        }),
        creationCost: Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: Object.freeze({ wood: 20 })
        }),
        maintenance: Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: Object.freeze({})
        }),
        production: Object.freeze({
            status: ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED,
            kind: ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL,
            perMemberYields: Object.freeze({ food: 1 })
        }),
        capabilities: Object.freeze([])
    }),
    [ZONE_CONVERSION_DEFINITION_IDS.RESETTLEMENT_PLAINS_2X2]: Object.freeze({
        id: ZONE_CONVERSION_DEFINITION_IDS.RESETTLEMENT_PLAINS_2X2,
        eligibleZoneAttributes: Object.freeze(["PLAINS"]),
        eligibleMergeTypes: Object.freeze(["2x2"]),
        requirements: Object.freeze({
            resources: Object.freeze({})
        }),
        creationCost: Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            base: Object.freeze({ food: 15, wood: 10 })
        }),
        maintenance: Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
            resources: Object.freeze({})
        }),
        creationReward: Object.freeze({
            status: ZONE_CONVERSION_REWARD_STATUS.RESOLVED,
            resources: Object.freeze({ ember: 2 })
        }),
        production: Object.freeze({
            status: ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED,
            kind: ZONE_CONVERSION_PRODUCTION_KINDS.FIXED_PER_ZONE,
            fixedYields: Object.freeze({ food: 2 })
        }),
        capabilities: Object.freeze([])
    })
});

export default ZONE_CONVERSION_DEFINITIONS;
