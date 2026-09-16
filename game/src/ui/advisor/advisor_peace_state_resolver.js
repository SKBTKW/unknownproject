export const ADVISOR_TOPICS = Object.freeze({
    EMBER: "ember", SURVIVAL: "survival", LOGISTICS: "logistics", DEFENSE: "defense",
    CONNECTION: "connection", DEVELOPMENT: "development", ECONOMY: "economy",
    MYSTICISM: "mysticism", STABILITY: "stability"
});

export const ADVISOR_SEVERITY = Object.freeze({ NORMAL: 1, WARNING: 2, CRITICAL: 3 });

function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function countPlacedCells(grid = []) {
    return grid.reduce((total, row) => total + row.filter(cell => cell?.placed && !cell.isHQ).length, 0);
}

export function createAdvisorPeaceSnapshot(state = {}) {
    const zoneCount = Object.keys(state.mergedBlocks || {}).length;
    const linkedGroupIds = new Set();
    if (state.mergeLinks instanceof Set) state.mergeLinks.forEach(key => String(key).split("::").forEach(id => linkedGroupIds.add(id)));
    const maxEmber = Math.max(1, finite(state.maxEmber, 20));
    const foodCost = Math.max(0, finite(state.foodCost ?? state.lastTurnMaintenanceResult?.foodCost, 20));
    const food = Math.max(0, finite(state.food, 0));
    const stageSize = Math.max(1, finite(state.stage?.size, state.grid?.length || 5));
    return Object.freeze({
        turn: Math.max(1, finite(state.turn, 1)),
        emberRatio: finite(state.ember, 0) / maxEmber,
        foodRunway: foodCost > 0 ? food / foodCost : Number.POSITIVE_INFINITY,
        currentDefense: Math.max(0, finite(state.currentDefense ?? state.defense, 0)),
        maxDefense: Math.max(0, finite(state.maxDefense ?? state.defense, 0)),
        defenseReference: finite(state.nextTrialDefenseRequirement, 0),
        zoneCount,
        linkedZoneRatio: zoneCount > 0 ? linkedGroupIds.size / zoneCount : 0,
        boardOccupancy: countPlacedCells(state.grid) / Math.max(1, (stageSize * stageSize) - 1),
        activeGlobalEvents: (state.activeGlobalEvents || []).map(event => ({ id: event.definitionId || event.id, category: event.category || event.meta?.category || null }))
    });
}

export function resolveAdvisorPeaceStates(snapshot = {}) {
    const states = [];
    const add = (id, topic, severity = ADVISOR_SEVERITY.NORMAL) => states.push({ id, topic, severity });
    if (snapshot.emberRatio <= 0.25) add("EMBER_CRITICAL", ADVISOR_TOPICS.EMBER, ADVISOR_SEVERITY.CRITICAL);
    else if (snapshot.emberRatio <= 0.50) add("EMBER_WARNING", ADVISOR_TOPICS.EMBER, ADVISOR_SEVERITY.WARNING);
    if (snapshot.foodRunway < 1) add("FOOD_CRITICAL", ADVISOR_TOPICS.SURVIVAL, ADVISOR_SEVERITY.CRITICAL);
    else if (snapshot.foodRunway < 2) add("FOOD_WARNING", ADVISOR_TOPICS.LOGISTICS, ADVISOR_SEVERITY.WARNING);
    if (snapshot.defenseReference > 0) {
        const ratio = snapshot.currentDefense / snapshot.defenseReference;
        if (ratio < 0.40) add("DEFENSE_CRITICAL", ADVISOR_TOPICS.DEFENSE, ADVISOR_SEVERITY.CRITICAL);
        else if (ratio < 0.75) add("DEFENSE_WEAK", ADVISOR_TOPICS.DEFENSE, ADVISOR_SEVERITY.WARNING);
        else if (ratio >= 1.25) add("DEFENSE_HEALTHY", ADVISOR_TOPICS.DEFENSE);
    }
    if (snapshot.zoneCount >= 3) {
        if (snapshot.linkedZoneRatio < 0.25) add("BOARD_FRAGMENTED", ADVISOR_TOPICS.CONNECTION, ADVISOR_SEVERITY.WARNING);
        else if (snapshot.linkedZoneRatio >= 0.75) add("CONNECTION_HEALTHY", ADVISOR_TOPICS.CONNECTION);
    }
    if (snapshot.zoneCount === 3 || snapshot.zoneCount === 5 || snapshot.boardOccupancy >= 0.50) add("MAJOR_DEVELOPMENT", ADVISOR_TOPICS.DEVELOPMENT);
    if (!states.some(state => state.severity >= ADVISOR_SEVERITY.WARNING)) add("STABLE_OVERALL", ADVISOR_TOPICS.STABILITY);
    return states;
}
