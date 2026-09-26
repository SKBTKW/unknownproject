/* =============================================================
   game/src/core/board_maintenance_modifier.js

   Board-owned semantic maintenance modifier read model.
   Card identity and facility IDs are intentionally absent.
   ============================================================= */

import {
    BOARD_CAPABILITIES,
    getSpecialBlockDefinition,
    isSpecialBlockFunctional
} from './special_block_domain.js';

export const BOARD_MAINTENANCE_MODIFIER_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED'
});

export const BOARD_MAINTENANCE_MODIFIER_KINDS = Object.freeze({
    FLAT_REDUCTION: 'FLAT_REDUCTION'
});

function validNonNegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeFoodModifier(definition) {
    const food = definition?.maintenanceModifiers?.food || null;
    if (
        !food
        || food.status !== BOARD_MAINTENANCE_MODIFIER_STATUS.RESOLVED
        || food.kind !== BOARD_MAINTENANCE_MODIFIER_KINDS.FLAT_REDUCTION
        || !validNonNegativeNumber(food.amountPerInstance)
    ) {
        return null;
    }

    const maxInstances = food.maxInstances == null ? null : Number(food.maxInstances);
    if (maxInstances !== null && (!Number.isInteger(maxInstances) || maxInstances < 1)) {
        return null;
    }

    return Object.freeze({
        status: BOARD_MAINTENANCE_MODIFIER_STATUS.RESOLVED,
        kind: BOARD_MAINTENANCE_MODIFIER_KINDS.FLAT_REDUCTION,
        amountPerInstance: food.amountPerInstance,
        maxInstances
    });
}

function definitionCapabilities(definition, entity) {
    return new Set([
        ...(Array.isArray(definition?.capabilities) ? definition.capabilities : []),
        ...(Array.isArray(entity?.capabilities) ? entity.capabilities : [])
    ]);
}

export function resolveBoardFoodMaintenanceModifiers(
    state,
    { definitionResolver = getSpecialBlockDefinition } = {}
) {
    const grouped = new Map();
    const unresolved = [];

    for (let r = 0; r < (state?.grid?.length || 0); r++) {
        for (let c = 0; c < (state.grid[r]?.length || 0); c++) {
            const entity = state.grid[r]?.[c]?.specialBlock || null;
            if (!entity || !isSpecialBlockFunctional(entity)) continue;

            const definitionId = entity.definitionId || entity.type || null;
            const definition = definitionId ? definitionResolver(definitionId) : null;
            const capabilities = definitionCapabilities(definition, entity);
            if (!capabilities.has(BOARD_CAPABILITIES.FOOD_STORAGE)) continue;

            if (!definition) {
                unresolved.push(Object.freeze({
                    definitionId,
                    r,
                    c,
                    reason: 'SPECIAL_BLOCK_DEFINITION_MISSING'
                }));
                continue;
            }

            const modifier = normalizeFoodModifier(definition);
            if (!modifier) {
                unresolved.push(Object.freeze({
                    definitionId,
                    r,
                    c,
                    reason: 'FOOD_MAINTENANCE_MODIFIER_UNRESOLVED'
                }));
                continue;
            }

            if (!grouped.has(definitionId)) {
                grouped.set(definitionId, { definitionId, modifier, count: 0 });
            }
            grouped.get(definitionId).count += 1;
        }
    }

    const sources = [];
    let flatReduction = 0;
    let appliedInstances = 0;
    for (const entry of [...grouped.values()].sort((a, b) =>
        String(a.definitionId).localeCompare(String(b.definitionId))
    )) {
        const applied = entry.modifier.maxInstances === null
            ? entry.count
            : Math.min(entry.count, entry.modifier.maxInstances);
        const subtotal = entry.modifier.amountPerInstance * applied;
        flatReduction += subtotal;
        appliedInstances += applied;
        sources.push(Object.freeze({
            definitionId: entry.definitionId,
            activeInstances: entry.count,
            appliedInstances: applied,
            amountPerInstance: entry.modifier.amountPerInstance,
            maxInstances: entry.modifier.maxInstances,
            subtotal
        }));
    }

    return Object.freeze({
        flatReduction,
        appliedInstances,
        sources: Object.freeze(sources),
        unresolved: Object.freeze(unresolved)
    });
}

export default resolveBoardFoodMaintenanceModifiers;
