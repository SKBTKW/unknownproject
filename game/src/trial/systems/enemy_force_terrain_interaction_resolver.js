const BODY_SIZES = new Set(["SMALL", "MEDIUM", "LARGE"]);

export const ACTIVE_EQUIPMENT_TYPES = Object.freeze([
    "LIGHT",
    "STANDARD",
    "HEAVY"
]);

// Reserved data only. These identities stay representable in enemy data, but
// they do not alter Trial runtime behaviour until their rules are explicitly
// promoted from backlog into the active equipment contract.
export const RESERVED_EQUIPMENT_TYPES = Object.freeze([
    "PROJECTILE",
    "LARGE_SHIELD",
    "POLEARM",
    "MOUNTED",
    "BAGGAGE"
]);

const ACTIVE_EQUIPMENT_SET = new Set(ACTIVE_EQUIPMENT_TYPES);
const RESERVED_EQUIPMENT_SET = new Set(RESERVED_EQUIPMENT_TYPES);

function normalizeBodySize(value) {
    const normalized = String(value || "MEDIUM").toUpperCase();
    return BODY_SIZES.has(normalized) ? normalized : "MEDIUM";
}

function normalizeEquipment(value) {
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    const recognized = [...new Set(values
        .map(item => String(item || "").toUpperCase())
        .map(item => item === "MEDIUM" ? "STANDARD" : item)
        .filter(item => ACTIVE_EQUIPMENT_SET.has(item) || RESERVED_EQUIPMENT_SET.has(item)))];

    const active = recognized.filter(item => ACTIVE_EQUIPMENT_SET.has(item));
    const reserved = recognized.filter(item => RESERVED_EQUIPMENT_SET.has(item));

    // LIGHT / STANDARD / HEAVY are mutually exclusive operating classes.
    // If malformed data supplies more than one, prefer the heaviest explicit
    // class so runtime remains deterministic rather than stacking classes.
    const equipmentClass = active.includes("HEAVY")
        ? "HEAVY"
        : active.includes("LIGHT")
            ? "LIGHT"
            : "STANDARD";

    return { equipmentClass, reservedEquipment: reserved };
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

function resolveEquipmentInteraction(equipmentClass, family) {
    const traits = [];
    const movementConstraints = [];
    let logistics = "STANDARD";

    if (equipmentClass === "LIGHT") {
        traits.push("RAPID_MANEUVER");
        if (["FOREST", "DEEP_FOREST", "WETLAND", "MOUNTAIN"].includes(family)) {
            traits.push("ROUGH_TERRAIN_FRIENDLY");
        }
        logistics = "LIGHT";
    }

    if (equipmentClass === "HEAVY") {
        traits.push("FRONTAL_BREAKTHROUGH");
        logistics = "HEAVY";
        if (["FOREST", "DEEP_FOREST", "WETLAND", "MOUNTAIN"].includes(family)) {
            movementConstraints.push("HEAVY_EQUIPMENT_ROUGH_TERRAIN");
        }
    }

    return {
        traits,
        movementConstraints,
        logistics
    };
}

/**
 * Resolves semantic battlefield consequences of body size and active equipment.
 *
 * Active equipment is deliberately limited to LIGHT / STANDARD / HEAVY.
 * Reserved equipment identities remain visible as data but have no runtime
 * effect. This resolver intentionally does not output attack/defense
 * multipliers; Trial combat translates these semantics at the proper stage.
 */
export class EnemyForceTerrainInteractionResolver {
    resolve({ bodySize = "MEDIUM", equipment = [], terrainId = null } = {}) {
        const normalizedBodySize = normalizeBodySize(bodySize);
        const { equipmentClass, reservedEquipment } = normalizeEquipment(equipment);
        const family = terrainFamily(terrainId);
        const body = resolveBodyInteraction(normalizedBodySize, family);
        const gear = resolveEquipmentInteraction(equipmentClass, family);

        return {
            terrainId,
            terrainFamily: family,
            bodySize: normalizedBodySize,
            equipmentClass,
            reservedEquipment,
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
