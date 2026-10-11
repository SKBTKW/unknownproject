/* =============================================================
   game/src/data/special_block_development_definitions.js
   Data-only Development definitions. Costs and card identity live elsewhere.
   ============================================================= */

import {
    SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS,
    SPECIAL_BLOCK_DEVELOPMENT_LAYERS
} from '../core/special_block_development_domain.js';

function freezeEffect(effect) {
    return Object.freeze({ ...effect });
}

function freezeOption(option) {
    return Object.freeze({
        ...option,
        persistentEffects: Object.freeze((option.persistentEffects || []).map(freezeEffect)),
        onApplyEffects: Object.freeze((option.onApplyEffects || []).map(freezeEffect))
    });
}

function freezeDefinition(definition) {
    const options = {};
    for (const [id, option] of Object.entries(definition.options || {})) {
        options[id] = freezeOption(option);
    }
    return Object.freeze({
        ...definition,
        targetRequirements: Object.freeze({ ...(definition.targetRequirements || {}) }),
        selection: Object.freeze({ ...(definition.selection || {}) }),
        options: Object.freeze(options)
    });
}

export const SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS = Object.freeze({
    BASIC_SITE_DEVELOPMENT: 'BASIC_SITE_DEVELOPMENT'
});

export const SPECIAL_BLOCK_DEVELOPMENT_DEFINITIONS = Object.freeze({
    [SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT]: freezeDefinition({
        id: SPECIAL_BLOCK_DEVELOPMENT_DEFINITION_IDS.BASIC_SITE_DEVELOPMENT,
        version: 1,
        layer: SPECIAL_BLOCK_DEVELOPMENT_LAYERS.BASIC,
        tier: 1,
        targetRequirements: {
            functional: true,
            excludeTrialCausality: true,
            requireVacantLayer: true
        },
        selection: {
            exactCount: 2,
            distinct: true
        },
        options: {
            FOOD_YIELD: {
                persistentEffects: [{
                    kind: SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.YIELD_BONUS,
                    resource: 'food',
                    amount: 2
                }]
            },
            MATERIAL_YIELD: {
                persistentEffects: [{
                    kind: SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.YIELD_BONUS,
                    resource: 'wood',
                    amount: 2
                }]
            },
            MYSTIC_YIELD: {
                persistentEffects: [{
                    kind: SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.YIELD_BONUS,
                    resource: 'mystic',
                    amount: 1
                }]
            },
            DEFENSE_CAPACITY: {
                persistentEffects: [{
                    kind: SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.DEFENSE_CAPACITY_BONUS,
                    amount: 1
                }],
                onApplyEffects: [{
                    kind: SPECIAL_BLOCK_DEVELOPMENT_EFFECT_KINDS.RECOVER_CURRENT_DEFENSE,
                    amount: 1
                }]
            }
        }
    })
});

export function getSpecialBlockDevelopmentDefinition(id) {
    return SPECIAL_BLOCK_DEVELOPMENT_DEFINITIONS[id] || null;
}
