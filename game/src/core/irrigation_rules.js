/**
 * 🌾 irrigation_rules.js
 *
 * Renderer/UI に依存しない「灌漑源」判定の Single Source of Truth。
 *
 * 現行では旧セーブ互換の湖・オアシスを灌漑源として扱う。
 * 将来の湿原水利改善は、cell.irrigationSource === true または
 * development/feature 側の providesIrrigation === true を付与するだけで
 * Production / Presentation から同じ契約で利用できる。
 */

const LEGACY_IRRIGATION_SOURCE_IDS = Object.freeze([
    "SOCKET_LAKE",
    "SOCKET_OASIS"
]);

export function isLegacyIrrigationResource(resource) {
    return !!resource && LEGACY_IRRIGATION_SOURCE_IDS.includes(resource.id);
}

export function isIrrigationSourceCell(cell) {
    if (!cell || !cell.placed) return false;

    // 旧セーブ互換: 湖・オアシスは引き続き灌漑源として機能する。
    if (isLegacyIrrigationResource(cell.socketResource)) return true;

    // 将来の湿原改善などが参加するための capability 契約。
    if (cell.irrigationSource === true) return true;
    if (cell.development?.providesIrrigation === true) return true;
    if (cell.feature?.providesIrrigation === true) return true;

    return false;
}

export function hasAdjacentIrrigationSource(state, r, c) {
    if (!state || !Array.isArray(state.grid)) return false;

    for (
        let sourceR = Math.max(0, r - 1);
        sourceR <= Math.min(state.grid.length - 1, r + 1);
        sourceR++
    ) {
        const row = state.grid[sourceR];
        if (!Array.isArray(row)) continue;

        for (
            let sourceC = Math.max(0, c - 1);
            sourceC <= Math.min(row.length - 1, c + 1);
            sourceC++
        ) {
            if (sourceR === r && sourceC === c) continue;
            if (isIrrigationSourceCell(row[sourceC])) return true;
        }
    }

    return false;
}

export function isIrrigationInfluence(state, r, c) {
    if (!state) return false;
    const grid = Array.isArray(state.grid)
        ? state.grid
        : (Array.isArray(state) ? state : null);
    if (!grid) return false;

    const row = grid[r];
    if (!Array.isArray(row)) return false;

    if (isIrrigationSourceCell(row[c])) return true;
    return hasAdjacentIrrigationSource({ grid }, r, c);
}

export {
    LEGACY_IRRIGATION_SOURCE_IDS
};
