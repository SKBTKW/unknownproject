/* =============================================================
   game/src/core/merge_rules.js
   真の4セルMERGE判定とLINK属性比較の純粋ドメインhelper
   ============================================================= */

const TRUE_MERGE_TYPES = Object.freeze([
    "2x2",
    "L_SHAPE",
    "T_SHAPE"
]);

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
    if (group && group.terrainId) return group.terrainId;

    const terrain = fallbackCell && fallbackCell.terrain;
    return terrain ? (terrain.terrainId || terrain.id || null) : null;
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
    getMergeLinkKey,
    haveDifferentMergeTerrainAttributes,
    isCompletedMergeGroup,
    isTrueMergedCell,
    resolveMergeTerrainAttribute
};
