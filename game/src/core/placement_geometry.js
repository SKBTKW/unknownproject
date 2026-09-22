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
    return {
        ...cell,
        r,
        c,
        sourceR: Number.isInteger(cell.sourceR) ? cell.sourceR : r,
        sourceC: Number.isInteger(cell.sourceC) ? cell.sourceC : c
    };
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

function resolveRepresentativePlacementTerrainId(card) {
    const definition = card?.terrain || card || null;
    if (!definition) return null;

    const cells = resolvePlacementAttributeCells(card);
    const explicit = definition.representativeTerrainId || null;
    if (explicit && (!cells || cells.some(cell => getPlacementAttributeTerrainId(cell) === explicit))) {
        return explicit;
    }

    if (cells) {
        const shape = resolvePlacementShape(card);
        const anchor = resolvePlacementAnchor(card, shape);
        const anchorCell = cells.find(cell => cell.r === anchor.r && cell.c === anchor.c);
        const anchorTerrainId = getPlacementAttributeTerrainId(anchorCell);
        if (anchorTerrainId) return anchorTerrainId;

        const firstTerrainId = cells.map(getPlacementAttributeTerrainId).find(Boolean);
        if (firstTerrainId) return firstTerrainId;
    }

    return definition.terrainId || definition.id || null;
}

function validatePlacementAttributeMap(shape, attributeCells) {
    if (!Array.isArray(attributeCells)) {
        return Object.freeze({
            valid: true,
            reasons: Object.freeze([]),
            activeCellCount: 0,
            attributeCellCount: 0
        });
    }

    const resolvedShape = isShapeMatrix(shape) ? shape : DEFAULT_PLACEMENT_SHAPE;
    const activeKeys = new Set();
    for (let r = 0; r < resolvedShape.length; r++) {
        for (let c = 0; c < resolvedShape[r].length; c++) {
            if (resolvedShape[r][c] === 1) activeKeys.add(`${r}:${c}`);
        }
    }

    const reasons = [];
    const normalized = attributeCells.map(normalizeAttributeCell);
    if (normalized.some(cell => !cell)) reasons.push("ATTRIBUTE_CELL_COORDINATE_INVALID");

    const validCells = normalized.filter(Boolean);
    const attributeKeys = new Set();
    let duplicate = false;
    let terrainMissing = false;

    for (const cell of validCells) {
        const key = `${cell.r}:${cell.c}`;
        if (attributeKeys.has(key)) duplicate = true;
        attributeKeys.add(key);
        if (!getPlacementAttributeTerrainId(cell)) terrainMissing = true;
    }

    if (duplicate) reasons.push("ATTRIBUTE_CELL_DUPLICATE");
    if (terrainMissing) reasons.push("ATTRIBUTE_TERRAIN_ID_REQUIRED");

    const missing = [...activeKeys].some(key => !attributeKeys.has(key));
    const extra = [...attributeKeys].some(key => !activeKeys.has(key));
    if (missing) reasons.push("ATTRIBUTE_CELL_COVERAGE_MISSING");
    if (extra) reasons.push("ATTRIBUTE_CELL_OUTSIDE_SHAPE");

    return Object.freeze({
        valid: reasons.length === 0,
        reasons: Object.freeze(reasons),
        activeCellCount: activeKeys.size,
        attributeCellCount: attributeKeys.size
    });
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

function normalizePlacementRotationTurns(rotation = 0) {
    const value = Number(rotation);
    if (!Number.isFinite(value)) return null;

    // Accept both explicit quarter-turn counts (-3..3) and degree values
    // (...,-180,-90,0,90,180,...). Other angles are outside the grid contract.
    if (Number.isInteger(value) && Math.abs(value) <= 3) {
        return ((value % 4) + 4) % 4;
    }
    if (Number.isInteger(value) && value % 90 === 0) {
        const turns = value / 90;
        return ((turns % 4) + 4) % 4;
    }
    return null;
}

/**
 * Resolve an absolute authored-card rotation without mutating the card.
 *
 * rotation=0 preserves the card instance's current* fields (Browser UI path).
 * Non-zero rotation is resolved from the authored/master geometry so external
 * callers such as Unity do not depend on mutable Browser card state.
 */
function resolvePlacementGeometryAtRotation(card, clickedR, clickedC, rotation = 0) {
    const turns = normalizePlacementRotationTurns(rotation);
    if (turns === null) {
        throw new RangeError("INVALID_PLACEMENT_ROTATION");
    }

    const rawRotation = Number(rotation);
    if (rawRotation === 0) return resolvePlacementGeometry(card, clickedR, clickedC);

    const authored = card?.terrain || card;
    let shape = resolvePlacementShape(authored);
    let anchor = resolvePlacementAnchor(authored, shape);
    let attributeCells = resolvePlacementAttributeCells(authored);

    for (let i = 0; i < turns; i++) {
        const rotated = rotatePlacementClockwise(shape, anchor, attributeCells);
        shape = rotated.shape;
        anchor = rotated.anchor;
        attributeCells = rotated.attributeCells;
    }

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
    getPlacementAttributeTerrainId,
    getPlacementCells,
    hasMultiplePlacementTerrainAttributes,
    normalizePlacementAnchor,
    normalizePlacementRotationTurns,
    resolvePlacementAnchor,
    resolvePlacementAttributeCells,
    resolvePlacementGeometry,
    resolvePlacementGeometryAtRotation,
    resolvePlacementShape,
    resolveRepresentativePlacementTerrainId,
    rotateAttributeCellsClockwise,
    validatePlacementAttributeMap,
    rotatePlacementClockwise,
    rotateShapeMatrix
};
