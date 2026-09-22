/* =============================================================
   game/src/core/land_production_contract.js
   Land production ownership boundary.

   This module deliberately does NOT choose the production values for
   Multi-Attribute blocks. It only distinguishes:
   - legacy cell-terrain production
   - explicit cell production
   - explicit block production
   - unresolved production
   ============================================================= */

import {
    hasMultiplePlacementTerrainAttributes,
    resolvePlacementAttributeCells,
    resolvePlacementShape,
    validatePlacementAttributeMap
} from './placement_geometry.js';

const LAND_PRODUCTION_STATUS = Object.freeze({
    LEGACY: "LEGACY",
    UNRESOLVED: "UNRESOLVED",
    RESOLVED: "RESOLVED"
});

const LAND_PRODUCTION_SCOPE = Object.freeze({
    CELL: "CELL",
    BLOCK: "BLOCK",
    HYBRID: "HYBRID"
});

const ZERO_LAND_YIELDS = Object.freeze({
    food: 0,
    wood: 0,
    defense: 0,
    mystic: 0
});

function normalizeYieldNumber(value) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeLandYields(yields = null) {
    const source = yields || {};
    return {
        food: normalizeYieldNumber(source.food),
        wood: normalizeYieldNumber(source.wood ?? source.material),
        defense: normalizeYieldNumber(source.defense),
        mystic: normalizeYieldNumber(source.mystic)
    };
}

function resolveLegacyTerrainYields(terrain) {
    if (!terrain) return { ...ZERO_LAND_YIELDS };

    return normalizeLandYields({
        food: terrain.food !== undefined
            ? terrain.food
            : (terrain.baseYieldsPerTile?.food ?? terrain.yields?.food ?? 0),
        wood: terrain.material !== undefined
            ? terrain.material
            : (terrain.wood !== undefined
                ? terrain.wood
                : (terrain.baseYieldsPerTile?.material
                    ?? terrain.baseYieldsPerTile?.wood
                    ?? terrain.yields?.material
                    ?? terrain.yields?.wood
                    ?? 0)),
        defense: terrain.defense !== undefined
            ? terrain.defense
            : (terrain.baseYieldsPerTile?.defense ?? terrain.yields?.defense ?? 0),
        mystic: terrain.mystic !== undefined
            ? terrain.mystic
            : (terrain.baseYieldsPerTile?.mystic ?? terrain.yields?.mystic ?? 0)
    });
}

function normalizeProductionContract(card) {
    const explicitAttributeCells = resolvePlacementAttributeCells(card);
    if (explicitAttributeCells) {
        const attributeValidation = validatePlacementAttributeMap(
            resolvePlacementShape(card),
            explicitAttributeCells
        );
        if (!attributeValidation.valid) {
            return Object.freeze({
                status: LAND_PRODUCTION_STATUS.UNRESOLVED,
                scope: null,
                cellYields: null,
                blockYields: null
            });
        }
    }

    if (!hasMultiplePlacementTerrainAttributes(card)) {
        return Object.freeze({
            status: LAND_PRODUCTION_STATUS.LEGACY,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: null,
            blockYields: null
        });
    }

    const raw = card?.productionContract || null;
    if (!raw || raw.status !== LAND_PRODUCTION_STATUS.RESOLVED) {
        return Object.freeze({
            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
            scope: null,
            cellYields: null,
            blockYields: null
        });
    }

    const scope = Object.values(LAND_PRODUCTION_SCOPE).includes(raw.scope)
        ? raw.scope
        : null;
    if (!scope) {
        return Object.freeze({
            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
            scope: null,
            cellYields: null,
            blockYields: null
        });
    }

    const cellYields = Array.isArray(raw.cellYields)
        ? raw.cellYields.map(entry => ({
            r: Number.isInteger(entry?.r) ? entry.r : entry?.dr,
            c: Number.isInteger(entry?.c) ? entry.c : entry?.dc,
            yields: normalizeLandYields(entry?.yields)
        })).filter(entry => Number.isInteger(entry.r) && Number.isInteger(entry.c))
        : null;
    const blockYields = raw.blockYields ? normalizeLandYields(raw.blockYields) : null;

    const hasCellSource = Array.isArray(cellYields) && cellYields.length > 0;
    const hasBlockSource = !!blockYields;
    const attributeCells = resolvePlacementAttributeCells(card) || [];
    const expectedCellKeys = new Set(attributeCells.map(cell => `${cell.r}:${cell.c}`));
    const declaredCellKeys = new Set((cellYields || []).map(entry => `${entry.r}:${entry.c}`));
    const completeCellCoverage = expectedCellKeys.size > 0
        && expectedCellKeys.size === declaredCellKeys.size
        && [...expectedCellKeys].every(key => declaredCellKeys.has(key));
    const sourceValid = (
        (scope === LAND_PRODUCTION_SCOPE.CELL && hasCellSource && completeCellCoverage)
        || (scope === LAND_PRODUCTION_SCOPE.BLOCK && hasBlockSource)
        || (scope === LAND_PRODUCTION_SCOPE.HYBRID && hasCellSource && completeCellCoverage && hasBlockSource)
    );

    if (!sourceValid) {
        return Object.freeze({
            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
            scope: null,
            cellYields: null,
            blockYields: null
        });
    }

    return Object.freeze({
        status: LAND_PRODUCTION_STATUS.RESOLVED,
        scope,
        cellYields: cellYields ? Object.freeze(cellYields) : null,
        blockYields: blockYields ? Object.freeze(blockYields) : null
    });
}

function isMultiAttributeProductionResolved(card) {
    return normalizeProductionContract(card).status === LAND_PRODUCTION_STATUS.RESOLVED;
}

function resolveCellProductionBase(cell) {
    const production = cell?.production || null;

    if (production?.status === LAND_PRODUCTION_STATUS.UNRESOLVED) {
        return {
            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
            scope: null,
            yields: { ...ZERO_LAND_YIELDS }
        };
    }

    if (production?.status === LAND_PRODUCTION_STATUS.RESOLVED) {
        if (production.scope === LAND_PRODUCTION_SCOPE.BLOCK) {
            return {
                status: LAND_PRODUCTION_STATUS.RESOLVED,
                scope: LAND_PRODUCTION_SCOPE.BLOCK,
                yields: { ...ZERO_LAND_YIELDS }
            };
        }
        if (production.cellYields) {
            return {
                status: LAND_PRODUCTION_STATUS.RESOLVED,
                scope: production.scope,
                yields: normalizeLandYields(production.cellYields)
            };
        }
    }

    return {
        status: LAND_PRODUCTION_STATUS.LEGACY,
        scope: LAND_PRODUCTION_SCOPE.CELL,
        yields: resolveLegacyTerrainYields(cell?.terrain)
    };
}

function findContractCellYields(contract, localR, localC, attributeCell = null) {
    if (!contract || !Array.isArray(contract.cellYields)) return null;
    const sourceR = Number.isInteger(attributeCell?.sourceR) ? attributeCell.sourceR : localR;
    const sourceC = Number.isInteger(attributeCell?.sourceC) ? attributeCell.sourceC : localC;
    const match = contract.cellYields.find(entry => entry.r === sourceR && entry.c === sourceC);
    return match ? { ...match.yields } : null;
}

function resolveCardProductionPreview(card) {
    const definition = card?.terrain || card || null;
    if (!definition) {
        return {
            status: null,
            scope: null,
            totalYields: null
        };
    }

    if (!hasMultiplePlacementTerrainAttributes(card)) {
        const shape = card?.currentShape || definition.shape || [[1]];
        const tileCount = shape.reduce(
            (sum, row) => sum + row.reduce((rowSum, value) => rowSum + (value === 1 ? 1 : 0), 0),
            0
        );
        const perTile = resolveLegacyTerrainYields(definition);
        return {
            status: LAND_PRODUCTION_STATUS.LEGACY,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            totalYields: {
                food: perTile.food * tileCount,
                wood: perTile.wood * tileCount,
                defense: perTile.defense * tileCount,
                mystic: perTile.mystic * tileCount
            }
        };
    }

    const contract = normalizeProductionContract(definition);
    if (contract.status !== LAND_PRODUCTION_STATUS.RESOLVED) {
        return {
            status: LAND_PRODUCTION_STATUS.UNRESOLVED,
            scope: null,
            totalYields: null
        };
    }

    const total = { ...ZERO_LAND_YIELDS };
    for (const entry of contract.cellYields || []) {
        total.food += entry.yields.food;
        total.wood += entry.yields.wood;
        total.defense += entry.yields.defense;
        total.mystic += entry.yields.mystic;
    }
    if (contract.blockYields) {
        total.food += contract.blockYields.food;
        total.wood += contract.blockYields.wood;
        total.defense += contract.blockYields.defense;
        total.mystic += contract.blockYields.mystic;
    }

    return {
        status: LAND_PRODUCTION_STATUS.RESOLVED,
        scope: contract.scope,
        totalYields: total
    };
}

function resolvePlacedBlockProduction(state, placementGroupId) {
    const record = state?.placedBlockProduction?.[placementGroupId] || null;
    if (!record || record.status !== LAND_PRODUCTION_STATUS.RESOLVED || !record.yields) {
        return {
            defined: false,
            status: record?.status || null,
            scope: record?.scope || null,
            yields: { ...ZERO_LAND_YIELDS }
        };
    }
    return {
        defined: true,
        status: LAND_PRODUCTION_STATUS.RESOLVED,
        scope: record.scope || LAND_PRODUCTION_SCOPE.BLOCK,
        yields: normalizeLandYields(record.yields)
    };
}

function sumPlacedBlockProduction(state) {
    const total = { ...ZERO_LAND_YIELDS };
    const records = state?.placedBlockProduction;
    if (!records || typeof records !== "object") return total;

    for (const placementGroupId of Object.keys(records)) {
        const resolved = resolvePlacedBlockProduction(state, placementGroupId);
        if (!resolved.defined) continue;
        total.food += resolved.yields.food;
        total.wood += resolved.yields.wood;
        total.defense += resolved.yields.defense;
        total.mystic += resolved.yields.mystic;
    }
    return total;
}

export {
    LAND_PRODUCTION_SCOPE,
    LAND_PRODUCTION_STATUS,
    ZERO_LAND_YIELDS,
    findContractCellYields,
    isMultiAttributeProductionResolved,
    normalizeLandYields,
    normalizeProductionContract,
    resolveCardProductionPreview,
    resolveCellProductionBase,
    resolveLegacyTerrainYields,
    resolvePlacedBlockProduction,
    sumPlacedBlockProduction
};
