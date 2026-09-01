/**
 * 🗺️ land_sfx_resolver.js (地形選択SEリゾルバー)
 * 
 * 責務:
 * 1. terrainId またはカードオブジェクトから対応する LAND_SELECT_* Event ID を純粋解決。
 * 2. 文字列の推測を排除し、正規 TERRAIN_MATRIX および既存エイリアスを統一マッピング。
 */

export function resolveLandSelectSfx(terrainIdOrCard) {
    if (!terrainIdOrCard) return "LAND_SELECT_PLAINS";

    let tid = "";
    if (typeof terrainIdOrCard === "string") {
        tid = terrainIdOrCard.toUpperCase();
    } else if (typeof terrainIdOrCard === "object") {
        const tObj = terrainIdOrCard.terrain || terrainIdOrCard;
        tid = (tObj.terrainId || tObj.id || "").toUpperCase();
    }

    // 1. 湿原 (E0 GL1)
    if (tid.includes("WETLAND") || tid === "E0_WETLAND") {
        return "LAND_SELECT_WETLAND";
    }

    // 2. 山岳 (E3)
    if (tid.includes("MOUNTAIN") || tid === "E3_MOUNTAIN") {
        return "LAND_SELECT_MOUNTAIN";
    }

    // 3. 丘陵帯 (E2) 複合・単独判定
    if (tid === "E2_DEEP_HILL" || tid.includes("DEEP_HILL")) {
        return "LAND_SELECT_DEEP_HILL";
    }
    if (tid === "E2_FOREST_HILL" || tid.includes("FOREST_HILL")) {
        return "LAND_SELECT_FOREST_HILL";
    }
    if (tid === "E2_DESERT_HILL" || tid.includes("WASTELAND") || tid.includes("DESERT_HILL")) {
        return "LAND_SELECT_WASTELAND";
    }
    if (tid === "E2_HILL" || tid.includes("HILL")) {
        return "LAND_SELECT_HILL";
    }

    // 4. 平地帯 (E1)
    if (tid === "GL3_DEEP_FOREST" || tid.includes("DEEP_FOREST")) {
        return "LAND_SELECT_DEEP_FOREST";
    }
    if (tid === "GL2_FOREST" || tid.includes("FOREST")) {
        return "LAND_SELECT_FOREST";
    }
    if (tid === "GL0_DESERT" || tid.includes("DESERT")) {
        return "LAND_SELECT_DESERT";
    }
    if (tid === "GL1_PLAINS" || tid.includes("PLAINS")) {
        return "LAND_SELECT_PLAINS";
    }

    // デフォルトフォールバック
    return "LAND_SELECT_PLAINS";
}
