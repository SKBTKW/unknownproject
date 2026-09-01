/**
 * 🌊 lake_rules.js (湖・水源ルール Single Source of Truth)
 * 
 * 責務:
 * 1. 盤面上の湖 (SOCKET_LAKE) 実数のカウント
 *    ※オアシス (SOCKET_OASIS) は水源バフには含まれるが、湖の出現確率逓減カウントからは除外する。
 * 2. 発見済み湖数に応じた抽選確率逓減倍率の算出
 *    - 0個: 1.00
 *    - 1個: 0.55
 *    - 2個: 0.25
 *    - 3個以上: 0.10
 */

export function countPlacedLakes(state) {
    if (!state || !state.grid) return 0;
    let count = 0;
    const size = state.grid.length;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = state.grid[r][c];
            if (cell && cell.placed && cell.socketResource && cell.socketResource.id === "SOCKET_LAKE") {
                count++;
            }
        }
    }
    return count;
}

export function getLakeSpawnRateMultiplier(lakeCount) {
    if (lakeCount <= 0) return 1.00;
    if (lakeCount === 1) return 0.55;
    if (lakeCount === 2) return 0.25;
    return 0.10;
}
