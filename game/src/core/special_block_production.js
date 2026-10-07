import { readDiscoveredSocketResource, readSocketResourceIdentity, readSocketResourceYields } from './socket_resource_read_model.js';
/* =============================================================
   game/src/core/special_block_production.js
   Minimal production policy boundary for Special Blocks.
   It deliberately does not encode facility ids or invent unresolved numbers.
   ============================================================= */

import {
    getSpecialBlockDefinition,
    isSpecialBlockFunctional,
    readCellCapabilities
} from './special_block_domain.js';
import { resolveSpecialBlockDamageEffect } from './board_damage_effect_policy.js';
import { resolveCellProductionBase, resolvePlacedBlockProduction } from './land_production_contract.js';
import {
    resolveSpecialBlockDevelopmentModifiers,
    sumSpecialBlockDevelopmentModifiers
} from './special_block_development_domain.js';

export const SPECIAL_BLOCK_PRODUCTION_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED',
    NONE: 'NONE'
});

export const SPECIAL_BLOCK_PRODUCTION_KINDS = Object.freeze({
    FIXED: 'FIXED',
    SOURCE_SIZE: 'SOURCE_SIZE',
    CONDITIONAL: 'CONDITIONAL',
    RELATION_COUNT: 'RELATION_COUNT',
    SOURCE_RESOURCE_BONUS: 'SOURCE_RESOURCE_BONUS'
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

function isValidYieldValue(value) {
    return value === undefined
        || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isValidYieldMap(yields) {
    if (!yields || typeof yields !== 'object' || Array.isArray(yields)) return false;
    return ['food', 'wood', 'material', 'defense', 'mystic']
        .every(key => isValidYieldValue(yields[key]));
}

function normalizeYields(yields) {
    if (!isValidYieldMap(yields)) return null;
    return {
        food: yields.food ?? 0,
        wood: yields.wood ?? yields.material ?? 0,
        defense: yields.defense ?? 0,
        mystic: yields.mystic ?? 0
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
    if (!normalized || !Number.isInteger(factor) || factor < 0) return null;
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
        this.strategies = Object.freeze({ ...strategies });
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
        const size = entity?.sourceGroupReference?.initialSize;
        if (!Number.isInteger(size) || size < 0 || !isValidYieldMap(production?.perSourceYields)) return null;
        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: multiplyYields(production.perSourceYields, size)
        };
    }

    _resolveRelationCount(state, r, c, production) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return null;

        const relationCapability = typeof production?.relationCapability === 'string'
            && production.relationCapability
            ? production.relationCapability
            : null;
        const relationDefinitionId = typeof production?.relationDefinitionId === 'string'
            && production.relationDefinitionId
            ? production.relationDefinitionId
            : null;
        const relationTerrainIds = production?.relationTerrainIds;
        const hasTerrainRelation = Array.isArray(relationTerrainIds) && relationTerrainIds.length > 0;
        const relationResourceCategory = production?.relationResourceCategory;
        const relationProductionResource = production?.relationPositiveProductionResource;
        if (!relationCapability && !relationDefinitionId && !hasTerrainRelation && !relationResourceCategory && !relationProductionResource) return null;
        if (!isValidYieldMap(production?.perRelationYields)) return null;

        const offsets = relationOffsets(production.relationNeighborhood);
        if (!offsets) return null;

        let count = 0;
        const countedRelationInstances = new Set();
        for (const [dr, dc] of offsets) {
            const neighbor = state?.grid?.[r + dr]?.[c + dc];
            if (!neighbor) continue;

            if (relationProductionResource) {
                if (hasCellPositiveProduction(state, neighbor, { r: r + dr, c: c + dc }, relationProductionResource, {
                    resolver: this,
                    excludedDefinitionIds: production.relationExcludedDefinitionIds
                })) {
                    const relatedInstanceId = neighbor.specialBlock?.instanceId || null;
                    if (!relatedInstanceId || !countedRelationInstances.has(relatedInstanceId)) {
                        count++;
                        if (relatedInstanceId) countedRelationInstances.add(relatedInstanceId);
                    }
                }
                continue;
            }

            if (relationResourceCategory) {
                if (neighbor.socketResource?.category === relationResourceCategory
                    && !production.relationExcludeSpecialBlockTypes?.includes(neighbor.specialBlock?.definitionId || neighbor.specialBlock?.type)) count++;
                continue;
            }

            if (hasTerrainRelation) {
                const terrain = neighbor.terrain;
                if (neighbor.placed && !neighbor.isHQ && !neighbor.specialBlock && terrain
                    && relationTerrainIds.includes(terrain.terrainId || terrain.id)
                    && Number.isFinite(terrain.gl)
                    && terrain.gl >= production.relationMinGL) count++;
                continue;
            }

            if (relationDefinitionId) {
                const entity = neighbor.specialBlock;
                const definitionId = entity?.definitionId || entity?.type || null;
                if (definitionId === relationDefinitionId && isSpecialBlockFunctional(entity)) count++;
                continue;
            }

            const capabilities = this.capabilityReader(neighbor);
            if (capabilities?.has?.(relationCapability)) count++;
        }

        const maxRelations = production.maxRelations;
        const effectiveCount = Number.isFinite(maxRelations)
            ? Math.min(count, Math.max(0, Math.trunc(maxRelations)))
            : count;

        const relationYields = multiplyYields(production.perRelationYields, effectiveCount);
        if (!relationYields) return null;
        const baseYields = production.baseYields === undefined
            ? { ...ZERO_YIELDS }
            : normalizeYields(production.baseYields);
        if (!baseYields) return null;

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: addYields({ ...baseYields }, relationYields)
        };
    }

    _resolveSourceResourceBonus(state, entity, production) {
        const source = entity?.terrainAdjacencyProfile?.source;
        if (!Number.isInteger(source?.r) || !Number.isInteger(source?.c)) return null;

        const cell = state?.grid?.[source.r]?.[source.c];
        const resource = readDiscoveredSocketResource(cell, production?.allowedResourceCategories);
        const reference = entity.sourceResourceReference;
        if (!resource || (reference && (
            reference.r !== source.r || reference.c !== source.c
            || reference.resourceId !== readSocketResourceIdentity(resource)
            || reference.category !== resource.category
        ))) return { status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED, yields: { ...ZERO_YIELDS } };

        const sourceYields = normalizeYields(readSocketResourceYields(resource));
        const increment = Number(production?.perPositiveYield);
        if (!sourceYields || !Number.isFinite(increment) || increment < 0) return null;

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: {
                food: sourceYields.food > 0 ? increment : 0,
                wood: sourceYields.wood > 0 ? increment : 0,
                defense: sourceYields.defense > 0 ? increment : 0,
                mystic: sourceYields.mystic > 0 ? increment : 0
            }
        };
    }

    _resolveBuiltIn(state, cell, position, entity, production) {
        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_SIZE) {
            return this._resolveSourceSize(entity, production);
        }
        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT) {
            return this._resolveRelationCount(state, position.r, position.c, production);
        }
        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_RESOURCE_BONUS) {
            return this._resolveSourceResourceBonus(state, entity, production);
        }
        return null;
    }

    resolveCell(state, cell, { r = null, c = null } = {}) {
        const entity = cell?.specialBlock;
        if (!entity) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.NONE,
                yields: { ...ZERO_YIELDS },
                kind: null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }
        if (!isSpecialBlockFunctional(entity)) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.NONE,
                yields: { ...ZERO_YIELDS },
                kind: null,
                lifecycleState: entity.state ?? null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        const definition = this.definitionResolver(entity.definitionId || entity.type);
        const production = definition?.production || null;
        if (!production) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.NONE,
                yields: { ...ZERO_YIELDS },
                kind: null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        if (production.status !== SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        if (production.kind === SPECIAL_BLOCK_PRODUCTION_KINDS.FIXED) {
            const fixedYields = normalizeYields(production.yields);
            if (!fixedYields) {
                return {
                    status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                    yields: { ...ZERO_YIELDS },
                    kind: production.kind,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
            }
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: fixedYields,
                kind: production.kind,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
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
                yields: builtIn.yields,
                kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        const strategy = this.strategies[production.strategyKey || production.kind];
        if (typeof strategy !== 'function') {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
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
                kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        const normalizedResolvedYields = normalizeYields(resolved.yields);
        if (!normalizedResolvedYields) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
                yields: { ...ZERO_YIELDS },
                kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: normalizedResolvedYields,
            kind: production.kind || null,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
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

/** Count a public producing cell once, regardless of yield magnitude or vicinity bonuses.
 * Reuse canonical Land, Socket, Zone Conversion and Special Block projections;
 * cached/unresolved socket seeds and HQ are never production relation sources.
 */
export function hasCellPositiveProduction(state, cell, position, resource, {
    resolver = runtimeResolver(state), excludedDefinitionIds = []
} = {}) {
    if (!cell || cell.isHQ || !Object.hasOwn(ZERO_YIELDS, resource)) return false;
    const definitionId = cell.specialBlock?.definitionId || cell.specialBlock?.type;
    if (excludedDefinitionIds?.includes(definitionId)) return false;
    if (cell.placed && cell.terrain) {
        if (resolveCellProductionBase(cell).yields[resource] > 0) return true;
        if (cell.placementGroupId && resolvePlacedBlockProduction(state, cell.placementGroupId).yields[resource] > 0) return true;
        const socket = readDiscoveredSocketResource(cell);
        if (socket && readSocketResourceYields(socket)[resource] > 0) return true;
        const conversion = state?.zoneConversionService?.resolveCellProduction?.(position);
        if (conversion?.status === 'RESOLVED' && conversion.yields?.[resource] > 0) return true;
    }
    if (!cell.specialBlock) return false;
    const special = resolver.resolveCell(state, cell, position);
    if (special.status === SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED && special.yields[resource] > 0) {
        return true;
    }
    const development = resolveSpecialBlockDevelopmentModifiers(
        state,
        cell.specialBlock.instanceId || position
    );
    return development.active === true && Number(development.yields?.[resource] || 0) > 0;
}

function runtimeResolver(state) {
    const resolver = state?.specialBlockProductionResolver;
    return resolver
        && typeof resolver.resolveCell === 'function'
        && typeof resolver.sum === 'function'
        ? resolver
        : defaultResolver;
}

export function resolveSpecialBlockProduction(state, cell, position = {}) {
    const base = runtimeResolver(state).resolveCell(state, cell, position);
    const baseYields = normalizeYields(base?.yields || ZERO_YIELDS) || { ...ZERO_YIELDS };
    const development = cell?.specialBlock
        ? resolveSpecialBlockDevelopmentModifiers(
            state,
            cell.specialBlock.instanceId || position
        )
        : null;
    const developmentYields = normalizeYields(development?.yields || ZERO_YIELDS) || { ...ZERO_YIELDS };

    if (base.status === SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED) {
        return {
            ...base,
            baseYields,
            developmentYields,
            developmentDefenseCapacityBonus: Number(development?.defenseCapacityBonus || 0)
        };
    }

    const effectiveYields = addYields({ ...baseYields }, developmentYields);
    const hasDevelopmentYield = Object.values(developmentYields).some(value => Number(value || 0) > 0);
    return {
        ...base,
        status: base.status === SPECIAL_BLOCK_PRODUCTION_STATUS.NONE && hasDevelopmentYield
            ? SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED
            : base.status,
        kind: base.kind || (hasDevelopmentYield ? 'DEVELOPMENT' : null),
        yields: effectiveYields,
        baseYields,
        developmentYields,
        developmentDefenseCapacityBonus: Number(development?.defenseCapacityBonus || 0)
    };
}

export function sumSpecialBlockProduction(state) {
    const base = runtimeResolver(state).sum(state);
    const development = sumSpecialBlockDevelopmentModifiers(state);
    const baseYields = normalizeYields(base?.yields || ZERO_YIELDS) || { ...ZERO_YIELDS };
    const developmentYields = normalizeYields(development?.yields || ZERO_YIELDS) || { ...ZERO_YIELDS };
    return {
        ...base,
        yields: addYields({ ...baseYields }, developmentYields),
        baseYields,
        developmentYields,
        developmentUnresolved: development?.unresolved || []
    };
}

export { ZERO_YIELDS as SPECIAL_BLOCK_ZERO_YIELDS };
