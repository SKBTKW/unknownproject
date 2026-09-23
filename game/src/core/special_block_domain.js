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
    PRODUCTION_SITE: 'PRODUCTION_SITE'
});

export const SPECIAL_BLOCK_TYPES = Object.freeze({
    FARM: 'FARM',
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

function freezeDefinition(definition) {
    return Object.freeze({
        ...definition,
        placement: Object.freeze({ ...(definition.placement || {}) }),
        baseTerrainInteraction: Object.freeze({ ...(definition.baseTerrainInteraction || {}) }),
        capabilities: Object.freeze([...(definition.capabilities || [])]),
        trialTraits: Object.freeze({
            ...defaultTrialTraits,
            ...(definition.trialTraits || {}),
            specialTactics: Object.freeze([...(definition.trialTraits?.specialTactics || [])])
        }),
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
    addCapabilities(capabilities, cell.specialBlock?.capabilities);

    const id = terrainId(cell);
    if (id === 'E0_WETLAND') capabilities.add(BOARD_CAPABILITIES.WATER_SOURCE);
    if (isIrrigationSourceCell(cell)) capabilities.add(BOARD_CAPABILITIES.WATER_SOURCE);

    const specialDefinition = getSpecialBlockDefinition(
        cell.specialBlock?.definitionId || cell.specialBlock?.type
    );
    addCapabilities(capabilities, specialDefinition?.capabilities);

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

    const explicitDelta = Number(cell?.specialBlock?.baseTerrainEffect?.glDelta);
    const definition = getSpecialBlockDefinition(
        cell?.specialBlock?.definitionId || cell?.specialBlock?.type
    );
    const definitionDelta = Number(definition?.baseTerrainInteraction?.glDelta);
    const delta = Number.isFinite(explicitDelta)
        ? explicitDelta
        : (Number.isFinite(definitionDelta) ? definitionDelta : 0);

    return Math.max(0, base + delta);
}

export function readSpecialBlockTrialTraits(entityOrCell) {
    const entity = entityOrCell?.specialBlock || entityOrCell;
    if (!entity || typeof entity !== 'object') return null;
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
