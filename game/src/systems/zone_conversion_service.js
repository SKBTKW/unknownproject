/* =============================================================
   game/src/systems/zone_conversion_service.js

   Board-owned Zone Conversion candidate / legality / persistence boundary.
   Resource payment and card lifecycle remain outside Board.
   ============================================================= */

import {
    ZONE_CONVERSION_CAPABILITIES,
    ZONE_CONVERSION_COST_STATUS,
    ZONE_CONVERSION_PRODUCTION_KINDS,
    ZONE_CONVERSION_PRODUCTION_STATUS,
    ZONE_CONVERSION_REWARD_STATUS,
    ZONE_CONVERSION_STATES,
    isConvertibleCompletedZone,
    normalizeZoneProductionYieldMap,
    normalizeZoneResourceMap,
    readZoneRecord,
    resolveZoneConversionCost,
    resolveZoneConversionCreationReward,
    zoneConversionCount
} from '../core/zone_conversion_domain.js';
import { resolveMergeTerrainAttribute } from '../core/merge_rules.js';
import { ZoneConversionDefinitionRegistry } from '../core/zone_conversion_definition_registry.js';

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
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

function projectStateAfterPayment(state, payment) {
    const normalized = normalizeZoneResourceMap(payment || {}) || Object.freeze({});
    const projected = { ...(state || {}) };
    for (const key of ['food', 'wood', 'defense', 'mystic', 'ember']) {
        const next = Math.max(0, stateResource(state, key) - Number(normalized[key] || 0));
        projected[key] = next;
        if (key === 'wood') projected.material = next;
    }
    return projected;
}

function hasAnyCost(resources) {
    return Object.values(resources || {}).some(value => Number(value) > 0);
}

function applyCreationReward(state, resources = {}) {
    const applied = {};
    for (const [key, rawAmount] of Object.entries(resources || {})) {
        const amount = Number(rawAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        if (key === 'ember') {
            let gained = 0;
            if (state?.emberSystem && typeof state.emberSystem.recoverInstant === 'function') {
                gained = Number(state.emberSystem.recoverInstant(amount)) || 0;
            } else {
                const before = Number(state?.ember || 0);
                const max = Number.isFinite(Number(state?.maxEmber))
                    ? Number(state.maxEmber)
                    : before + amount;
                const after = Math.min(max, before + amount);
                if (state) state.ember = after;
                gained = after - before;
            }
            if (gained > 0) applied.ember = gained;
            continue;
        }

        if (key === 'defense') {
            let gained = 0;
            if (state?.defenseSystem && typeof state.defenseSystem.recoverCurrentDefense === 'function') {
                gained = Number(state.defenseSystem.recoverCurrentDefense(amount)?.recovered || 0);
            } else {
                const before = Number(state?.currentDefense ?? state?.defense ?? 0);
                const max = Number.isFinite(Number(state?.maxDefense))
                    ? Number(state.maxDefense)
                    : before + amount;
                const after = Math.min(max, before + amount);
                if (state) state.currentDefense = after;
                gained = after - before;
            }
            if (gained > 0) applied.defense = gained;
            continue;
        }

        if (key === 'wood') {
            const before = Number(state?.wood ?? state?.material ?? 0) || 0;
            const after = before + amount;
            if (state) {
                state.wood = after;
                state.material = after;
            }
            applied.wood = amount;
            continue;
        }

        const before = Number(state?.[key] || 0) || 0;
        if (state) state[key] = before + amount;
        applied[key] = amount;
    }
    return Object.freeze(applied);
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
    constructor({
        state,
        definitions = {},
        definitionRegistry = null
    } = {}) {
        this.state = state || null;
        this.definitionRegistry = definitionRegistry instanceof ZoneConversionDefinitionRegistry
            ? definitionRegistry
            : new ZoneConversionDefinitionRegistry(definitions);
    }

    getDefinition(definitionId) {
        return this.definitionRegistry.get(definitionId);
    }

    hasDefinition(definitionId) {
        return this.definitionRegistry.has(definitionId);
    }

    listDefinitionIds() {
        return this.definitionRegistry.listIds();
    }

    getConversionCount(definitionId = null) {
        return zoneConversionCount(this.state, { definitionId });
    }

    resolveProduction(groupId) {
        const zone = readZoneRecord(this.state, groupId);
        const conversion = zone?.conversion || null;
        const zeroYields = Object.freeze({ food: 0, wood: 0, mystic: 0 });

        if (!conversion || conversion.state !== ZONE_CONVERSION_STATES.ACTIVE) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.NONE,
                kind: null,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }

        if (!isConvertibleCompletedZone(this.state, groupId)) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
                kind: null,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }

        const definition = this.getDefinition(conversion.definitionId);
        if (!definition) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
                kind: null,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }

        const production = definition.production || null;
        if (!production) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.NONE,
                kind: null,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }
        if (
            production.status !== ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED
            || production.kind !== ZONE_CONVERSION_PRODUCTION_KINDS.PER_MEMBER_CELL
        ) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
                kind: production.kind || null,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }

        const perMemberYields = normalizeZoneProductionYieldMap(production.perMemberYields);
        if (!perMemberYields) {
            return Object.freeze({
                status: ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED,
                kind: production.kind,
                yields: zeroYields,
                memberCount: 0,
                groupId: String(groupId)
            });
        }

        const memberCount = Array.isArray(zone?.cells)
            ? zone.cells.filter(cell => Number.isInteger(cell?.r) && Number.isInteger(cell?.c)).length
            : 0;
        const yields = Object.freeze({
            food: Number(perMemberYields.food || 0) * memberCount,
            wood: Number(perMemberYields.wood || 0) * memberCount,
            mystic: Number(perMemberYields.mystic || 0) * memberCount
        });
        return Object.freeze({
            status: ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED,
            kind: production.kind,
            definitionId: conversion.definitionId || null,
            perMemberYields,
            yields,
            memberCount,
            groupId: String(groupId)
        });
    }

    resolveCellProduction({ r, c } = {}) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
        const cell = this.state?.grid?.[r]?.[c] || null;
        const groupId = cell?.mergeGroupId;
        if (groupId === null || groupId === undefined) return null;

        const zone = readZoneRecord(this.state, groupId);
        const belongs = Array.isArray(zone?.cells)
            && zone.cells.some(member => member?.r === r && member?.c === c);
        if (!belongs) return null;

        const resolved = this.resolveProduction(groupId);
        if (resolved.status !== ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED) {
            return Object.freeze({
                status: resolved.status,
                kind: resolved.kind,
                definitionId: zone?.conversion?.definitionId || null,
                groupId: String(groupId),
                yields: Object.freeze({ food: 0, wood: 0, mystic: 0 })
            });
        }

        return Object.freeze({
            status: resolved.status,
            kind: resolved.kind,
            definitionId: resolved.definitionId,
            groupId: resolved.groupId,
            yields: Object.freeze({
                food: Number(resolved.perMemberYields?.food || 0),
                wood: Number(resolved.perMemberYields?.wood || 0),
                mystic: Number(resolved.perMemberYields?.mystic || 0)
            })
        });
    }

    sumProduction() {
        const total = { food: 0, wood: 0, mystic: 0 };
        const unresolved = [];

        for (const groupId of Object.keys(this.state?.mergedBlocks || {})) {
            const zone = readZoneRecord(this.state, groupId);
            if (!zone?.conversion) continue;
            const resolved = this.resolveProduction(groupId);
            if (resolved.status === ZONE_CONVERSION_PRODUCTION_STATUS.RESOLVED) {
                total.food += resolved.yields.food;
                total.wood += resolved.yields.wood;
                total.mystic += resolved.yields.mystic;
            } else if (resolved.status === ZONE_CONVERSION_PRODUCTION_STATUS.UNRESOLVED) {
                unresolved.push(Object.freeze({
                    groupId: String(groupId),
                    definitionId: zone.conversion.definitionId || null,
                    kind: resolved.kind
                }));
            }
        }

        return Object.freeze({
            yields: Object.freeze(total),
            unresolved: Object.freeze(unresolved)
        });
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

    resolveCreationReward(definitionId) {
        return resolveZoneConversionCreationReward(this.getDefinition(definitionId));
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

        const creationReward = this.resolveCreationReward(definitionId);
        if (creationReward.status === ZONE_CONVERSION_REWARD_STATUS.UNRESOLVED) {
            reasons.push('CREATION_REWARD_UNRESOLVED');
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

    validateCandidateAfterPayment(definitionId, groupId, payment = {}) {
        const validation = this.validateCandidate(definitionId, groupId);
        if (!validation.valid) return validation;

        const normalizedPayment = normalizeZoneResourceMap(payment);
        if (!normalizedPayment) {
            return {
                ...validation,
                valid: false,
                reasons: ['PAYMENT_RESOURCE_MAP_UNRESOLVED']
            };
        }

        const definition = this.getDefinition(definitionId);
        const projectedState = projectStateAfterPayment(this.state, normalizedPayment);
        const projectedResourceCheck = checkResourceRequirements(
            projectedState,
            definition?.requirements?.resources
        );

        return {
            ...validation,
            valid: projectedResourceCheck.valid,
            reasons: projectedResourceCheck.failures,
            projectedPayment: normalizedPayment
        };
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

        const reward = this.resolveCreationReward(definitionId);
        if (reward.status === ZONE_CONVERSION_REWARD_STATUS.UNRESOLVED) {
            return {
                success: false,
                reason: 'CREATION_REWARD_UNRESOLVED',
                validation,
                reward
            };
        }

        const zone = readZoneRecord(this.state, groupId);
        const appliedCreationReward = reward.status === ZONE_CONVERSION_REWARD_STATUS.RESOLVED
            ? applyCreationReward(this.state, reward.resources)
            : Object.freeze({});
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
            creationReward: Object.freeze({
                status: reward.status,
                requested: Object.freeze(clone(reward.resources, {})),
                applied: appliedCreationReward
            }),
            capabilities: Object.freeze([...definition.capabilities])
        });

        zone.conversion = conversion;
        return {
            success: true,
            groupId: String(groupId),
            conversion: clone(conversion),
            creationReward: clone(conversion.creationReward),
            cost
        };
    }
}

export default ZoneConversionService;
