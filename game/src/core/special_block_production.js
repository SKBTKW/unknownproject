/* =============================================================
   game/src/core/special_block_production.js
   Minimal production policy boundary for Special Blocks.
   It deliberately does not encode facility ids or invent unresolved numbers.
   ============================================================= */

import {
    getSpecialBlockDefinition,
    readCellCapabilities
} from './special_block_domain.js';

export const SPECIAL_BLOCK_PRODUCTION_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED',
    NONE: 'NONE'
});

export const SPECIAL_BLOCK_PRODUCTION_KINDS = Object.freeze({
    FIXED: 'FIXED',
    SOURCE_SIZE: 'SOURCE_SIZE',
    CONDITIONAL: 'CONDITIONAL',
    RELATION_COUNT: 'RELATION_COUNT'
});

export const SPECIAL_BLOCK_RELATION_NEIGHBORHOODS = Object.freeze({
    ORTHOGONAL: 'ORTHOGONAL',
    EIGHT_WAY: 'EIGHT_WAY'
});

export const SPECIAL_BLOCK_SOURCE_SIZE_SOURCES = Object.freeze({
    INITIAL_SNAPSHOT: 'INITIAL_SNAPSHOT'
});

const ZERO_YIELDS = Object.freeze({
    food: 0,
    wood: 0,
    defense: 0,
    mystic: 0
});

function normalizeYields(yields) {
    if (!yields || typeof yields !== 'object') return { ...ZERO_YIELDS };
    return {
        food: Number.isFinite(Number(yields.food)) ? Number(yields.food) : 0,
        wood: Number.isFinite(Number(yields.wood ?? yields.material))
            ? Number(yields.wood ?? yields.material)
            : 0,
        defense: Number.isFinite(Number(yields.defense)) ? Number(yields.defense) : 0,
        mystic: Number.isFinite(Number(yields.mystic)) ? Number(yields.mystic) : 0
    };
}

function addYields(total, yields) {
    total.food += yields.food;
    total.wood += yields.wood;
    total.defense += yields.defense;
    total.mystic += yields.mystic;
    return total;
}

function multiplyYields(yields, factor) {
    const normalized = normalizeYields(yields);
    return {
        food: normalized.food * factor,
        wood: normalized.wood * factor,
        defense: normalized.defense * factor,
        mystic: normalized.mystic * factor
    };
}

function relationOffsets(neighborhood) {
    if (neighborhood === SPECIAL_BLOCK_RELATION_NEIGHBORHOODS.ORTHOGONAL) {
        return [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ];
    }
    if (neighborhood === SPECIAL_BLOCK_RELATION_NEIGHBORHOODS.EIGHT_WAY) {
        return [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],             [0, 1],
            [1, -1],  [1, 0],   [1, 1]
        ];
    }
    return null;
}

export class SpecialBlockProductionResolver {
    constructor({
        strategies = {},
        definitionResolver = getSpecialBlockDefinition,
        capabilityReader = readCellCapabilities
    } = {}) {
        this.strategies = { ...strategies };
        this.definitionResolver = typeof definitionResolver === 'function'
            ? definitionResolver
            : getSpecialBlockDefinition;
        this.capabilityReader = typeof capabilityReader === 'function'
            ? capabilityReader
            : readCellCapabilities;
    }

    _resolveSourceSize(entity, production) {
        if (production?.sourceSizeSource !== SPECIAL_BLOCK_SOURCE_SIZE_SOURCES.INITIAL_SNAPSHOT) {
            return null;
        }
        const size = Number(entity?.sourceGroupReference?.initialSize);
        if (!Number.isFinite(size) || size < 0 || !production?.perSourceYields) return null;
        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: multiplyYields(production.perSourceYields, Math.trunc(size))
        };
    }

    _resolveRelationCount(state, r, c, production) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
        if (typeof production?.relationCapability !== 'string' || !production.relationCapability) return null;
        if (!production?.perRelationYields) return null;

        const offsets = relationOffsets(production.relationNeighborhood);
        if (!offsets) return null;

        let count = 0;
        for (const [dr, dc] of offsets) {
            const neighbor = state?.grid?.[r + dr]?.[c + dc];
            if (!neighbor) continue;
            const capabilities = this.capabilityReader(neighbor);
            if (capabilities?.has?.(production.relationCapability)) count++;
        }

        const maxRelations = Number(production.maxRelations);
        const effectiveCount = Number.isFinite(maxRelations)
            ? Math.min(count, Math.max(0, Math.trunc(maxRelations)))
            : count;

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: multiplyYields(production.perRelationYields, effectiveCount)
        };
    }

    _resolveBuiltIn(state, cell, position, entity, production) {
        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_SIZE) {
            return this._resolveSourceSize(entity, production);
        }
        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT) {
            return this._resolveRelationCount(state, position.r, position.c, production);
        }
        return null;
    }

    resolveCell(state, cell, { r = null, c = null } = {}) {
        const entity = cell?.specialBlock;
        if (!entity) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.NONE,
                yields: { ...ZERO_YIELDS },
                kind: null
            };
        }

        const definition = this.definitionResolver(entity.definitionId || entity.type);
        const production = definition?.production || null;
        if (!production) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.NONE,
                yields: { ...ZERO_YIELDS },
                kind: null
            };
        }

        if (production.status !== SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null
            };
        }

        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.FIXED && production.yields) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: normalizeYields(production.yields),
                kind: production.kind
            };
        }

        const builtIn = this._resolveBuiltIn(
            state,
            cell,
            { r, c },
            entity,
            production
        );
        if (builtIn?.status === SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: normalizeYields(builtIn.yields),
                kind: production.kind || null
            };
        }

        const strategy = this.strategies[production.strategyKey || production.kind];
        if (typeof strategy !== 'function') {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null
            };
        }

        const resolved = strategy({
            state,
            cell,
            r,
            c,
            entity,
            definition,
            production
        });
        if (!resolved || resolved.status !== SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null
            };
        }

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: normalizeYields(resolved.yields),
            kind: production.kind || null
        };
    }

    sum(state) {
        const total = { ...ZERO_YIELDS };
        const unresolved = [];

        for (let r = 0; r < (state?.grid?.length || 0); r++) {
            for (let c = 0; c < (state.grid[r]?.length || 0); c++) {
                const cell = state.grid[r][c];
                if (!cell?.specialBlock) continue;
                const resolved = this.resolveCell(state, cell, { r, c });
                if (resolved.status === SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED) {
                    addYields(total, resolved.yields);
                } else if (resolved.status === SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED) {
                    unresolved.push({
                        r,
                        c,
                        type: cell.specialBlock.type || cell.specialBlock.definitionId || null,
                        kind: resolved.kind
                    });
                }
            }
        }

        return {
            yields: total,
            unresolved
        };
    }
}

const defaultResolver = new SpecialBlockProductionResolver();

export function resolveSpecialBlockProduction(state, cell, position = {}) {
    return defaultResolver.resolveCell(state, cell, position);
}

export function sumSpecialBlockProduction(state) {
    return defaultResolver.sum(state);
}

export { ZERO_YIELDS as SPECIAL_BLOCK_ZERO_YIELDS };
