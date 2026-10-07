/* =============================================================
   game/src/systems/special_block_development_service.js
   Board-owned mutation boundary for persistent Special Block Development.
   ============================================================= */

import { getSpecialBlockDevelopmentDefinition } from '../data/special_block_development_definitions.js';
import {
    resolveDevelopmentEffects,
    validateDevelopmentTarget
} from '../core/special_block_development_domain.js';
import {
    enumerateSpecialBlockInstances,
    resolveSpecialBlockInstance,
    snapshotSpecialBlockInstance
} from '../core/special_block_instance_read_model.js';

function clone(value, fallback = null) {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value));
}

function currentStageId(state) {
    const value = state?.stage?.id ?? state?.stage;
    const numeric = Number(value);
    return Number.isInteger(numeric) ? numeric : null;
}

export class SpecialBlockDevelopmentService {
    constructor({
        state,
        definitionResolver = getSpecialBlockDevelopmentDefinition
    } = {}) {
        this.state = state || null;
        this.definitionResolver = typeof definitionResolver === 'function'
            ? definitionResolver
            : getSpecialBlockDevelopmentDefinition;
    }

    resolveDefinition(id) {
        return this.definitionResolver(id);
    }

    enumerateEligibleTargets(developmentDefinitionId) {
        const definition = this.resolveDefinition(developmentDefinitionId);
        if (!definition) return [];
        return enumerateSpecialBlockInstances(this.state)
            .filter(instance => validateDevelopmentTarget(instance, definition).valid)
            .map(instance => Object.freeze({
                instanceId: instance.instanceId,
                definitionId: instance.definitionId,
                anchor: Object.freeze({ ...instance.anchor }),
                footprint: Object.freeze(instance.footprint.map(point => Object.freeze({ ...point })))
            }));
    }

    previewDevelopment({
        instanceId,
        developmentDefinitionId,
        optionIds
    } = {}) {
        const definition = this.resolveDefinition(developmentDefinitionId);
        if (!definition) {
            return { success: false, reason: 'DEVELOPMENT_DEFINITION_NOT_FOUND' };
        }
        const instance = resolveSpecialBlockInstance(this.state, instanceId);
        const target = validateDevelopmentTarget(instance, definition);
        if (!target.valid) return { success: false, ...target };

        const effects = resolveDevelopmentEffects(definition, optionIds);
        if (!effects.valid) return { success: false, ...effects };

        return {
            success: true,
            instance: snapshotSpecialBlockInstance(instance),
            definition,
            optionIds: effects.optionIds,
            persistentEffects: effects.persistentEffects,
            onApplyEffects: effects.onApplyEffects
        };
    }

    applyDevelopment(request = {}, {
        onApplyEffectHandler = null
    } = {}) {
        const preview = this.previewDevelopment(request);
        if (!preview.success) return preview;

        const instance = resolveSpecialBlockInstance(this.state, request.instanceId);
        if (!instance) return { success: false, reason: 'SPECIAL_BLOCK_INSTANCE_REQUIRED' };

        const record = {
            id: `${instance.instanceId}#${preview.definition.layer}`,
            layer: preview.definition.layer,
            tier: Number(preview.definition.tier) || 1,
            definitionId: preview.definition.id,
            definitionVersion: Number(preview.definition.version) || 1,
            optionIds: [...preview.optionIds],
            effects: preview.persistentEffects.map(effect => clone(effect, {})),
            onApplyEffects: preview.onApplyEffects.map(effect => clone(effect, {})),
            appliedStage: currentStageId(this.state),
            appliedVerse: Number.isInteger(this.state?.turn) ? this.state.turn : null
        };

        const before = instance.cells.map(member => ({
            cell: member.cell,
            specialBlock: clone(member.cell.specialBlock, null)
        }));

        const rollback = () => {
            for (const snapshot of before) {
                snapshot.cell.specialBlock = clone(snapshot.specialBlock, null);
            }
        };

        try {
            for (const member of instance.cells) {
                const entity = member.cell.specialBlock;
                const developments = clone(entity?.developments, {}) || {};
                developments[preview.definition.layer] = clone(record, {});
                member.cell.specialBlock = {
                    ...entity,
                    developments
                };
            }

            if (record.onApplyEffects.length > 0) {
                if (typeof onApplyEffectHandler !== 'function') {
                    rollback();
                    return { success: false, reason: 'DEVELOPMENT_ON_APPLY_HANDLER_REQUIRED' };
                }
                const sideEffectResult = onApplyEffectHandler(
                    record.onApplyEffects.map(effect => clone(effect, {})),
                    Object.freeze({
                        instanceId: instance.instanceId,
                        developmentDefinitionId: preview.definition.id,
                        layer: preview.definition.layer
                    })
                );
                if (sideEffectResult?.success === false) {
                    rollback();
                    return {
                        success: false,
                        reason: sideEffectResult.reason || 'DEVELOPMENT_ON_APPLY_EFFECT_FAILED'
                    };
                }
            }

            return {
                success: true,
                instanceId: instance.instanceId,
                record: Object.freeze(clone(record, {}))
            };
        } catch (error) {
            rollback();
            return {
                success: false,
                reason: 'DEVELOPMENT_APPLY_EXCEPTION',
                error
            };
        }
    }
}

export default SpecialBlockDevelopmentService;
