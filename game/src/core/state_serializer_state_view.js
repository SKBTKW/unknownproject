function clampInt(value, fallback = 0) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

export function createSerializerStateView(state) {
    if (!state || !state.defenseSystem || typeof state.defenseSystem.calculateMaxDefense !== 'function') return state;

    const fallbackMax = state.maxDefense !== undefined
        ? clampInt(state.maxDefense, 10)
        : clampInt(state.defense, 10);
    const maxDefense = clampInt(state.defenseSystem.calculateMaxDefense(), fallbackMax);
    const currentDefense = state.currentDefense === undefined || state.currentDefense === null
        ? maxDefense
        : Math.min(clampInt(state.currentDefense), maxDefense);

    const view = Object.create(state);
    Object.defineProperty(view, 'defenseSystem', {
        value: {
            reconcileWithMax() {
                return { currentDefense, maxDefense, clamped: currentDefense < clampInt(state.currentDefense) };
            }
        },
        enumerable: true,
        configurable: false,
        writable: false
    });
    return view;
}
