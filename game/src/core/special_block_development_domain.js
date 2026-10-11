/* =============================================================
   game/src/core/special_block_development_domain.js
   Generic persistent Development Layer semantics for Special Block instances.
   Card identity, payment and presentation are intentionally outside this file.
   ============================================================= */

import {
    getSpecialBlockDefinition,
    readSpecialBlockTrialCausality
} from './special_block_domain.js';
import {
    enumerateSpecialBlockInstances,
    resolveSpecialBlockInstance
} from './special_block_instance_read_model.js';

export const SPECIAL_BLOCK_DEVELOPMENT_LAYERS = Object.freeze({
    BASIC: 'BASIC',
    SPECIALIZATION: 'SPECIALIZATION',
    INTEGRATION: 'INTEGRATION'
});

export const SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS = Object.freeze({
    YIELD_BONUS: 'YIELD_BONUS',
    DEFENSE_CAPACITY_BONUS: 'DEFENSE_CAPACITY_BONUS',
    RECOVER_CURRENT_DEFENSE: 'RECOVER_CURRENT_DEFENSE'
});

export const SPECIAL_BLOCK_DEVELOPMENT_RESOURCES = Object.freeze([
    'food',
    'wood',
    'mystic'
]);

const ZERO_YIELDS = Object.freeze({
    food: 0,
    wood: 0,
    defense: 0,
    mystic: 0
});

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function validAmount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function canonicalizeDevelopmentOptionIds(optionIds) {
    if (!Array.isArray(optionIds)) return null;
    const normalized = optionIds.map(value => String(value || '').trim()).filter(Boolean);
    return Object.freeze([...normalized].sort((a, b) => a.localeCompare(b)));
}

export function validateDevelopmentSelection(definition, optionIds) {
    if (!definition?.id || !definition?.selection || !definition?.options) {
        return { valid: false, reason: 'DEVELOPMENT_DEFINITION_INVALID' };
    }
    const canonical = canonicalizeDevelopmentOptionIds(optionIds);
    if (!canonical) return { valid: false, reason: 'DEVELOPMENT_OPTIONS_REQUIRED' };

    const exactCount = Number(definition.selection.exactCount);
    if (Number.isInteger(exactCount) && canonical.length !== exactCount) {
        return { valid: false, reason: 'DEVELOPMENT_OPTION_COUNT_MISMATCH', optionIds: canonical };
    }
    if (definition.selection.distinct === true && new Set(canonical).size !== canonical.length) {
        return { valid: false, reason: 'DEVELOPMENT_OPTIONS_MUST_BE_DISTINCT', optionIds: canonical };
    }
    for (const optionId of canonical) {
        if (!definition.options[optionId]) {
            return { valid: false, reason: 'DEVELOPMENT_OPTION_UNKNOWN', optionId, optionIds: canonical };
        }
    }
    return { valid: true, reason: null, optionIds: canonical };
}

function normalizeEffect(effect, sourceOptionId) {
    if (!effect || typeof effect !== 'object' || !effect.kind) return null;
    const normalized = { ...clone(effect, {}), sourceOptionId };
    const amount = Number(normalized.amount);
    if (!validAmount(amount)) return null;
    normalized.amount = amount;

    if (normalized.kind === SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.YIELD_BONUS) {
        if (!SPECIAL_BLOCK_DEVELOPMENT_RESOURCES.includes(normalized.resource)) return null;
    } else if (
        normalized.kind !== SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.DEFENSE_CAPACITY_BONUS
        && normalized.kind !== SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.RECOVER_CURRENT_DEFENSE
    ) {
        return null;
    }
    return Object.freeze(normalized);
}

export function resolveDevelopmentEffects(definition, optionIds) {
    const selection = validateDevelopmentSelection(definition, optionIds);
    if (!selection.valid) return { ...selection, persistentEffects: [], onApplyEffects: [] };

    const persistentEffects = [];
    const onApplyEffects = [];
    for (const optionId of selection.optionIds) {
        const option = definition.options[optionId];
        for (const raw of option.persistentEffects || []) {
            const effect = normalizeEffect(raw, optionId);
            if (!effect) return { valid: false, reason: 'DEVELOPMENT_EFFECT_INVALID', optionId };
            persistentEffects.push(effect);
        }
        for (const raw of option.onApplyEffects || []) {
            const effect = normalizeEffect(raw, optionId);
            if (!effect) return { valid: false, reason: 'DEVELOPMENT_EFFECT_INVALID', optionId };
            onApplyEffects.push(effect);
        }
    }
    return {
        valid: true,
        reason: null,
        optionIds: selection.optionIds,
        persistentEffects: Object.freeze(persistentEffects),
        onApplyEffects: Object.freeze(onApplyEffects)
    };
}

export function readInstanceDevelopmentLayer(instance, layer) {
    if (!instance || !layer || !instance.consistent) return null;
    return instance.entity?.developments?.[layer] || null;
}

export function validateDevelopmentTarget(instance, definition) {
    if (!instance) return { valid: false, reason: 'SPECIAL_BLOCK_INSTANCE_REQUIRED' };
    if (!instance.consistent) {
        return {
            valid: false,
            reason: 'SPECIAL_BLOCK_INSTANCE_INCONSISTENT',
            issues: [...(instance.issues || [])]
        };
    }
    if (!definition?.id || !definition.layer) {
        return { valid: false, reason: 'DEVELOPMENT_DEFINITION_INVALID' };
    }

    const requirements = definition.targetRequirements || {};
    if (requirements.functional === true && instance.functional !== true) {
        return { valid: false, reason: 'SPECIAL_BLOCK_NOT_FUNCTIONAL' };
    }

    const specialDefinition = getSpecialBlockDefinition(instance.definitionId);
    if (!specialDefinition) {
        return { valid: false, reason: 'SPECIAL_BLOCK_DEFINITION_MISSING' };
    }

    if (
        requirements.excludeTrialCausality === true
        && readSpecialBlockTrialCausality(specialDefinition).participates === true
    ) {
        return { valid: false, reason: 'TACTICAL_SPECIAL_BLOCK_EXCLUDED' };
    }

    if (
        requirements.requireVacantLayer === true
        && readInstanceDevelopmentLayer(instance, definition.layer)
    ) {
        return { valid: false, reason: 'DEVELOPMENT_LAYER_OCCUPIED' };
    }

    return { valid: true, reason: null, specialBlockDefinition: specialDefinition };
}

export function resolveDevelopmentModifiersFromEntity(entity) {
    const total = {
        yields: { ...ZERO_YIELDS },
        defenseCapacityBonus: 0,
        unresolvedEffects: []
    };
    const developments = entity?.developments;
    if (!developments || typeof developments !== 'object') return total;

    for (const layer of Object.keys(developments).sort((a, b) => a.localeCompare(b))) {
        const record = developments[layer];
        for (const effect of record?.effects || []) {
            const amount = Number(effect?.amount);
            if (!Number.isFinite(amount) || amount < 0) {
                total.unresolvedEffects.push({ layer, effect: clone(effect, {}) });
                continue;
            }
            if (
                effect.kind === SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.YIELD_BONUS
                && SPECIAL_BLOCK_DEVELOPMENT_RESOURCES.includes(effect.resource)
            ) {
                total.yields[effect.resource] += amount;
                continue;
            }
            if (effect.kind === SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.DEFENSE_CAPACITY_BONUS) {
                total.defenseCapacityBonus += amount;
                continue;
            }
            total.unresolvedEffects.push({ layer, effect: clone(effect, {}) });
        }
    }
    return total;
}

export function resolveSpecialBlockDevelopmentModifiers(state, target) {
    const instance = resolveSpecialBlockInstance(state, target);
    if (!instance) {
        return {
            instanceId: null,
            active: false,
            yields: { ...ZERO_YIELDS },
            defenseCapacityBonus: 0,
            unresolvedEffects: []
        };
    }
    if (!instance.functional || !instance.consistent) {
        return {
            instanceId: instance.instanceId,
            active: false,
            yields: { ...ZERO_YIELDS },
            defenseCapacityBonus: 0,
            unresolvedEffects: []
        };
    }
    return {
        instanceId: instance.instanceId,
        active: true,
        ...resolveDevelopmentModifiersFromEntity(instance.entity)
    };
}

export function sumSpecialBlockDevelopmentModifiers(state) {
    const total = {
        yields: { ...ZERO_YIELDS },
        defenseCapacityBonus: 0,
        unresolved: []
    };
    for (const instance of enumerateSpecialBlockInstances(state)) {
        if (!instance.functional || !instance.consistent) continue;
        const resolved = resolveDevelopmentModifiersFromEntity(instance.entity);
        total.yields.food += resolved.yields.food;
        total.yields.wood += resolved.yields.wood;
        total.yields.mystic += resolved.yields.mystic;
        total.defenseCapacityBonus += resolved.defenseCapacityBonus;
        for (const effect of resolved.unresolvedEffects || []) {
            total.unresolved.push({ instanceId: instance.instanceId, ...clone(effect, {}) });
        }
    }
    return total;
}
