/* =============================================================
   game/src/core/placement_geometry.js
   土地Shape・Anchor・Cell attribute map・クリック座標変換の純粋ドメインhelper
   ============================================================= */

const DEFAULT_PLACEMENT_SHAPE = Object.freeze([Object.freeze([1])]);
const DEFAULT_PLACEMENT_ANCHOR = Object.freeze({ r: 0, c: 0 });

function isShapeMatrix(shape) {
    return Array.isArray(shape)
        && shape.length > 0
        && shape.every(row => Array.isArray(row) && row.length > 0);
}

function resolvePlacementShape(card) {
    const shape = card && (
        card.currentShape
        || card.shape
        || (card.terrain && card.terrain.shape)
    );
    return isShapeMatrix(shape) ? shape : DEFAULT_PLACEMENT_SHAPE;
}

function normalizePlacementAnchor(anchor, shape = DEFAULT_PLACEMENT_SHAPE) {
    if (!anchor || !Number.isInteger(anchor.r) || !Number.isInteger(anchor.c)) {
        return { ...DEFAULT_PLACEMENT_ANCHOR };
    }

    const rows = isShapeMatrix(shape) ? shape.length : 1;
    const cols = isShapeMatrix(shape) ? Math.max(...shape.map(row => row.length)) : 1;
    if (anchor.r < 0 || anchor.r >= rows || anchor.c < 0 || anchor.c >= cols) {
        return { ...DEFAULT_PLACEMENT_ANCHOR };
    }

    return { r: anchor.r, c: anchor.c };
}

function resolvePlacementAnchor(card, shape = resolvePlacementShape(card)) {
    const anchor = card && (
        card.currentAnchor
        || card.anchor
        || (card.terrain && card.terrain.anchor)
    );
    return normalizePlacementAnchor(anchor, shape);
}

function normalizeAttributeCell(cell) {
    if (!cell || typeof cell !== "object") return null;
    const r = Number.isInteger(cell.r) ? cell.r : cell.dr;
    const c = Number.isInteger(cell.c) ? cell.c : cell.dc;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { ...cell, r, c };
}

/**
 * Returns only an explicitly declared per-cell attribute map.
 * Uniform legacy cards intentionally return null and keep using the card-level
 * terrain object as their fallback semantic.
 */
function resolvePlacementAttributeCells(card) {
    const source = card && (
        card.currentCells
        || card.cells
        || (card.terrain && card.terrain.cells)
    );
    if (!Array.isArray(source)) return null;
    const normalized = source.map(normalizeAttributeCell).filter(Boolean);
    return normalized.length > 0 ? normalized : null;
}

function getPlacementAttributeTerrainId(cell) {
    return cell?.terrain?.terrainId
        || cell?.terrain?.id
        || cell?.terrainId
        || cell?.id
        || null;
}

function hasMultiplePlacementTerrainAttributes(card) {
    const cells = resolvePlacementAttributeCells(card);
    if (!cells) return false;
    const terrainIds = new Set(
        cells.map(getPlacementAttributeTerrainId).filter(Boolean)
    );
    return terrainIds.size >= 2;
}

function getPlacementCells(startR, startC, shape) {
    const cells = [];
    for (let dr = 0; dr < shape.length; dr++) {
        for (let dc = 0; dc < shape[dr].length; dc++) {
            if (shape[dr][dc] === 1) {
                cells.push({ r: startR + dr, c: startC + dc });
            }
        }
    }
    return cells;
}

function resolvePlacementGeometry(card, clickedR, clickedC) {
    const shape = resolvePlacementShape(card);
    const anchor = resolvePlacementAnchor(card, shape);
    const attributeCells = resolvePlacementAttributeCells(card);
    const startR = clickedR - anchor.r;
    const startC = clickedC - anchor.c;

    return {
        clickedR,
        clickedC,
        startR,
        startC,
        shape,
        anchor,
        attributeCells,
        cells: getPlacementCells(startR, startC, shape)
    };
}

function rotateShapeMatrix(matrix) {
    const shape = isShapeMatrix(matrix) ? matrix : DEFAULT_PLACEMENT_SHAPE;
    const rows = shape.length;
    const cols = Math.max(...shape.map(row => row.length));
    const rotated = [];

    for (let c = 0; c < cols; c++) {
        const newRow = [];
        for (let r = rows - 1; r >= 0; r--) {
            newRow.push(shape[r][c] === 1 ? 1 : 0);
        }
        rotated.push(newRow);
    }
    return rotated;
}

function rotateAttributeCellsClockwise(cells, shape) {
    if (!Array.isArray(cells)) return null;
    const resolvedShape = isShapeMatrix(shape) ? shape : DEFAULT_PLACEMENT_SHAPE;
    const rows = resolvedShape.length;
    return cells
        .map(normalizeAttributeCell)
        .filter(Boolean)
        .map(cell => ({
            ...cell,
            r: cell.c,
            c: rows - 1 - cell.r
        }));
}

function rotatePlacementClockwise(shape, anchor = DEFAULT_PLACEMENT_ANCHOR, attributeCells = null) {
    const resolvedShape = isShapeMatrix(shape) ? shape : DEFAULT_PLACEMENT_SHAPE;
    const resolvedAnchor = normalizePlacementAnchor(anchor, resolvedShape);
    const rows = resolvedShape.length;

    return {
        shape: rotateShapeMatrix(resolvedShape),
        anchor: {
            r: resolvedAnchor.c,
            c: rows - 1 - resolvedAnchor.r
        },
        attributeCells: rotateAttributeCellsClockwise(attributeCells, resolvedShape)
    };
}

export {
    DEFAULT_PLACEMENT_ANCHOR,
    getPlacementCells,
    hasMultiplePlacementTerrainAttributes,
    normalizePlacementAnchor,
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementGeometry,
    resolvePlacementShape,
    rotateAttributeCellsClockwise,
    rotatePlacementClockwise,
    rotateShapeMatrix
};
