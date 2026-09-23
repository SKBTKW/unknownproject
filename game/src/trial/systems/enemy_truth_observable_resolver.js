function cloneStringList(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(entry => typeof entry === "string" && entry.length > 0)
        .map(entry => entry);
}

function uniqueStrings(values) {
    return [...new Set(values.filter(value => typeof value === "string" && value.length > 0))];
}

const BODY_OBSERVATION_TAGS = Object.freeze({
    LARGE: "LARGE_BODY_PRESENT",
    MEDIUM: "MEDIUM_BODY_PRESENT",
    SMALL: "SMALL_BODY_PRESENT"
});

const EQUIPMENT_OBSERVATION_TAGS = Object.freeze({
    LIGHT: "LIGHT_EQUIPMENT",
    STANDARD: "STANDARD_EQUIPMENT",
    HEAVY: "HEAVY_EQUIPMENT"
});

function collectForceProfiles(armyStructure) {
    const forces = Array.isArray(armyStructure?.forces) ? armyStructure.forces : [];
    return forces
        .map(force => force?.profile)
        .filter(profile => profile && typeof profile === "object");
}

/**
 * Projects coarse, explicitly observable facts from Trial-owned army truth.
 *
 * This resolver lives on the Truth side of the observation boundary. It may
 * expose categorical body/equipment traits already present in force profiles,
 * but must never derive or publish exact suppression, force counts, routes,
 * ingress coordinates, schedules or commander internals.
 *
 * Other observable facets are preserved only when another Trial-owned source
 * has already marked them observable. Body/equipment facets are rebuilt from
 * the current army structure so stale composition traits do not survive a
 * Truth transition.
 */
export class EnemyTruthObservableResolver {
    resolve({ armyStructure = null, previousEnemyState = null } = {}) {
        const previous = previousEnemyState?.observable && typeof previousEnemyState.observable === "object"
            ? previousEnemyState.observable
            : {};
        const profiles = collectForceProfiles(armyStructure);

        const physiqueTraits = uniqueStrings(profiles.map(profile =>
            BODY_OBSERVATION_TAGS[profile.bodySize] || null
        ));

        const equipmentTraits = uniqueStrings(profiles.flatMap(profile =>
            Array.isArray(profile.equipment)
                ? profile.equipment.map(item => EQUIPMENT_OBSERVATION_TAGS[item] || null)
                : []
        ));

        return {
            scaleBand: typeof previous.scaleBand === "string" && previous.scaleBand.length > 0
                ? previous.scaleBand
                : null,
            directionHints: cloneStringList(previous.directionHints),
            physiqueTraits,
            equipmentTraits,
            movementTraits: cloneStringList(previous.movementTraits),
            terrainTraits: cloneStringList(previous.terrainTraits)
        };
    }
}

export default EnemyTruthObservableResolver;
