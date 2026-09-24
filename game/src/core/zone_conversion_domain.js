/* =============================================================
   game/src/core/zone_conversion_domain.js

   Zone Conversion read model and definition contract.
   A conversion decorates an already-completed Zone (MERGE group).
   It never rewrites terrain identity, merge geometry, or LINK semantics.
   ============================================================= */

import { isCompletedMergeGroup, resolveMergeTerrainAttribute } from './merge_rules.js';
import { BOARD_CAPABILITIES } from './special_block_domain.js';

export const ZONE_CONVERSION_STATES = Object.freeze({
    ACTIVE: 'ACTIVE',
    DYSFUNCTIONAL: 'DYSFUNCTIONAL'
});

export const ZONE_CONVERSION_COST_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED'
});

export const ZONE_CONVERSION_PRODUCTION_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED',
    NONE: 'NONE'
});

export const ZONE_CONVERSION_PRODUCTION_KINDS = Object.freeze({
    PER_MEMBER_CELL: 'PER_MEMBER_CELL'
});

const ZONE_PRODUCTION_RESOURCE_KEYS = Object.freeze(['food', 'wood', 'mystic']);

export function normalizeZoneProductionYieldMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalized = {};
    for (const key of ZONE_PRODUCTION_RESOURCE_KEYS) {
        const raw = value[key];
        if (raw === undefined) continue;
        if (!validNonNegativeNumber(raw)) return null;
        normalized[key] = raw;
    }
    for (const key of Object.keys(value)) {
        if (!ZONE_PRODUCTION_RESOURCE_KEYS.includes(key) && Number(value[key] || 0) !== 0) {
            return null;
        }
    }
    return Object.freeze(normalized);
}

export const ZONE_CONVERSION_ESCALATION_SCOPES = Object.freeze({
    SAME_DEFINITION: 'SAME_DEFINITION',
    ALL_CONVERSIONS: 'ALL_CONVERSIONS'
});

export const ZONE_CONVERSION_CAPABILITIES = Object.freeze({
    GARRISON_SITE: BOARD_CAPABILITIES.GARRISON_SITE,
    DEFENSE_ANCHOR: BOARD_CAPABILITIES.DEFENSE_ANCHOR,
    REINFORCEMENT_ORIGIN: BOARD_CAPABILITIES.REINFORCEMENT_ORIGIN
});

const RESOURCE_KEYS = Object.freeze(['food', 'wood', 'defense', 'mystic', 'ember']);

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function validNonNegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function normalizeZoneResourceMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const normalized = {};
    for (const key of RESOURCE_KEYS) {
        const raw = value[key];
        if (raw === undefined) continue;
        if (!validNonNegativeNumber(raw)) return null;
        normalized[key] = raw;
    }
    return Object.freeze(normalized);
}

export function readZoneRecord(state, groupId) {
    if (!state || groupId === null || groupId === undefined) return null;
    return state.mergedBlocks?.[groupId] || null;
}

export function isConvertibleCompletedZone(state, groupId) {
    return isCompletedMergeGroup(state, groupId);
}

export function readZoneConversion(state, groupId) {
    const zone = readZoneRecord(state, groupId);
    return zone?.conversion ? clone(zone.conversion) : null;
}

export function isZoneConversionFunctional(state, groupId) {
    return readZoneRecord(state, groupId)?.conversion?.state === ZONE_CONVERSION_STATES.ACTIVE;
}

export function readZoneConversionCapabilities(state, groupId) {
    const conversion = readZoneRecord(state, groupId)?.conversion;
    if (!conversion || conversion.state !== ZONE_CONVERSION_STATES.ACTIVE) return new Set();
    return new Set(
        Array.isArray(conversion?.capabilities)
            ? conversion.capabilities.filter(value => typeof value === 'string' && value)
            : []
    );
}

export function zoneConversionCount(state, { definitionId = null } = {}) {
    let count = 0;
    for (const [groupId, zone] of Object.entries(state?.mergedBlocks || {})) {
        if (!isCompletedMergeGroup(state, groupId)) continue;
        const conversion = zone?.conversion;
        if (!conversion) continue;
        if (definitionId && conversion.definitionId !== definitionId) continue;
        count++;
    }
    return count;
}

export function resolveZoneConversionCost(state, definition) {
    const cost = definition?.creationCost;
    if (!cost || cost.status !== ZONE_CONVERSION_COST_STATUS.RESOLVED) {
        return Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED,
            resources: null,
            conversionCount: null
        });
    }

    const base = normalizeZoneResourceMap(cost.base);
    if (!base) {
        return Object.freeze({
            status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED,
            resources: null,
            conversionCount: null
        });
    }

    const escalation = cost.escalation || null;
    let count = 0;
    let step = Object.freeze({});

    if (escalation) {
        if (!Object.values(ZONE_CONVERSION_ESCALATION_SCOPES).includes(escalation.scope)) {
            return Object.freeze({
                status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED,
                resources: null,
                conversionCount: null
            });
        }
        step = normalizeZoneResourceMap(escalation.perConversion);
        if (!step) {
            return Object.freeze({
                status: ZONE_CONVERSION_COST_STATUS.UNRESOLVED,
                resources: null,
                conversionCount: null
            });
        }
        count = zoneConversionCount(state, {
            definitionId: escalation.scope === ZONE_CONVERSION_ESCALATION_SCOPES.SAME_DEFINITION
                ? definition?.id
                : null
        });
    }

    const resources = {};
    for (const key of RESOURCE_KEYS) {
        const total = (base[key] || 0) + ((step[key] || 0) * count);
        if (total > 0) resources[key] = total;
    }

    return Object.freeze({
        status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
        resources: Object.freeze(resources),
        conversionCount: count
    });
}

export function readZoneSemantic(state, groupId) {
    const zone = readZoneRecord(state, groupId);
    if (!zone) return null;
    return Object.freeze({
        groupId: String(groupId),
        mergeType: zone.mergeType || null,
        terrainAttribute: resolveMergeTerrainAttribute(state, groupId),
        cells: Object.freeze((zone.cells || []).map(cell => Object.freeze({ r: cell.r, c: cell.c }))),
        conversion: zone.conversion ? Object.freeze(clone(zone.conversion)) : null
    });
}
