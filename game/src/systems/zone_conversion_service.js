/* =============================================================
   game/src/systems/zone_conversion_service.js

   Board-owned Zone Conversion candidate / legality / persistence boundary.
   Resource payment and card lifecycle remain outside Board.
   ============================================================= */

import {
    ZONE_CONVERSION_CAPABILITIES,
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_STATES,
    isConvertibleCompletedZone,
    normalizeZoneResourceMap,
    readZoneRecord,
    resolveZoneConversionCost,
    zoneConversionCount
} from '../core/zone_conversion_domain.js';
import { resolveMergeTerrainAttribute } from '../core/merge_rules.js';

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function freezeStringArray(values) {
    return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

function freezeDefinition(definition) {
    const requirements = definition?.requirements || {};
    return Object.freeze({
        ...definition,
        eligibleZoneAttributes: freezeStringArray(definition?.eligibleZoneAttributes),
        requirements: Object.freeze({
            ...requirements,
            resources: requirements.resources
                ? Object.freeze({ ...requirements.resources })
                : null
        }),
        creationCost: definition?.creationCost
            ? Object.freeze({
                ...definition.creationCost,
                base: definition.creationCost.base
                    ? Object.freeze({ ...definition.creationCost.base })
                    : null,
                escalation: definition.creationCost.escalation
                    ? Object.freeze({
                        ...definition.creationCost.escalation,
                        perConversion: definition.creationCost.escalation.perConversion
                            ? Object.freeze({ ...definition.creationCost.escalation.perConversion })
                            : null
                    })
                    : null
            })
            : null,
        maintenance: definition?.maintenance
            ? Object.freeze({
                ...definition.maintenance,
                resources: definition.maintenance.resources
                    ? Object.freeze({ ...definition.maintenance.resources })
                    : null
            })
            : null,
        capabilities: freezeStringArray(definition?.capabilities)
    });
}

function normalizeDefinitions(definitions) {
    const entries = definitions instanceof Map
        ? [...definitions.entries()]
        : Object.entries(definitions || {});
    const result = new Map();
    for (const [id, definition] of entries) {
        if (!id || !definition || typeof definition !== 'object') continue;
        result.set(String(id), freezeDefinition({ ...definition, id: definition.id || String(id) }));
    }
    return result;
}

function stateResource(state, key) {
    if (key === 'wood') return Number(state?.wood ?? state?.material ?? 0) || 0;
    if (key === 'ember') return Number(state?.ember ?? 0) || 0;
    if (key === 'defense') {
        if (state?.defenseSystem && typeof state.defenseSystem.getCurrentDefense === 'function') {
            return Number(state.defenseSystem.getCurrentDefense()) || 0;
        }
        return Number(state?.currentDefense ?? state?.defense ?? 0) || 0;
    }
    return Number(state?.[key] ?? 0) || 0;
}

function checkResourceRequirements(state, resources) {
    if (resources == null) return { valid: true, failures: [] };
    const normalized = normalizeZoneResourceMap(resources);
    if (!normalized) return { valid: false, failures: ['RESOURCE_REQUIREMENTS_UNRESOLVED'] };

    const failures = [];
    for (const [key, minimum] of Object.entries(normalized)) {
        if (stateResource(state, key) < minimum) failures.push(`RESOURCE_REQUIRED:${key}`);
    }
    return { valid: failures.length === 0, failures };
}

function hasAnyCost(resources) {
    return Object.values(resources || {}).some(value => Number(value) > 0);
}

function representativeZoneCell(zone) {
    const cells = Array.isArray(zone?.cells) ? zone.cells : [];
    return cells
        .filter(cell => Number.isInteger(cell?.r) && Number.isInteger(cell?.c))
        .map(cell => ({ r: cell.r, c: cell.c }))
        .sort((a, b) => (a.r - b.r) || (a.c - b.c))[0] || null;
}

function activeConversionCapabilities(zone) {
    const conversion = zone?.conversion || null;
    if (!conversion || conversion.state !== ZONE_CONVERSION_STATES.ACTIVE) return new Set();
    return new Set(
        Array.isArray(conversion.capabilities)
            ? conversion.capabilities.filter(value => typeof value === 'string' && value)
            : []
    );
}

export class ZoneConversionService {
    constructor({ state, definitions = {} } = {}) {
        this.state = state || null;
        this.definitions = normalizeDefinitions(definitions);
    }

    getDefinition(definitionId) {
        return this.definitions.get(String(definitionId)) || null;
    }

    getConversionCount(definitionId = null) {
        return zoneConversionCount(this.state, { definitionId });
    }

    readCellDeploymentSemantics({ r, c } = {}) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
        const cell = this.state?.grid?.[r]?.[c] || null;
        const groupId = cell?.mergeGroupId;
        if (!groupId) return null;

        const zone = readZoneRecord(this.state, groupId);
        const capabilities = activeConversionCapabilities(zone);
        if (capabilities.size === 0) return null;

        const projected = [];
        if (capabilities.has(ZONE_CONVERSION_CAPABILITIES.DEFENSE_ANCHOR)) {
            projected.push(ZONE_CONVERSION_CAPABILITIES.DEFENSE_ANCHOR);
        }

        const representative = representativeZoneCell(zone);
        const canReinforce = capabilities.has(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE)
            || capabilities.has(ZONE_CONVERSION_CAPABILITIES.REINFORCEMENT_ORIGIN);
        if (
            canReinforce
            && representative
            && representative.r === r
            && representative.c === c
        ) {
            projected.push(ZONE_CONVERSION_CAPABILITIES.REINFORCEMENT_ORIGIN);
        }

        return projected.length > 0
            ? { capabilities: projected, trialTraits: null }
            : null;
    }

    listDeploymentOrigins() {
        const origins = [];
        for (const zone of Object.values(this.state?.mergedBlocks || {})) {
            const capabilities = activeConversionCapabilities(zone);
            const canReinforce = capabilities.has(ZONE_CONVERSION_CAPABILITIES.GARRISON_SITE)
                || capabilities.has(ZONE_CONVERSION_CAPABILITIES.REINFORCEMENT_ORIGIN);
            if (!canReinforce) continue;

            const cell = representativeZoneCell(zone);
            if (!cell) continue;
            origins.push({
                id: `ORIGIN:${cell.r}:${cell.c}`,
                kind: ZONE_CONVERSION_CAPABILITIES.REINFORCEMENT_ORIGIN,
                cell,
                capabilities: [ZONE_CONVERSION_CAPABILITIES.REINFORCEMENT_ORIGIN],
                trialTraits: null
            });
        }
        return origins;
    }

    getMaintenancePlan(groupId, verse = this.state?.turn) {
        const zone = readZoneRecord(this.state, groupId);
        const conversion = zone?.conversion || null;
        if (!conversion) {
            return {
                defined: false,
                due: false,
                reason: 'ZONE_CONVERSION_REQUIRED',
                groupId: String(groupId),
                verse
            };
        }

        const maintenance = conversion.maintenance || null;
        if (!maintenance || maintenance.status !== ZONE_CONVERSION_COST_STATUS.RESOLVED) {
            return {
                defined: false,
                due: false,
                reason: 'MAINTENANCE_DEFINITION_UNRESOLVED',
                groupId: String(groupId),
                verse
            };
        }

        const startsVerse = Number.isInteger(maintenance.startsVerse)
            ? maintenance.startsVerse
            : (Number.isInteger(conversion.createdVerse) ? conversion.createdVerse + 1 : null);
        const currentVerse = Number.isInteger(verse) ? verse : null;
        const due = currentVerse !== null
            && startsVerse !== null
            && currentVerse >= startsVerse
            && maintenance.lastSettledVerse !== currentVerse;

        const resources = normalizeZoneResourceMap(maintenance.resources || {}) || Object.freeze({});
        const shortfalls = {};
        for (const [key, required] of Object.entries(resources)) {
            const available = stateResource(this.state, key);
            if (available < required) shortfalls[key] = required - available;
        }

        return {
            defined: true,
            due,
            groupId: String(groupId),
            verse: currentVerse,
            startsVerse,
            resources,
            canPay: Object.keys(shortfalls).length === 0,
            shortfalls: Object.freeze(shortfalls),
            currentState: conversion.state
        };
    }

    enumerateMaintenanceDue(verse = this.state?.turn) {
        const due = [];
        for (const groupId of Object.keys(this.state?.mergedBlocks || {})) {
            const plan = this.getMaintenancePlan(groupId, verse);
            if (plan.defined && plan.due) due.push(plan);
        }
        return due;
    }

    applyMaintenanceSettlement(groupId, {
        verse = this.state?.turn,
        paymentSucceeded = false
    } = {}) {
        const plan = this.getMaintenancePlan(groupId, verse);
        if (!plan.defined) {
            return { success: false, reason: plan.reason, plan };
        }
        if (!plan.due) {
            return { success: false, reason: 'MAINTENANCE_NOT_DUE', plan };
        }

        const zone = readZoneRecord(this.state, groupId);
        const conversion = zone.conversion;
        const nextState = paymentSucceeded === true
            ? ZONE_CONVERSION_STATES.ACTIVE
            : ZONE_CONVERSION_STATES.DYSFUNCTIONAL;

        zone.conversion = Object.freeze({
            ...conversion,
            state: nextState,
            maintenance: Object.freeze({
                ...conversion.maintenance,
                lastSettledVerse: plan.verse,
                lastPaymentSucceeded: paymentSucceeded === true
            })
        });

        return {
            success: true,
            groupId: String(groupId),
            state: nextState,
            paymentSucceeded: paymentSucceeded === true,
            conversion: clone(zone.conversion),
            plan
        };
    }

    quoteCost(definitionId) {
        const definition = this.getDefinition(definitionId);
        return resolveZoneConversionCost(this.state, definition);
    }

    validateCandidate(definitionId, groupId) {
        const definition = this.getDefinition(definitionId);
        if (!definition) {
            return { valid: false, reasons: ['UNKNOWN_ZONE_CONVERSION'], cost: null };
        }

        const zone = readZoneRecord(this.state, groupId);
        if (!zone || !isConvertibleCompletedZone(this.state, groupId)) {
            return { valid: false, reasons: ['COMPLETED_ZONE_REQUIRED'], cost: null };
        }
        if (zone.conversion) {
            return { valid: false, reasons: ['ZONE_ALREADY_CONVERTED'], cost: null };
        }

        const reasons = [];
        const attribute = resolveMergeTerrainAttribute(this.state, groupId);
        if (definition.eligibleZoneAttributes.length > 0
            && !definition.eligibleZoneAttributes.includes(attribute)) {
            reasons.push('ZONE_ATTRIBUTE_NOT_ALLOWED');
        }

        const resourceCheck = checkResourceRequirements(
            this.state,
            definition.requirements?.resources
        );
        reasons.push(...resourceCheck.failures);

        const cost = this.quoteCost(definitionId);
        if (cost.status !== ZONE_CONVERSION_COST_STATUS.RESOLVED) {
            reasons.push('CREATION_COST_UNRESOLVED');
        }

        const maintenanceResolved = definition.maintenance?.status === ZONE_CONVERSION_COST_STATUS.RESOLVED
            && normalizeZoneResourceMap(definition.maintenance?.resources || {}) !== null;
        if (!maintenanceResolved) {
            reasons.push('MAINTENANCE_DEFINITION_UNRESOLVED');
        }

        return {
            valid: reasons.length === 0,
            reasons,
            groupId: String(groupId),
            zoneAttribute: attribute,
            cost
        };
    }

    enumerateCandidates(definitionId) {
        const candidates = [];
        for (const groupId of Object.keys(this.state?.mergedBlocks || {})) {
            const validation = this.validateCandidate(definitionId, groupId);
            if (validation.valid) candidates.push(validation);
        }
        return candidates;
    }

    hasAnyCandidate(definitionId) {
        return this.enumerateCandidates(definitionId).length > 0;
    }

    createConversion(definitionId, groupId, {
        paymentConfirmed = false,
        createdVerse = null
    } = {}) {
        const validation = this.validateCandidate(definitionId, groupId);
        if (!validation.valid) {
            return {
                success: false,
                reason: validation.reasons[0] || 'ZONE_CONVERSION_NOT_ALLOWED',
                reasons: validation.reasons,
                validation
            };
        }

        const cost = validation.cost;
        if (hasAnyCost(cost.resources) && paymentConfirmed !== true) {
            return {
                success: false,
                reason: 'PAYMENT_CONFIRMATION_REQUIRED',
                validation
            };
        }

        const definition = this.getDefinition(definitionId);
        const maintenanceResources = definition.maintenance?.resources
            ? normalizeZoneResourceMap(definition.maintenance.resources)
            : Object.freeze({});
        if (definition.maintenance?.resources && !maintenanceResources) {
            return {
                success: false,
                reason: 'MAINTENANCE_DEFINITION_UNRESOLVED',
                validation
            };
        }

        const zone = readZoneRecord(this.state, groupId);
        const conversion = Object.freeze({
            instanceId: `ZONE_CONVERSION@${String(groupId)}@${definition.id}`,
            definitionId: definition.id,
            state: ZONE_CONVERSION_STATES.ACTIVE,
            createdVerse: Number.isInteger(createdVerse)
                ? createdVerse
                : (Number.isInteger(this.state?.turn) ? this.state.turn : null),
            sequence: zoneConversionCount(this.state) + 1,
            paidCost: Object.freeze(clone(cost.resources, {})),
            maintenance: Object.freeze({
                status: definition.maintenance?.status || 'UNRESOLVED',
                resources: maintenanceResources,
                startsVerse: Number.isInteger(createdVerse)
                    ? createdVerse + 1
                    : (Number.isInteger(this.state?.turn) ? this.state.turn + 1 : null),
                lastSettledVerse: null,
                lastPaymentSucceeded: null
            }),
            capabilities: Object.freeze([...definition.capabilities])
        });

        zone.conversion = conversion;
        return {
            success: true,
            groupId: String(groupId),
            conversion: clone(conversion),
            cost
        };
    }
}

export default ZoneConversionService;
