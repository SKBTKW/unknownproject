/**
 * 🌊 lake_rules.js (湖・オアシス共通の水源ルール Single Source of Truth)
 *
 * UIや描画方式に依存せず、水源の識別・個数・発見率逓減・近接禁止・
 * 周囲8マス効果を共通判定する。
 */

const WATER_SOURCE_IDS = Object.freeze([
    "SOCKET_LAKE",
    "SOCKET_OASIS"
]);

const WATER_SOURCE_EXCLUSION_RANGE = 2;
const WETLAND_EXCLUSION_RANGE = 1;

export function isWaterSourceResource(resource) {
    return !!resource && WATER_SOURCE_IDS.includes(resource.id);
}

export function isWaterSourceCell(cell) {
    return !!cell && !!cell.placed && isWaterSourceResource(cell.socketResource);
}

export function isWetlandTerrain(terrain) {
    const terrainId = terrain ? (terrain.terrainId || terrain.id || "") : "";
    return terrainId === "E0_WETLAND" || terrainId.includes("WETLAND");
}

export function isWetlandCell(cell) {
    return !!cell && !!cell.placed && isWetlandTerrain(cell.terrain);
}

export function isWithinWetlandExclusionRange(
    state,
    r,
    c,
    exclusionRange = WETLAND_EXCLUSION_RANGE
) {
    if (!state || !Array.isArray(state.grid)) return false;

    for (let wetlandR = 0; wetlandR < state.grid.length; wetlandR++) {
        const row = state.grid[wetlandR];
        if (!Array.isArray(row)) continue;
        for (let wetlandC = 0; wetlandC < row.length; wetlandC++) {
            if (wetlandR === r && wetlandC === c) continue;
            if (!isWetlandCell(row[wetlandC])) continue;
            // 湖・オアシスを持つセルは水源距離制限だけを適用し、湿原の直辺隣接禁止から除外する。
            if (isWaterSourceCell(row[wetlandC])) continue;
            if (Math.abs(wetlandR - r) + Math.abs(wetlandC - c) <= exclusionRange) {
                return true;
            }
        }
    }
    return false;
}

export function countPlacedWaterSources(state) {
    if (!state || !Array.isArray(state.grid)) return 0;
    let count = 0;
    for (const row of state.grid) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            if (isWaterSourceCell(cell)) count++;
        }
    }
    return count;
}

export function getWaterSourceSpawnRateMultiplier(waterSourceCount) {
    if (waterSourceCount <= 0) return 1.00;
    if (waterSourceCount === 1) return 0.70;
    if (waterSourceCount === 2) return 0.40;
    return 0.20;
}

export function isWithinWaterSourceExclusionRange(
    state,
    r,
    c,
    exclusionRange = WATER_SOURCE_EXCLUSION_RANGE
) {
    if (!state || !Array.isArray(state.grid)) return false;

    for (let sourceR = 0; sourceR < state.grid.length; sourceR++) {
        const row = state.grid[sourceR];
        if (!Array.isArray(row)) continue;
        for (let sourceC = 0; sourceC < row.length; sourceC++) {
            if (sourceR === r && sourceC === c) continue;
            if (!isWaterSourceCell(row[sourceC])) continue;
            if (Math.abs(sourceR - r) + Math.abs(sourceC - c) <= exclusionRange) {
                return true;
            }
        }
    }
    return false;
}

export function canSpawnWaterSourceAt(state, r, c) {
    return !isWithinWaterSourceExclusionRange(state, r, c);
}

export function getWaterSourceSpawnChance(state, r, c, baseRate) {
    if (!Number.isFinite(baseRate) || baseRate <= 0) return 0;
    if (!canSpawnWaterSourceAt(state, r, c)) return 0;
    const normalizedBaseRate = Math.min(1, baseRate);
    return normalizedBaseRate * getWaterSourceSpawnRateMultiplier(countPlacedWaterSources(state));
}

export function hasAdjacentWaterSource(state, r, c) {
    if (!state || !Array.isArray(state.grid)) return false;
    for (let sourceR = Math.max(0, r - 1); sourceR <= Math.min(state.grid.length - 1, r + 1); sourceR++) {
        const row = state.grid[sourceR];
        if (!Array.isArray(row)) continue;
        for (let sourceC = Math.max(0, c - 1); sourceC <= Math.min(row.length - 1, c + 1); sourceC++) {
            if (sourceR === r && sourceC === c) continue;
            if (isWaterSourceCell(row[sourceC])) return true;
        }
    }
    return false;
}

// 既存importとの互換。意味は新仕様どおり「湖+オアシス」の水源合計へ更新する。
export const countPlacedLakes = countPlacedWaterSources;
export const getLakeSpawnRateMultiplier = getWaterSourceSpawnRateMultiplier;

export {
    WETLAND_EXCLUSION_RANGE,
    WATER_SOURCE_EXCLUSION_RANGE,
    WATER_SOURCE_IDS
};
