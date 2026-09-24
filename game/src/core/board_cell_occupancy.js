/* =============================================================
   game/src/core/board_cell_occupancy.js
   Canonical Board occupancy predicates.
   Base terrain placement and Special-only occupancy are distinct semantics.
   ============================================================= */

export const BOARD_CELL_OCCUPANCY = Object.freeze({
    EMPTY: 'EMPTY',
    BASE_TERRAIN: 'BASE_TERRAIN',
    SPECIAL_ONLY: 'SPECIAL_ONLY',
    BASE_WITH_SPECIAL: 'BASE_WITH_SPECIAL',
    HQ: 'HQ'
});

export function hasBaseTerrainOccupancy(cell) {
    return !!cell?.placed;
}

export function hasSpecialBlockOccupancy(cell) {
    return !!cell?.specialBlock;
}

export function isSpecialOnlyCell(cell) {
    return !!cell?.specialBlock && !cell?.placed && !cell?.terrain && !cell?.isHQ;
}

export function isBoardCellOccupied(cell) {
    return hasBaseTerrainOccupancy(cell) || hasSpecialBlockOccupancy(cell);
}

export function resolveBoardCellOccupancy(cell) {
    if (!cell) return BOARD_CELL_OCCUPANCY.EMPTY;
    if (cell.isHQ) return BOARD_CELL_OCCUPANCY.HQ;
    if (cell.placed && cell.specialBlock) return BOARD_CELL_OCCUPANCY.BASE_WITH_SPECIAL;
    if (cell.placed) return BOARD_CELL_OCCUPANCY.BASE_TERRAIN;
    if (isSpecialOnlyCell(cell)) return BOARD_CELL_OCCUPANCY.SPECIAL_ONLY;
    return BOARD_CELL_OCCUPANCY.EMPTY;
}
