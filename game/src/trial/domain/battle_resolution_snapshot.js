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
 * new snapshot with optional Opportunity/Fortune/Presentation fields populated
 * without mutating this instance or changing the causality resolvers.
 */
export function createBattleResolutionSnapshot({
    battleId = null,
    routeId = null,
    battlefieldContext = null,
    initialFacts = [],
    actions = [],
    causes = [],
    causalEvents = [],
    consequences = [],
    battleState = null,
    normalOutcome = null,
    opportunity = null,
    emberCommit = null,
    fortuneRoll = null,
    decisiveEvent = null,
    finalCombatResult = null,
    flavorEvents = [],
    presentationFacts = [],
    resolutionPhase = null,
    finalized = false
} = {}) {
    return deepFreeze({
        battleId,
        routeId,
        battlefieldContext: cloneData(battlefieldContext),
        initialFacts: normalizeList(initialFacts),
        actions: normalizeList(actions),
        causes: normalizeList(causes),
        causalEvents: normalizeList(causalEvents),
        consequences: normalizeList(consequences),
        battleState: cloneData(battleState),
        normalOutcome: cloneData(normalOutcome),
        opportunity: cloneData(opportunity),
        emberCommit: cloneData(emberCommit),
        fortuneRoll: cloneData(fortuneRoll),
        decisiveEvent: cloneData(decisiveEvent),
        finalCombatResult: cloneData(finalCombatResult),
        flavorEvents: normalizeList(flavorEvents),
        presentationFacts: normalizeList(presentationFacts),
        resolutionPhase,
        finalized: finalized === true
    });
}

const A_OWNED_SNAPSHOT_FIELDS = new Set([
    "battleId", "routeId", "battlefieldContext", "initialFacts", "actions",
    "causes", "causalEvents", "consequences", "battleState", "normalOutcome"
]);

const EVOLVABLE_SNAPSHOT_FIELDS = new Set([
    "opportunity", "emberCommit", "fortuneRoll", "decisiveEvent",
    "finalCombatResult", "flavorEvents", "presentationFacts",
    "resolutionPhase", "finalized"
]);

/**
 * Explicit copy-on-write evolution.
 * Causality/normal-outcome fields are A-owned once established.
 */
export function evolveBattleResolutionSnapshot(snapshot, patch = {}) {
    if (!snapshot || typeof snapshot !== "object") {
        throw new TypeError("BATTLE_RESOLUTION_SNAPSHOT_REQUIRED");
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        throw new TypeError("BATTLE_RESOLUTION_PATCH_REQUIRED");
    }
    for (const key of Object.keys(patch)) {
        if (A_OWNED_SNAPSHOT_FIELDS.has(key)) {
            throw new TypeError(`BATTLE_RESOLUTION_A_OWNED_FIELD_IMMUTABLE:${key}`);
        }
        if (!EVOLVABLE_SNAPSHOT_FIELDS.has(key)) {
            throw new TypeError(`BATTLE_RESOLUTION_EVOLVE_FIELD_NOT_ALLOWED:${key}`);
        }
    }
    return createBattleResolutionSnapshot({
        ...snapshot,
        ...cloneData(patch),
        battleId: snapshot.battleId ?? null,
        routeId: snapshot.routeId ?? null,
        battlefieldContext: snapshot.battlefieldContext,
        initialFacts: snapshot.initialFacts,
        actions: snapshot.actions,
        causes: snapshot.causes,
        causalEvents: snapshot.causalEvents,
        consequences: snapshot.consequences,
        battleState: snapshot.battleState,
        normalOutcome: snapshot.normalOutcome,
        flavorEvents: patch.flavorEvents ?? snapshot.flavorEvents,
        presentationFacts: patch.presentationFacts ?? snapshot.presentationFacts
    });
}

export { deepFreeze as freezeBattleResolutionData };
