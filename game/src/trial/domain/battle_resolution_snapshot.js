function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function normalizeList(value) {
    return Array.isArray(value) ? cloneData(value) : [];
}

/**
 * Stable semantic snapshot for one normal Trial battle resolution.
 *
 * A owns battlefieldContext through normalOutcome. Later stages may create a
 * new snapshot with the optional B/C fields populated without mutating this
 * instance or changing the causality resolvers.
 */
export function createBattleResolutionSnapshot({
    battleId = null,
    routeId = null,
    battlefieldContext = null,
    initialFacts = [],
    causes = [],
    causalEvents = [],
    normalOutcome = null,
    opportunity = null,
    emberCommit = null,
    fortuneRoll = null,
    decisiveEvent = null,
    finalCombatResult = null,
    flavorEvents = [],
    presentationFacts = []
} = {}) {
    return deepFreeze({
        battleId,
        routeId,
        battlefieldContext: cloneData(battlefieldContext),
        initialFacts: normalizeList(initialFacts),
        causes: normalizeList(causes),
        causalEvents: normalizeList(causalEvents),
        normalOutcome: cloneData(normalOutcome),
        opportunity: cloneData(opportunity),
        emberCommit: cloneData(emberCommit),
        fortuneRoll: cloneData(fortuneRoll),
        decisiveEvent: cloneData(decisiveEvent),
        finalCombatResult: cloneData(finalCombatResult),
        flavorEvents: normalizeList(flavorEvents),
        presentationFacts: normalizeList(presentationFacts)
    });
}

export { deepFreeze as freezeBattleResolutionData };
