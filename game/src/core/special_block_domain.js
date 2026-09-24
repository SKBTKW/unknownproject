/* =============================================================
   game/src/core/special_block_domain.js
   Special Block definitions, capabilities and read-only semantics.
   Card / Offering identity is intentionally not part of this domain.
   ============================================================= */

import { isIrrigationSourceCell } from './irrigation_rules.js';

export const BOARD_CAPABILITIES = Object.freeze({
    WATER_SOURCE: 'WATER_SOURCE',
    MYSTIC_SOURCE: 'MYSTIC_SOURCE',
    MILITARY_SITE: 'MILITARY_SITE',
    INVESTIGATION_SITE: 'INVESTIGATION_SITE',
    OBSERVATION_SITE: 'OBSERVATION_SITE',
    PRODUCTION_SITE: 'PRODUCTION_SITE',
    FOOD_STORAGE: 'FOOD_STORAGE',
    DEFENSE_ANCHOR: 'DEFENSE_ANCHOR',
    REINFORCEMENT_ORIGIN: 'REINFORCEMENT_ORIGIN',
    GARRISON_SITE: 'GARRISON_SITE'
});

export const SPECIAL_BLOCK_TYPES = Object.freeze({
    FARM: 'FARM',
    GRANARY: 'GRANARY',
    LOGGING_CAMP: 'LOGGING_CAMP',
    MINE: 'MINE',
    ALTAR: 'ALTAR',
    PALISADE: 'PALISADE',
    EARTHWORK: 'EARTHWORK',
    WATCHTOWER: 'WATCHTOWER'
});

export const BASE_TERRAIN_INTERACTIONS = Object.freeze({
    INDEPENDENT: 'INDEPENDENT',
    TRANSFORMING_OVERLAY: 'TRANSFORMING_OVERLAY',
    TERRAIN_USING_OVERLAY: 'TERRAIN_USING_OVERLAY'
});

export const SPECIAL_BLOCK_COST_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED'
});

export const SPECIAL_BLOCK_ADJACENCY_GL = 1;

function finiteTerrainAxis(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * Special Blocks participate in Board adjacency without becoming normal Terrain.
 * E is copied from the terrain used as the construction reference; GL is always
 * treated as 1. The persisted profile keeps independent/special-only cells
 * deterministic across save/restore.
 */
export function createSpecialBlockAdjacencyProfile(referenceCell, source = null) {
    const elevation = finiteTerrainAxis(referenceCell?.terrain?.e);
    return Object.freeze({
        e: elevation,
        gl: SPECIAL_BLOCK_ADJACENCY_GL,
        ...(source && Number.isInteger(source.r) && Number.isInteger(source.c)
            ? { source: Object.freeze({ r: source.r, c: source.c }) }
            : {})
    });
}

export function readSpecialBlockAdjacencyProfile(entityOrCell) {
    const cell = entityOrCell?.specialBlock ? entityOrCell : null;
    const entity = cell?.specialBlock || entityOrCell;
    if (!entity || typeof entity !== 'object') return null;

    const stored = entity.terrainAdjacencyProfile;
    const storedE = finiteTerrainAxis(stored?.e);
    const fallbackE = finiteTerrainAxis(cell?.terrain?.e);

    return Object.freeze({
        e: storedE !== null ? storedE : fallbackE,
        gl: SPECIAL_BLOCK_ADJACENCY_GL,
        ...(stored?.source && Number.isInteger(stored.source.r) && Number.isInteger(stored.source.c)
            ? { source: Object.freeze({ r: stored.source.r, c: stored.source.c }) }
            : {})
    });
}

export function validateTerrainAgainstSpecialBlockAdjacency(terrain, profile) {
    if (!terrain || !profile) return { valid: true, reasons: [] };

    const terrainGL = finiteTerrainAxis(terrain.gl);
    const terrainE = finiteTerrainAxis(terrain.e);
    const reasons = [];

    // Absolute facility-edge exclusions. GL0 is not enough to identify a
    // desert because canonical mountains also use GL0; keep the two semantics
    // explicit so facilities such as mines are not misclassified.
    const id = String(terrain.terrainId || terrain.id || '').toUpperCase();
    const isDesert = id.includes('DESERT');
    const isMountain = terrainE === 3 || id.includes('MOUNTAIN');
    if (isDesert) reasons.push('SPECIAL_BLOCK_DESERT_NEIGHBOR_FORBIDDEN');
    if (isMountain) reasons.push('SPECIAL_BLOCK_MOUNTAIN_NEIGHBOR_FORBIDDEN');

    if (
        terrainGL !== null
        && Number.isFinite(profile.gl)
        && Math.abs(terrainGL - profile.gl) >= 2
    ) {
        reasons.push('INVALID_GL_NEIGHBOR');
    }

    if (
        terrainE !== null
        && Number.isFinite(profile.e)
        && Math.abs(terrainE - profile.e) >= 2
    ) {
        if ((terrainE === 0 && profile.e === 3) || (terrainE === 3 && profile.e === 0)) {
            reasons.push('WETLAND_MOUNTAIN_NEIGHBOR');
        } else if ((terrainE === 0 && profile.e === 2) || (terrainE === 2 && profile.e === 0)) {
            reasons.push('WETLAND_HILL_NEIGHBOR');
        } else {
            reasons.push('INVALID_ELEVATION_NEIGHBOR');
        }
    }

    return {
        valid: reasons.length === 0,
        reasons: [...new Set(reasons)]
    };
}

const SPECIAL_BLOCK_RESOURCE_KEYS = Object.freeze(['food', 'wood', 'defense', 'mystic', 'ember']);

function validNonNegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeSpecialBlockResourceMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalized = {};
    for (const key of SPECIAL_BLOCK_RESOURCE_KEYS) {
        const raw = value[key];
        if (raw === undefined) continue;
        if (!validNonNegativeNumber(raw)) return null;
        normalized[key] = raw;
    }
    return Object.freeze(normalized);
}

export function resolveSpecialBlockCreationCost(definition) {
    const cost = definition?.creationCost;
    if (!cost || cost.status !== SPECIAL_BLOCK_COST_STATUS.RESOLVED) {
        return Object.freeze({
            status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED,
            resources: null
        });
    }
    const resources = normalizeSpecialBlockResourceMap(cost.resources);
    if (!resources) {
        return Object.freeze({
            status: SPECIAL_BLOCK_COST_STATUS.UNRESOLVED,
            resources: null
        });
    }
    return Object.freeze({
        status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
        resources
    });
}

const defaultTrialTraits = Object.freeze({
    interceptionAllowed: null,
    suppressTerrainTactic: false,
    specialTactics: Object.freeze([]),
    defenseModifier: null,
    resilience: null
});

const overlayPlacement = Object.freeze({
    mode: 'OVERLAY',
    requirePlacedTerrain: true,
    excludeHQ: true,
    requireEmptySpecialBlock: true
});

function freezeStringArray(values) {
    return Array.isArray(values) ? Object.freeze([...values]) : values;
}

function freezeYieldMap(value) {
    return value && typeof value === 'object'
        ? Object.freeze({ ...value })
        : value;
}

function freezeProductionDefinition(production) {
    if (!production) return null;
    return Object.freeze({
        ...production,
        yields: freezeYieldMap(production.yields),
        perSourceYields: freezeYieldMap(production.perSourceYields),
        perRelationYields: freezeYieldMap(production.perRelationYields)
    });
}

function freezeDefinition(definition) {
    const placement = {
        ...(definition.placement || {}),
        terrainIds: freezeStringArray(definition.placement?.terrainIds),
        sourceTerrainIds: freezeStringArray(definition.placement?.sourceTerrainIds)
    };
    return Object.freeze({
        ...definition,
        placement: Object.freeze(placement),
        baseTerrainInteraction: Object.freeze({ ...(definition.baseTerrainInteraction || {}) }),
        ...(definition.creationCost
            ? {
                creationCost: Object.freeze({
                    ...definition.creationCost,
                    resources: definition.creationCost.resources
                        ? Object.freeze({ ...definition.creationCost.resources })
                        : definition.creationCost.resources
                })
            }
            : {}),
        production: freezeProductionDefinition(definition.production),
        capabilities: Object.freeze([...(definition.capabilities || [])]),
        trialTraits: Object.freeze({
            ...defaultTrialTraits,
            ...(definition.trialTraits || {}),
            specialTactics: Object.freeze([...(definition.trialTraits?.specialTactics || [])])
        }),
        lifecycle: Object.freeze({ ...(definition.lifecycle || {}) }),
        presentation: Object.freeze({ ...(definition.presentation || {}) })
    });
}

export const SPECIAL_BLOCK_DEFINITIONS = Object.freeze({
    [SPECIAL_BLOCK_TYPES.FARM]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.FARM,
        category: 'PRODUCTION',
        placement: {
            mode: 'INDEPENDENT_CELL_GENERATION',
            targeting: 'SOURCE_AND_ADJACENT_EMPTY',
            sourceTerrainIds: ['GL1_PLAINS']
        },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.INDEPENDENT },
        production: { kind: 'FIXED', status: 'UNRESOLVED' },
        capabilities: [BOARD_CAPABILITIES.PRODUCTION_SITE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_FARM' }
    }),
    [SPECIAL_BLOCK_TYPES.GRANARY]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.GRANARY,
        category: 'STORAGE',
        placement: {
            ...overlayPlacement,
            terrainIds: ['GL1_PLAINS', 'E1_RECLAIMED_LAND']
        },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: null,
        capabilities: [BOARD_CAPABILITIES.FOOD_STORAGE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_GRANARY' }
    }),
    [SPECIAL_BLOCK_TYPES.LOGGING_CAMP]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        category: 'PRODUCTION',
        placement: {
            ...overlayPlacement,
            terrainIds: ['GL2_FOREST', 'GL3_DEEP_FOREST', 'E2_FOREST_HILL', 'E2_DEEP_HILL'],
            minGL: 2,
            requiresSourceCluster: true
        },
        baseTerrainInteraction: {
            kind: BASE_TERRAIN_INTERACTIONS.TRANSFORMING_OVERLAY,
            glDelta: -1
        },
        production: { kind: 'SOURCE_SIZE', status: 'UNRESOLVED' },
        capabilities: [BOARD_CAPABILITIES.PRODUCTION_SITE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_LOGGING_CAMP' }
    }),
    [SPECIAL_BLOCK_TYPES.MINE]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.MINE,
        category: 'PRODUCTION',
        placement: {
            ...overlayPlacement,
            terrainIds: ['E2_HILL', 'E3_MOUNTAIN']
        },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: { kind: 'CONDITIONAL', status: 'UNRESOLVED' },
        capabilities: [BOARD_CAPABILITIES.PRODUCTION_SITE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_MINE' }
    }),
    [SPECIAL_BLOCK_TYPES.ALTAR]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.ALTAR,
        category: 'PRODUCTION',
        placement: {
            ...overlayPlacement,
            requiresAdjacentCapability: BOARD_CAPABILITIES.MYSTIC_SOURCE
        },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: { kind: 'RELATION_COUNT', status: 'UNRESOLVED' },
        capabilities: [BOARD_CAPABILITIES.PRODUCTION_SITE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_ALTAR' }
    }),
    [SPECIAL_BLOCK_TYPES.PALISADE]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.PALISADE,
        category: 'DEFENSE',
        placement: {
            ...overlayPlacement,
            orientation: 'CARDINAL'
        },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: null,
        capabilities: [BOARD_CAPABILITIES.MILITARY_SITE],
        trialTraits: {
            interceptionAllowed: true,
            suppressTerrainTactic: true,
            specialTactics: ['PALISADE_DIRECTIONAL_DEFENSE']
        },
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_PALISADE' }
    }),
    [SPECIAL_BLOCK_TYPES.EARTHWORK]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.EARTHWORK,
        category: 'DEFENSE',
        placement: { ...overlayPlacement },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: null,
        capabilities: [BOARD_CAPABILITIES.MILITARY_SITE],
        trialTraits: {
            interceptionAllowed: true,
            suppressTerrainTactic: false,
            specialTactics: ['EARTHWORK_DEFENSE']
        },
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_EARTHWORK' }
    }),
    [SPECIAL_BLOCK_TYPES.WATCHTOWER]: freezeDefinition({
        id: SPECIAL_BLOCK_TYPES.WATCHTOWER,
        category: 'OBSERVATION',
        placement: { ...overlayPlacement },
        baseTerrainInteraction: { kind: BASE_TERRAIN_INTERACTIONS.TERRAIN_USING_OVERLAY },
        production: null,
        capabilities: [BOARD_CAPABILITIES.OBSERVATION_SITE],
        trialTraits: {},
        lifecycle: { initialState: 'ACTIVE' },
        presentation: { nameKey: 'SPECIAL_BLOCK_WATCHTOWER' }
    })
});

export function getSpecialBlockDefinition(type) {
    return SPECIAL_BLOCK_DEFINITIONS[type] || null;
}

export function isSpecialBlockFunctional(entityOrCell) {
    const entity = entityOrCell?.specialBlock || entityOrCell;
    if (!entity || typeof entity !== 'object') return false;
    return entity.state === undefined
        || entity.state === null
        || entity.state === 'ACTIVE';
}

function addCapabilities(target, values) {
    for (const value of values || []) {
        if (typeof value === 'string' && value) target.add(value);
    }
}

function terrainId(cell) {
    return cell?.terrain?.terrainId || cell?.terrain?.id || cell?.terrainId || null;
}

/**
 * Capability read model. Consumers never need to inspect terrain ids.
 * Terrain-id mapping stays internal to the Board domain.
 */
export function readCellCapabilities(cell) {
    const capabilities = new Set();
    if (!cell) return capabilities;

    addCapabilities(capabilities, cell.capabilities);
    addCapabilities(capabilities, cell.terrain?.capabilities);
    addCapabilities(capabilities, cell.socketResource?.capabilities);

    const id = terrainId(cell);
    if (id === 'E0_WETLAND') capabilities.add(BOARD_CAPABILITIES.WATER_SOURCE);
    if (isIrrigationSourceCell(cell)) capabilities.add(BOARD_CAPABILITIES.WATER_SOURCE);

    if (isSpecialBlockFunctional(cell.specialBlock)) {
        addCapabilities(capabilities, cell.specialBlock?.capabilities);
        const specialDefinition = getSpecialBlockDefinition(
            cell.specialBlock?.definitionId || cell.specialBlock?.type
        );
        addCapabilities(capabilities, specialDefinition?.capabilities);
    }

    // HQ is never promoted to MYSTIC_SOURCE by production values.
    if (cell.isHQ) capabilities.delete(BOARD_CAPABILITIES.MYSTIC_SOURCE);

    return capabilities;
}

export function hasCellCapability(cell, capability) {
    return readCellCapabilities(cell).has(capability);
}

export function readEffectiveGreenery(cell) {
    const base = Number(cell?.terrain?.gl);
    if (!Number.isFinite(base)) return null;

    // New entities persist the ecological effect explicitly. Legacy saves from
    // the first Special Block implementation may already have the delta
    // materialized into terrain.gl and carry no baseTerrainEffect. In that
    // case, treat the stored GL as authoritative to avoid applying GL-1 twice.
    const explicitDelta = Number(cell?.specialBlock?.baseTerrainEffect?.glDelta);
    const delta = Number.isFinite(explicitDelta) ? explicitDelta : 0;

    return Math.max(0, base + delta);
}

export function readSpecialBlockTrialTraits(entityOrCell) {
    const entity = entityOrCell?.specialBlock || entityOrCell;
    if (!entity || typeof entity !== 'object') return null;
    if (!isSpecialBlockFunctional(entity)) return null;
    const definition = getSpecialBlockDefinition(entity.definitionId || entity.type);
    if (!definition) return null;
    return {
        ...definition.trialTraits,
        ...(entity.trialTraits || {}),
        specialTactics: [
            ...(entity.trialTraits?.specialTactics || definition.trialTraits.specialTactics || [])
        ]
    };
}
