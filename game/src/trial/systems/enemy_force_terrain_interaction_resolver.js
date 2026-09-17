const BODY_SIZES = new Set(["SMALL", "MEDIUM", "LARGE"]);
const EQUIPMENT_TYPES = new Set([
    "LIGHT",
    "MEDIUM",
    "HEAVY",
    "PROJECTILE",
    "LARGE_SHIELD",
    "POLEARM",
    "MOUNTED",
    "BAGGAGE"
]);

function normalizeBodySize(value) {
    const normalized = String(value || "MEDIUM").toUpperCase();
    return BODY_SIZES.has(normalized) ? normalized : "MEDIUM";
}

function normalizeEquipment(value) {
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(values
        .map(item => String(item || "").toUpperCase())
        .filter(item => EQUIPMENT_TYPES.has(item)))];
}

function terrainFamily(terrainId) {
    switch (String(terrainId || "").toUpperCase()) {
        case "GL1_PLAINS":
        case "E1_RECLAIMED_LAND":
        case "GL0_DESERT":
            return "OPEN";
        case "GL2_FOREST":
        case "E2_FOREST_HILL":
            return "FOREST";
        case "GL3_DEEP_FOREST":
        case "E2_DEEP_HILL":
            return "DEEP_FOREST";
        case "E0_WETLAND":
            return "WETLAND";
        case "E2_HILL":
        case "E2_DESERT_HILL":
            return "HILL";
        case "E3_MOUNTAIN":
            return "MOUNTAIN";
        default:
            return "UNKNOWN";
    }
}

function resolveBodyInteraction(bodySize, family) {
    const result = {
        deployment: "FULL",
        mobility: "NEUTRAL",
        ambushExposure: "NORMAL",
        traits: []
    };

    if (bodySize === "SMALL") {
        if (["FOREST", "DEEP_FOREST", "WETLAND", "MOUNTAIN"].includes(family)) {
            result.mobility = "ADVANTAGE";
            result.traits.push("INFILTRATION_FRIENDLY");
        }
        if (["FOREST", "DEEP_FOREST"].includes(family)) {
            result.ambushExposure = "LOW";
            result.traits.push("AMBUSH_FRIENDLY");
        }
        if (family === "OPEN") {
            result.traits.push("LOW_OPEN_GROUND_MASS");
        }
        return result;
    }

    if (bodySize === "LARGE") {
        if (family === "OPEN") {
            result.mobility = "ADVANTAGE";
            result.traits.push("OPEN_GROUND_MASS");
        }
        if (["FOREST", "WETLAND", "HILL"].includes(family)) {
            result.deployment = "CONSTRAINED";
            result.mobility = "DISADVANTAGE";
        }
        if (["DEEP_FOREST", "MOUNTAIN"].includes(family)) {
            result.deployment = "SEVERELY_CONSTRAINED";
            result.mobility = "DISADVANTAGE";
        }
        if (["FOREST", "DEEP_FOREST"].includes(family)) {
            result.ambushExposure = "HIGH";
            result.traits.push("AMBUSH_VULNERABLE");
        }
    }

    return result;
}

function resolveEquipmentInteraction(equipment, family) {
    const traits = [];
    const movementConstraints = [];
    let logistics = "STANDARD";

    if (equipment.includes("LIGHT")) {
        traits.push("RAPID_MANEUVER");
        if (["FOREST", "DEEP_FOREST", "WETLAND", "MOUNTAIN"].includes(family)) {
            traits.push("ROUGH_TERRAIN_FRIENDLY");
        }
        logistics = "LIGHT";
    }

    if (equipment.includes("HEAVY")) {
        traits.push("FRONTAL_BREAKTHROUGH");
        logistics = "HEAVY";
        if (["FOREST", "DEEP_FOREST", "WETLAND", "MOUNTAIN"].includes(family)) {
            movementConstraints.push("HEAVY_EQUIPMENT_ROUGH_TERRAIN");
        }
    }

    if (equipment.includes("PROJECTILE")) {
        traits.push("PRE_CONTACT_PRESSURE");
        if (["DEEP_FOREST", "MOUNTAIN"].includes(family)) {
            movementConstraints.push("LIMITED_PROJECTILE_ARC");
        }
    }

    if (equipment.includes("LARGE_SHIELD")) {
        traits.push("MISSILE_SCREEN", "FRONTAL_BULWARK");
        movementConstraints.push("REDUCED_MANEUVERABILITY");
    }

    if (equipment.includes("POLEARM")) {
        traits.push("ANTI_LARGE", "ANTI_MOUNTED");
        if (["DEEP_FOREST", "MOUNTAIN"].includes(family)) {
            movementConstraints.push("LIMITED_POLEARM_HANDLING");
        }
    }

    if (equipment.includes("MOUNTED")) {
        if (family === "OPEN") {
            traits.push("OPEN_GROUND_MOBILITY", "FLANKING_CAPABLE");
        } else {
            movementConstraints.push("MOUNTED_TERRAIN_RESTRICTION");
        }
    }

    if (equipment.includes("BAGGAGE")) {
        traits.push("EXTENDED_LOGISTICS");
        movementConstraints.push("BAGGAGE_SLOWS_COLUMN");
        logistics = "EXTENDED";
    }

    return {
        traits,
        movementConstraints,
        logistics
    };
}

/**
 * Resolves semantic battlefield consequences of body size and equipment.
 *
 * This resolver intentionally does not output attack/defense multipliers.
 * Terrain interaction is expressed as deployment, mobility, exposure and
 * combat/logistics traits so Trial combat can translate those semantics at the
 * appropriate stage without turning force identity into a flat strength buff.
 */
export class EnemyForceTerrainInteractionResolver {
    resolve({ bodySize = "MEDIUM", equipment = [], terrainId = null } = {}) {
        const normalizedBodySize = normalizeBodySize(bodySize);
        const normalizedEquipment = normalizeEquipment(equipment);
        const family = terrainFamily(terrainId);
        const body = resolveBodyInteraction(normalizedBodySize, family);
        const gear = resolveEquipmentInteraction(normalizedEquipment, family);

        return {
            terrainId,
            terrainFamily: family,
            bodySize: normalizedBodySize,
            equipment: normalizedEquipment,
            deployment: body.deployment,
            mobility: body.mobility,
            ambushExposure: body.ambushExposure,
            logistics: gear.logistics,
            combatTraits: [...body.traits, ...gear.traits],
            movementConstraints: [...gear.movementConstraints]
        };
    }
}

export default EnemyForceTerrainInteractionResolver;
