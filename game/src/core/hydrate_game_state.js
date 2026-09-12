/**
 * Pure inverse boundary for StateSerializer's world data. The caller owns
 * restoring subsystem runtime, both RNG streams, and Chronicle separately.
 */
const SCALAR_FIELDS = Object.freeze([
    "turn", "ember", "maxEmber", "food", "wood", "defense",
    "defenseCapacityBonus", "currentDefense", "maxDefense", "mystic",
    "hasPickedThisTurn", "hasReservedThisTurn", "hasMulliganedThisTurn",
    "mergeGroupCounter", "placementGroupCounter", "handOfferingSize",
    "nextTrialDamageMitigation", "nextTrialMultiplier", "nextTrialTurn",
    "placedBlockCount", "permanentPlainsFoodBonus", "permanentVicinityDefenseBonus",
    "emberConsumptionReducedTurns", "emberConsumptionStartsNextTurn",
    "vigilanceTurns", "vigilanceStartsNextTurn", "grandCultivationTurns",
    "grandCultivationStartsNextTurn", "systematicLoggingTurns",
    "systematicLoggingStartsNextTurn", "emergencyLevyTurns",
    "emergencyLevyStartsNextTurn", "manifestMiracleTurns",
    "manifestMiracleStartsNextTurn", "reserveFeeWaivedTurns",
    "reserveFeeWaivedStartsNextTurn", "temporaryDefense", "temporaryDefenseTurns"
]);
const OBJECT_FIELDS = Object.freeze([
    "trialSchedule", "activeConstructionProjects", "activeDrawBias",
    "cardCooldowns", "usedUniqueCards", "consumedUniqueCards", "mergedBlocks", "stage"
]);
const SET_FIELDS = Object.freeze(["mergeLinks", "grantedConnectionPairs"]);
const ALL_FIELDS = new Set([
    ...SCALAR_FIELDS, ...OBJECT_FIELDS, ...SET_FIELDS,
    "grid", "handOffering", "reserveSlots"
]);

function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function restoreCard(card, resolveCardMaster) {
    if (card === null) return null;
    if (!card || typeof card !== "object") throw new TypeError("HYDRATE_CARD_INVALID");
    if (card.isBlank) {
        return {
            isBlank: true,
            id: card.id,
            ...(Number.isInteger(card.originalHandIdx) ? { originalHandIdx: card.originalHandIdx } : {})
        };
    }
    if (!card.cardMasterId || typeof resolveCardMaster !== "function") {
        throw new TypeError("HYDRATE_CARD_MASTER_RESOLVER_REQUIRED");
    }
    const master = resolveCardMaster(card.cardMasterId);
    if (!master || master.id !== card.cardMasterId) {
        throw new Error(`HYDRATE_CARD_MASTER_NOT_FOUND:${card.cardMasterId}`);
    }
    const terrain = {
        ...cloneData(master),
        id: card.cardMasterId,
        terrainId: card.terrainId,
        nameKey: card.nameKey,
        category: card.category,
        rarity: card.rarity,
        cyclePolicy: card.cyclePolicy
    };
    return {
        id: card.id,
        cardMasterId: card.cardMasterId,
        terrain,
        currentShape: cloneData(card.currentShape),
        currentAnchor: cloneData(card.currentAnchor),
        ...(Number.isInteger(card.originalHandIdx) ? { originalHandIdx: card.originalHandIdx } : {}),
        reservedThisTurn: !!card.reservedThisTurn
    };
}

export function hydrateGameState(state, serialized, { resolveCardMaster } = {}) {
    if (!state || typeof state !== "object" || !serialized || typeof serialized !== "object") {
        throw new TypeError("HYDRATE_GAME_STATE_REQUIRED");
    }
    for (const field of Object.keys(serialized)) {
        if (!ALL_FIELDS.has(field)) throw new Error(`HYDRATE_UNKNOWN_FIELD:${field}`);
    }
    if (!Array.isArray(serialized.grid) || !Array.isArray(serialized.handOffering) ||
        !Array.isArray(serialized.reserveSlots) || !Array.isArray(serialized.mergeLinks) ||
        !Array.isArray(serialized.grantedConnectionPairs)) {
        throw new TypeError("HYDRATE_GAME_STATE_SHAPE_INVALID");
    }

    // Resolve and clone everything before mutating the existing live GameState.
    const values = {};
    for (const field of SCALAR_FIELDS) values[field] = cloneData(serialized[field]);
    for (const field of OBJECT_FIELDS) values[field] = cloneData(serialized[field]);
    values.grid = cloneData(serialized.grid);
    values.handOffering = serialized.handOffering.map(card => restoreCard(card, resolveCardMaster));
    values.reserveSlots = serialized.reserveSlots.map(card => restoreCard(card, resolveCardMaster));
    values.mergeLinks = new Set(serialized.mergeLinks);
    values.grantedConnectionPairs = new Set(serialized.grantedConnectionPairs);

    for (const [field, value] of Object.entries(values)) state[field] = value;
    state.material = state.wood;
    state.offeringCards = state.handOffering;
    return state;
}

export default hydrateGameState;
