/* =============================================================
   game/src/core/special_block_production.js
   Minimal production policy boundary for Special Blocks.
   It deliberately does not encode facility ids or invent unresolved numbers.
   ============================================================= */

import { getSpecialBlockDefinition } from './special_block_domain.js';
import { resolveSpecialBlockDamageEffect } from './board_damage_effect_policy.js';

export const SPECIAL_BLOCK_PRODUCTION_STATUS = Object.freeze({
    RESOLVED: 'RESOLVED',
    UNRESOLVED: 'UNRESOLVED',
    NONE: 'NONE'
});

const ZERO_YIELDS = Object.freeze({
    food: 0,
    wood: 0,
    defense: 0,
    mystic: 0
});

function normalizeYields(yields) {
    if (!yields || typeof yields !== 'object') return { ...ZERO_YIELDS };
    return {
        food: Number.isFinite(Number(yields.food)) ? Number(yields.food) : 0,
        wood: Number.isFinite(Number(yields.wood ?? yields.material))
            ? Number(yields.wood ?? yields.material)
            : 0,
        defense: Number.isFinite(Number(yields.defense)) ? Number(yields.defense) : 0,
        mystic: Number.isFinite(Number(yields.mystic)) ? Number(yields.mystic) : 0
    };
}

function addYields(total, yields) {
    total.food += yields.food;
    total.wood += yields.wood;
    total.defense += yields.defense;
    total.mystic += yields.mystic;
    return total;
}

export class SpecialBlockProductionResolver {
    constructor({ strategies = {} } = {}) {
        this.strategies = { ...strategies };
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

        const definition = getSpecialBlockDefinition(entity.definitionId || entity.type);
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

        if (production.kind === 'FIXED' && production.yields) {
            return {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: normalizeYields(production.yields),
                kind: production.kind,
                damageEffect: resolveSpecialBlockDamageEffect(cell)
            };
        }

        const strategy = this.strategies[production.kind];
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

        return {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: normalizeYields(resolved.yields),
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

export function resolveSpecialBlockProduction(state, cell, position = {}) {
    return defaultResolver.resolveCell(state, cell, position);
}

export function sumSpecialBlockProduction(state) {
    return defaultResolver.sum(state);
}

export { ZERO_YIELDS as SPECIAL_BLOCK_ZERO_YIELDS };
