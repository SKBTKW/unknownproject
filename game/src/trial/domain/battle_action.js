function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

export function createBattleAction({
    actionId = null,
    type = null,
    actor = null,
    target = null,
    location = null,
    timing = null,
    metadata = {},
    provenance = null,
    source = null
} = {}) {
    return Object.freeze({
        actionId,
        type,
        actor,
        target,
        location: cloneData(location),
        timing,
        metadata: cloneData(metadata) || {},
        provenance: cloneData(provenance ?? source)
    });
}

export function normalizeBattleActions(actions = []) {
    return Array.isArray(actions)
        ? actions.map((action, index) => createBattleAction({
            ...action,
            actionId: action?.actionId ?? `battle-action:${index}`
        }))
        : [];
}
