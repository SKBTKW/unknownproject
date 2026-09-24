/* =============================================================
   game/src/data/zone_conversion_definitions.js

   Canonical runtime Zone Conversion definitions.
   Board owns Zone semantics; cards only reference definition IDs.
   ============================================================= */

import { ZONE_CONVERSION_COST_STATUS } from '../core/zone_conversion_domain.js';

const ZONE_CONVERSION_DEFINITIONS = Object.freeze({
    RESETTLEMENT_PLAINS_2X2: Object.freeze({
        id: "RESETTLEMENT_PLAINS_2X2",
        eligibleZoneAttributes: Object.freeze(["PLAINS"]),
        eligibleMergeTypes: Object.freeze(["2x2"]),
        requirements: Object.freeze({
            resources: null
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
            resources: Object.freeze({ ember: 2 }),
            caps: Object.freeze({ ember: 30 })
        }),
        productionBonus: Object.freeze({
            food: 2
        }),
        capabilities: Object.freeze([])
    })
});

export {
    ZONE_CONVERSION_DEFINITIONS
};

export default ZONE_CONVERSION_DEFINITIONS;
