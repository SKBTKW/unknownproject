function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function freezeFlavor(event) {
    return Object.freeze({
        id: event.id ?? null,
        type: event.type ?? "BATTLE_FLAVOR",
        payload: Object.freeze(cloneData(event.payload || {})),
        gameplayImpact: false
    });
}

/**
 * Flavor is a presentation record only. v1 intentionally does not generate
 * random flavor from a gameplay RNG. Persisted snapshot flavor is replayed as-is.
 */
export class BattleFlavorResolver {
    resolve(snapshot) {
        const recorded = snapshot?.flavorEvents;
        if (!Array.isArray(recorded)) return Object.freeze([]);
        return Object.freeze(recorded
            .filter(event => event && typeof event === "object")
            .map(freezeFlavor));
    }
}

export default BattleFlavorResolver;
