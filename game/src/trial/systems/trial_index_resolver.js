function normalizeTrialIndex(value) {
    return Math.max(1, Math.floor(Number(value) || 1));
}

/**
 * Shared Trial-index read boundary.
 *
 * New runtime code should prefer the timing authority because Trial progression
 * advances on actual settlement. `stage.id` remains a legacy fallback only
 * while old board-stage progression is still schedule-coupled.
 */
export function resolveCurrentTrialIndex({ timingAuthority = null, gameState = null } = {}) {
    const timingIndex = timingAuthority?.getCurrentTrialIndex?.();
    if (Number.isInteger(timingIndex) && timingIndex >= 1) {
        return timingIndex;
    }
    return normalizeTrialIndex(gameState?.stage?.id);
}

export function createCurrentTrialIndexResolver({ timingAuthority = null } = {}) {
    return gameState => resolveCurrentTrialIndex({ timingAuthority, gameState });
}

export default resolveCurrentTrialIndex;
