import { getSpecialBlockDefinition, isSpecialBlockFunctional } from './special_block_domain.js';

// Provisional balance values; capacity is derived, never accumulated by cards.
export const BASE_RESOURCE_STORAGE = Object.freeze({ food: 150, wood: 150 });

export function readResourceStorage(state) {
    const bonus = { food: 0, wood: 0 };
    for (const row of state?.grid || []) for (const cell of row || []) {
        const entity = cell?.specialBlock;
        if (!entity || !isSpecialBlockFunctional(entity)) continue;
        const definition = getSpecialBlockDefinition(entity.definitionId || entity.type);
        for (const key of Object.keys(bonus)) bonus[key] += definition?.storageCapacity?.[key] || 0;
    }
    return Object.freeze({ food: BASE_RESOURCE_STORAGE.food + bonus.food,
        wood: BASE_RESOURCE_STORAGE.wood + bonus.wood, bonus: Object.freeze(bonus) });
}

export function enforceResourceStorage(state) {
    if (!state) return null;
    const capacity = readResourceStorage(state);
    const overflow = { food: 0, wood: 0 };
    for (const key of ['food', 'wood']) {
        const amount = Number(key === 'wood' ? (state.wood ?? state.material) : state.food);
        if (!Number.isFinite(amount)) continue;
        overflow[key] = Math.max(0, amount - capacity[key]);
        state[key] = Math.min(amount, capacity[key]);
    }
    if (Number.isFinite(state.wood)) state.material = state.wood;
    return Object.freeze({ capacity, overflow: Object.freeze(overflow) });
}
