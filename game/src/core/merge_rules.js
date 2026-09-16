/* =============================================================
   game/src/core/merge_rules.js
   真の4セルMERGE判定とLINK属性比較の純粋ドメインhelper
   ============================================================= */

const TRUE_MERGE_TYPES = Object.freeze([
    "2x2",
    "L_SHAPE",
    "T_SHAPE"
]);

const ZONE_CATEGORIES = Object.freeze({
    PLAINS: "PLAINS"
});

function resolveTerrainId(terrainOrId) {
    if (typeof terrainOrId === "string") return terrainOrId;
    if (!terrainOrId) return null;
    return terrainOrId.terrainId || terrainOrId.id || null;
}

/**
 * 土地固有IDとは独立した地帯化互換カテゴリを返す。
 * 明示データを正本とし、旧セーブ・簡略テストデータには既知IDの互換fallbackを適用する。
 */
function getZoneCategory(terrainOrId) {
    if (terrainOrId && typeof terrainOrId === "object" && terrainOrId.zoneCategory) {
        return terrainOrId.zoneCategory;
    }

    const terrainId = resolveTerrainId(terrainOrId);
    if (terrainId === "GL1_PLAINS" || terrainId === "E1_RECLAIMED_LAND") {
        return ZONE_CATEGORIES.PLAINS;
    }
    return terrainId;
}

function areTerrainsZoneCompatible(terrainA, terrainB) {
    const categoryA = getZoneCategory(terrainA);
    const categoryB = getZoneCategory(terrainB);
    return categoryA !== null && categoryA === categoryB;
}

function isCompletedMergeGroup(state, groupId) {
    if (!state || groupId === null || groupId === undefined) return false;
    const group = state.mergedBlocks && state.mergedBlocks[groupId];
    if (!group || !Array.isArray(group.cells) || group.cells.length !== 4) return false;

    return TRUE_MERGE_TYPES.includes(group.mergeType);
}

function isTrueMergedCell(state, cell) {
    if (!cell || cell.mergeGroupId === null || cell.mergeGroupId === undefined) return false;
    return cell.merged === true || isCompletedMergeGroup(state, cell.mergeGroupId);
}

function resolveMergeTerrainAttribute(state, groupId, fallbackCell = null) {
    const group = state && state.mergedBlocks && state.mergedBlocks[groupId];
    if (group && (group.zoneCategory || group.terrainId)) {
        return getZoneCategory(group.zoneCategory || group.terrainId);
    }

    const terrain = fallbackCell && fallbackCell.terrain;
    return getZoneCategory(terrain);
}

function haveDifferentMergeTerrainAttributes(state, groupIdA, groupIdB, cellA = null, cellB = null) {
    const attributeA = resolveMergeTerrainAttribute(state, groupIdA, cellA);
    const attributeB = resolveMergeTerrainAttribute(state, groupIdB, cellB);
    return attributeA !== null && attributeB !== null && attributeA !== attributeB;
}

function getMergeLinkKey(groupIdA, groupIdB) {
    return [String(groupIdA), String(groupIdB)].sort().join("::");
}

export {
    TRUE_MERGE_TYPES,
    ZONE_CATEGORIES,
    areTerrainsZoneCompatible,
    getZoneCategory,
    getMergeLinkKey,
    haveDifferentMergeTerrainAttributes,
    isCompletedMergeGroup,
    isTrueMergedCell,
    resolveMergeTerrainAttribute
};
