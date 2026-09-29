function familyFromTerrainId(terrainId) {
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
        case "E2_DEEP_FOREST_HILL":
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

function defaults() {
    return {
        movement: "NEUTRAL",
        visibility: "NORMAL",
        concealment: "NORMAL",
        frontage: "NORMAL",
        elevation: "LEVEL",
        footing: "NORMAL",
        retreat: "NORMAL",
        combustibility: "NORMAL"
    };
}

/**
 * Terrain/E/GL semantic projection only.
 * No combat bonus, tactic success or score is produced here.
 */
export class BattlefieldCapabilityProjector {
    project(cell = null) {
        if (!cell) return null;
        const family = cell.terrainFamily || familyFromTerrainId(cell.terrainId);
        const result = defaults();

        if (family === "FOREST") {
            result.movement = "LIMITED";
            result.visibility = "LOW";
            result.concealment = "HIGH";
            result.frontage = "LIMITED";
            result.combustibility = "HIGH";
        } else if (family === "DEEP_FOREST") {
            result.movement = "SEVERELY_LIMITED";
            result.visibility = "VERY_LOW";
            result.concealment = "VERY_HIGH";
            result.frontage = "SEVERELY_LIMITED";
            result.combustibility = "HIGH";
        } else if (family === "WETLAND") {
            result.movement = "LIMITED";
            result.footing = "POOR";
            result.frontage = "LIMITED";
            result.retreat = "LIMITED";
        } else if (family === "HILL") {
            result.elevation = "ELEVATED";
            result.frontage = "LIMITED";
        } else if (family === "MOUNTAIN") {
            result.movement = "SEVERELY_LIMITED";
            result.elevation = "HIGH";
            result.frontage = "SEVERELY_LIMITED";
            result.retreat = "LIMITED";
        } else if (family === "OPEN") {
            result.visibility = "HIGH";
            result.concealment = "LOW";
            result.frontage = "OPEN";
        }

        const elevation = Number(cell.elevation);
        if (Number.isFinite(elevation)) {
            if (elevation >= 3) result.elevation = "HIGH";
            else if (elevation >= 2) result.elevation = "ELEVATED";
            else if (elevation <= 0) result.elevation = "LOW";
        }

        return {
            terrainId: cell.terrainId || null,
            terrainFamily: family,
            elevation: Number.isFinite(elevation) ? elevation : null,
            growthLevel: Number.isFinite(Number(cell.growthLevel)) ? Number(cell.growthLevel) : null,
            capabilities: result
        };
    }
}

export { familyFromTerrainId };
export default BattlefieldCapabilityProjector;
