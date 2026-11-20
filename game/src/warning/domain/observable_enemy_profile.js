export function createObservableEnemyProfile({
    trialIndex = null,
    threatRevision = null,
    directionHints = [],
    scaleBand = null,
    physiqueTraits = [],
    equipmentTraits = [],
    movementTraits = [],
    terrainTraits = []
} = {}) {
    const copyValues = values => values.map(value =>
        value && typeof value === 'object' ? structuredClone(value) : value
    );
    return {
        trialIndex,
        threatRevision,
        directionHints: copyValues(directionHints),
        scaleBand,
        physiqueTraits: copyValues(physiqueTraits),
        equipmentTraits: copyValues(equipmentTraits),
        movementTraits: copyValues(movementTraits),
        terrainTraits: copyValues(terrainTraits)
    };
}
