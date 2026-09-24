import {
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_PRODUCTION_KINDS,
    ZONE_CONVERSION_PRODUCTION_STATUS
} from "../core/zone_conversion_domain.js";

export const ZONE_CONVERSION_DEFINITION_IDS = Object.freeze({
    AGRICULTURAL_REFORM: "AGRICULTURAL_REFORM"
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
    })
});

export default ZONE_CONVERSION_DEFINITIONS;
