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
    return {
        trialIndex,
        threatRevision,
        directionHints: [...directionHints],
        scaleBand,
        physiqueTraits: [...physiqueTraits],
        equipmentTraits: [...equipmentTraits],
        movementTraits: [...movementTraits],
        terrainTraits: [...terrainTraits]
    };
}
