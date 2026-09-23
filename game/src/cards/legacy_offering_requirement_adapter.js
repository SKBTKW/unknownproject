/* =============================================================
   game/src/cards/legacy_offering_requirement_adapter.js
   Incremental adapter from legacy req* fields to Offering requirements.
   It preserves existing ConditionEvaluator semantics while keeping new
   Card Definition v1 requirements independent from legacy field names.
   ============================================================= */

function push(requirements, condition, requirement) {
    if (condition) requirements.push(Object.freeze(requirement));
}

function adaptLegacyOfferingRequirements(card, { h2Count = 0 } = {}) {
    if (!card || typeof card !== "object") return Object.freeze([]);

    const requirements = [];

    push(requirements, card.reqE2HillsOnBoard !== undefined, {
        id: "LEGACY_REQ_E2_HILLS",
        type: "LEGACY_E2_HILLS_AT_LEAST",
        value: card.reqE2HillsOnBoard,
        actual: h2Count
    });

    push(requirements, Boolean(card.reqHillOrMountainAroundHQ), {
        id: "LEGACY_REQ_HILL_OR_MOUNTAIN_AROUND_HQ",
        type: "HAS_HILL_OR_MOUNTAIN_AROUND_HQ"
    });
    push(requirements, Boolean(card.reqNoHillOrMountainAroundHQ), {
        id: "LEGACY_REQ_NO_HILL_OR_MOUNTAIN_AROUND_HQ",
        type: "HAS_NO_HILL_OR_MOUNTAIN_AROUND_HQ"
    });
    push(requirements, Boolean(card.reqHillOrMountain), {
        id: "LEGACY_REQ_HILL_OR_MOUNTAIN",
        type: "HAS_HILL_OR_MOUNTAIN"
    });
    push(requirements, Boolean(card.reqWetlandOrLake), {
        id: "LEGACY_REQ_WETLAND_OR_LAKE",
        type: "HAS_WETLAND_OR_LAKE"
    });
    push(requirements, card.reqForest !== undefined, {
        id: "LEGACY_REQ_FOREST",
        type: "HAS_FOREST",
        value: card.reqForest
    });

    if (card.reqDiscoveredResourceTag) {
        requirements.push(Object.freeze({
            id: "LEGACY_REQ_DISCOVERED_RESOURCE_TAG",
            type: "SOCKET_FOUND",
            category: card.reqDiscoveredResourceTag
        }));
    }
    if (Array.isArray(card.reqDiscoveredResourceTags)) {
        for (const tag of card.reqDiscoveredResourceTags) {
            requirements.push(Object.freeze({
                id: "LEGACY_REQ_DISCOVERED_RESOURCE_TAG",
                type: "SOCKET_FOUND",
                category: tag
            }));
        }
    }

    push(requirements, card.reqDiscoveredResourcesCount !== undefined, {
        id: "LEGACY_REQ_DISCOVERED_RESOURCES_COUNT",
        type: "DISCOVERED_RESOURCES_COUNT",
        value: card.reqDiscoveredResourcesCount
    });
    push(requirements, card.reqDiscoveredMysticResourcesCount !== undefined, {
        id: "LEGACY_REQ_DISCOVERED_MYSTIC_RESOURCES_COUNT",
        type: "DISCOVERED_MYSTIC_RESOURCES_COUNT",
        value: card.reqDiscoveredMysticResourcesCount
    });
    push(requirements, card.reqConnectedPlains !== undefined, {
        id: "LEGACY_REQ_CONNECTED_PLAINS",
        type: "CONNECTED_TERRAIN_AT_LEAST",
        terrainType: "PLAINS",
        value: card.reqConnectedPlains
    });
    push(requirements, card.reqConnectedHillOrForest !== undefined, {
        id: "LEGACY_REQ_CONNECTED_HILL_OR_FOREST",
        type: "CONNECTED_TERRAIN_AT_LEAST",
        terrainType: "HILL_OR_FOREST",
        value: card.reqConnectedHillOrForest
    });
    push(requirements, card.reqForestOrHillForest !== undefined, {
        id: "LEGACY_REQ_FOREST_OR_HILL_FOREST",
        type: "HAS_FOREST_OR_HILL_FOREST",
        value: card.reqForestOrHillForest
    });
    push(requirements, card.reqWetland !== undefined, {
        id: "LEGACY_REQ_WETLAND",
        type: "HAS_WETLAND",
        value: card.reqWetland
    });
    push(requirements, card.reqEmptyCells !== undefined, {
        id: "LEGACY_REQ_EMPTY_CELLS",
        type: "EMPTY_CELLS_AT_LEAST",
        value: card.reqEmptyCells
    });
    push(requirements, Boolean(card.reqUnmergedDesertOrMountain), {
        id: "LEGACY_REQ_UNMERGED_DESERT_OR_MOUNTAIN",
        type: "LEGACY_BOARD_UNMERGED_DESERT_OR_MOUNTAIN"
    });
    push(requirements, Boolean(card.reqOutpostOrHighGround), {
        id: "LEGACY_REQ_OUTPOST_OR_HIGH_GROUND",
        type: "HAS_OUTPOST_OR_HIGH_GROUND"
    });
    push(requirements, card.maxPlacedBlocks !== undefined, {
        id: "LEGACY_MAX_PLACED_BLOCKS",
        type: "LEGACY_BOARD_PLACED_BLOCKS_AT_MOST",
        value: card.maxPlacedBlocks
    });

    push(requirements, Boolean(card.reqStage2End), {
        id: "LEGACY_REQ_STAGE2_END",
        type: "LEGACY_TURN_AT_LEAST",
        value: 20
    });
    push(requirements, card.maxMystic !== undefined, {
        id: "LEGACY_MAX_MYSTIC",
        type: "LEGACY_STATE_VALUE_AT_MOST",
        key: "mystic",
        value: card.maxMystic,
        onlyWhenDefined: true
    });
    push(requirements, card.maxFood !== undefined, {
        id: "LEGACY_MAX_FOOD",
        type: "LEGACY_STATE_VALUE_AT_MOST",
        key: "food",
        value: card.maxFood,
        onlyWhenDefined: true
    });
    push(requirements, card.maxEmber !== undefined, {
        id: "LEGACY_MAX_EMBER",
        type: "LEGACY_STATE_VALUE_AT_MOST",
        key: "ember",
        value: card.maxEmber,
        onlyWhenDefined: true
    });
    push(requirements, card.reqWood !== undefined, {
        id: "LEGACY_REQ_WOOD",
        type: "LEGACY_STATE_VALUE_AT_LEAST_RAW",
        key: "wood",
        value: card.reqWood
    });
    push(requirements, card.reqFood !== undefined, {
        id: "LEGACY_REQ_FOOD",
        type: "LEGACY_STATE_VALUE_AT_LEAST_RAW",
        key: "food",
        value: card.reqFood
    });
    push(requirements, card.reqMystic !== undefined, {
        id: "LEGACY_REQ_MYSTIC",
        type: "LEGACY_STATE_VALUE_AT_LEAST_ZERO_DEFAULT",
        key: "mystic",
        value: card.reqMystic
    });
    push(requirements, Boolean(card.reqTrialNotice), {
        id: "LEGACY_REQ_TRIAL_NOTICE",
        type: "LEGACY_TRIAL_NOTICE_ACTIVE"
    });
    push(requirements, card.reqTrialWithin !== undefined, {
        id: "LEGACY_REQ_TRIAL_WITHIN",
        type: "LEGACY_TRIAL_WITHIN",
        value: card.reqTrialWithin
    });
    push(requirements, Boolean(card.reqFoodDeficitOrFallback), {
        id: "LEGACY_REQ_FOOD_DEFICIT_OR_FALLBACK",
        type: "LEGACY_FOOD_DEFICIT_OR_FALLBACK"
    });
    push(requirements, Boolean(card.reqWoodDeficit), {
        id: "LEGACY_REQ_WOOD_DEFICIT",
        type: "LEGACY_WOOD_AT_MOST",
        value: 30
    });

    push(requirements, card.maxDefense !== undefined, {
        id: "LEGACY_MAX_DEFENSE",
        type: "LEGACY_BOARD_DEFENSE_AT_MOST",
        value: card.maxDefense
    });
    push(requirements, Boolean(card.reqTrialOrLowDefense), {
        id: "LEGACY_REQ_TRIAL_OR_LOW_DEFENSE",
        type: "LEGACY_TRIAL_OR_LOW_DEFENSE",
        value: 30
    });
    push(requirements, Boolean(card.noSocketsOnBoard), {
        id: "LEGACY_NO_SOCKETS_ON_BOARD",
        type: "LEGACY_BOARD_NO_SOCKETS"
    });
    push(requirements, card.reqPlains !== undefined, {
        id: "LEGACY_REQ_PLAINS",
        type: "LEGACY_BOARD_TERRAIN_COUNT_AT_LEAST",
        terrainFragment: "PLAINS",
        excludeHQ: true,
        value: card.reqPlains
    });
    push(requirements, card.id === "CMD_WETLAND_RECLAMATION", {
        id: "LEGACY_REQ_RECLAIMABLE_WETLAND",
        type: "LEGACY_BOARD_RECLAIMABLE_WETLAND"
    });
    push(requirements, card.reqForestNearby !== undefined, {
        id: "LEGACY_REQ_FOREST_NEARBY",
        type: "LEGACY_BOARD_TERRAIN_COUNT_AT_LEAST",
        terrainFragment: "FOREST",
        value: card.reqForestNearby
    });
    push(requirements, card.reqConnectedPlainsOrReclaimed !== undefined, {
        id: "LEGACY_REQ_PLAINS_OR_RECLAIMED",
        type: "LEGACY_BOARD_PLAINS_OR_RECLAIMED_AT_LEAST",
        value: card.reqConnectedPlainsOrReclaimed
    });
    push(requirements, Boolean(card.reqLoggingCamp), {
        id: "LEGACY_REQ_LOGGING_CAMP",
        type: "LEGACY_BOARD_LOGGING_CAMP_OR_FOREST"
    });
    push(requirements, card.reqHill !== undefined, {
        id: "LEGACY_REQ_HILL",
        type: "LEGACY_BOARD_TERRAIN_COUNT_AT_LEAST",
        terrainFragment: "HILL",
        value: card.reqHill
    });
    push(requirements, Boolean(card.reqOreSocket), {
        id: "LEGACY_REQ_ORE_SOCKET",
        type: "LEGACY_BOARD_ORE_SOCKET"
    });
    push(requirements, Boolean(card.reqWaterSource), {
        id: "LEGACY_REQ_WATER_SOURCE",
        type: "LEGACY_BOARD_WATER_SOURCE"
    });
    push(requirements, Boolean(card.reqPlainsMerge2x2), {
        id: "LEGACY_REQ_PLAINS_MERGE",
        type: "LEGACY_BOARD_PLAINS_MERGE"
    });
    push(requirements, Boolean(card.reqLargeTerritory), {
        id: "LEGACY_REQ_LARGE_TERRITORY",
        type: "LEGACY_BOARD_TERRITORY_AT_LEAST",
        value: 10
    });

    return Object.freeze(requirements);
}

function evaluateLegacyOfferingRequirement(requirement, { state, boardQuery } = {}, conditionEvaluator) {
    if (!requirement) return true;

    if (requirement.type === "LEGACY_E2_HILLS_AT_LEAST") {
        return Number(requirement.actual || 0) >= Number(requirement.value || 0);
    }

    // Legacy DeckManager guarded board/world checks with "&& this.state".
    // Preserve that compatibility for synthetic callers without a live state.
    if (!state) return true;

    const legacyGridUnavailable = !state.grid && boardQuery?.isLegacyStateBacked === true;

    if (requirement.type === "HAS_HILL_OR_MOUNTAIN_AROUND_HQ") {
        return Boolean(conditionEvaluator?.checkHillOrMountainAroundHQ?.(state));
    }
    if (requirement.type === "HAS_NO_HILL_OR_MOUNTAIN_AROUND_HQ") {
        return Boolean(conditionEvaluator?.checkNoHillOrMountainAroundHQ?.(state));
    }
    if (requirement.type === "LEGACY_TURN_AT_LEAST") {
        return !(state.turn < requirement.value);
    }
    if (requirement.type === "LEGACY_STATE_VALUE_AT_MOST") {
        if (requirement.onlyWhenDefined && state[requirement.key] === undefined) return true;
        return !(state[requirement.key] > requirement.value);
    }
    if (requirement.type === "LEGACY_STATE_VALUE_AT_LEAST_RAW") {
        return !(state[requirement.key] < requirement.value);
    }
    if (requirement.type === "LEGACY_STATE_VALUE_AT_LEAST_ZERO_DEFAULT") {
        return (state[requirement.key] || 0) >= requirement.value;
    }
    if (requirement.type === "LEGACY_TRIAL_NOTICE_ACTIVE") {
        const notice = typeof state.getTrialNotice === "function"
            ? state.getTrialNotice()
            : { active: false };
        const nextTrialTurn = state.nextTrialTurn || 20;
        const currentTurn = state.turn || 1;
        return Boolean((notice && notice.active) || (nextTrialTurn - currentTurn <= 5));
    }
    if (requirement.type === "LEGACY_TRIAL_WITHIN") {
        const nextTrialTurn = state.nextTrialTurn || 20;
        const currentTurn = state.turn || 1;
        return (nextTrialTurn - currentTurn) <= requirement.value;
    }
    if (requirement.type === "LEGACY_FOOD_DEFICIT_OR_FALLBACK") {
        const currentFood = state.food || 0;
        const upkeep = typeof state.getFoodUpkeep === "function" ? state.getFoodUpkeep() : 20;
        return currentFood < upkeep || currentFood <= 40;
    }
    if (requirement.type === "LEGACY_WOOD_AT_MOST") {
        return !((state.wood || 0) > requirement.value);
    }

    if (requirement.type === "LEGACY_BOARD_UNMERGED_DESERT_OR_MOUNTAIN") {
        const conditionPass = Boolean(conditionEvaluator?.evaluate?.(
            { type: "HAS_UNMERGED_DESERT_OR_MOUNTAIN" },
            { state }
        ));
        if (!conditionPass) return false;
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Boolean(boardQuery?.hasUnmergedDesertOrMountain?.());
    }
    if (requirement.type === "LEGACY_BOARD_PLACED_BLOCKS_AT_MOST") {
        const conditionPass = Boolean(conditionEvaluator?.evaluate?.(
            { type: "PLACED_BLOCKS_AT_MOST", value: requirement.value },
            { state }
        ));
        if (!conditionPass) return false;
        if (typeof state?.countPlacedTiles !== "function") return true;
        if (!boardQuery || typeof boardQuery.countPlacedBlocks !== "function") return true;
        return !(boardQuery.countPlacedBlocks() > requirement.value);
    }
    if (requirement.type === "LEGACY_BOARD_DEFENSE_AT_MOST") {
        if (!boardQuery || typeof boardQuery.totalDefense !== "function") return true;
        return !(boardQuery.totalDefense() > requirement.value);
    }
    if (requirement.type === "LEGACY_TRIAL_OR_LOW_DEFENSE") {
        if (!state) return true;
        const notice = typeof state.getTrialNotice === "function"
            ? state.getTrialNotice()
            : { active: false };
        if (notice?.active) return true;
        if (!boardQuery || typeof boardQuery.currentDefense !== "function") return true;
        return !(boardQuery.currentDefense() > requirement.value);
    }
    if (requirement.type === "LEGACY_BOARD_NO_SOCKETS") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return !Boolean(boardQuery?.hasAnySocket?.());
    }
    if (requirement.type === "LEGACY_BOARD_TERRAIN_COUNT_AT_LEAST") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        const count = boardQuery?.countTerrainContaining?.(
            requirement.terrainFragment,
            { excludeHQ: Boolean(requirement.excludeHQ) }
        );
        return Number(count || 0) >= Number(requirement.value || 0);
    }
    if (requirement.type === "LEGACY_BOARD_RECLAIMABLE_WETLAND") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Boolean(boardQuery?.hasReclaimableWetland?.());
    }
    if (requirement.type === "LEGACY_BOARD_PLAINS_OR_RECLAIMED_AT_LEAST") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Number(boardQuery?.countPlainsOrReclaimed?.() || 0) >= Number(requirement.value || 0);
    }
    if (requirement.type === "LEGACY_BOARD_LOGGING_CAMP_OR_FOREST") {
        if (!state && !boardQuery) return true;
        return Boolean(boardQuery?.hasLoggingCampOrForest?.());
    }
    if (requirement.type === "LEGACY_BOARD_ORE_SOCKET") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Boolean(boardQuery?.hasOreSocket?.());
    }
    if (requirement.type === "LEGACY_BOARD_WATER_SOURCE") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Boolean(boardQuery?.hasWaterSource?.());
    }
    if (requirement.type === "LEGACY_BOARD_PLAINS_MERGE") {
        if (!state && !boardQuery) return true;
        return Boolean(boardQuery?.hasPlainsMerge?.());
    }
    if (requirement.type === "LEGACY_BOARD_TERRITORY_AT_LEAST") {
        if ((!state?.grid && !boardQuery) || legacyGridUnavailable) return true;
        return Number(boardQuery?.countTerritoryTiles?.() || 0) >= Number(requirement.value || 0);
    }

    return Boolean(conditionEvaluator?.evaluate?.(requirement, { state }));
}

function evaluateLegacyOfferingRequirements(card, context = {}, conditionEvaluator) {
    const requirements = adaptLegacyOfferingRequirements(card, context);
    for (const requirement of requirements) {
        if (!evaluateLegacyOfferingRequirement(requirement, context, conditionEvaluator)) {
            return Object.freeze({
                eligible: false,
                reason: requirement.id || requirement.type,
                requirement
            });
        }
    }
    return Object.freeze({ eligible: true, reason: null, requirement: null });
}

export {
    adaptLegacyOfferingRequirements,
    evaluateLegacyOfferingRequirement,
    evaluateLegacyOfferingRequirements
};
