import { TRIAL_BATTLE_STATUSES } from '../trial/domain/trial_types.js';

function routeIdOf(route) {
    return route?.routeId ?? route?.id ?? null;
}

function getCurrentBattle(trialState) {
    if (!trialState) return null;
    if (typeof trialState.getCurrentBattle === 'function') {
        return trialState.getCurrentBattle();
    }
    const index = Number.isInteger(trialState.currentBattleIndex)
        ? trialState.currentBattleIndex
        : null;
    if (index === null || !Array.isArray(trialState.battleQueue)) return null;
    return trialState.battleQueue[index] || null;
}

function getNextPendingBattle(trialState) {
    if (!trialState?.planActivated || !Array.isArray(trialState.battleQueue)) return null;
    return trialState.battleQueue.find(battle => {
        const status = String(
            battle?.status || TRIAL_BATTLE_STATUSES.PENDING
        ).toUpperCase();
        return status === TRIAL_BATTLE_STATUSES.PENDING;
    }) || null;
}

export function isTrialRouteSelectionEnabled(trialState) {
    return Boolean(trialState && trialState.planActivated !== true);
}

/**
 * Presentation-only Trial route focus policy.
 *
 * Priority:
 * 1. Current battle route (ACTIVE or resolved-but-not-transitioned)
 * 2. Next pending battle route after plan activation
 * 3. Player-selected planning route
 * 4. First Trial route fallback
 *
 * This never mutates Trial state or battle ordering.
 */
export function resolveTrialPresentationRouteId({
    trialState = null,
    trialPresentationState = null
} = {}) {
    if (!trialState) return null;

    const currentBattleRouteId = routeIdOf(getCurrentBattle(trialState));
    if (currentBattleRouteId !== null) return currentBattleRouteId;

    const nextPendingRouteId = routeIdOf(getNextPendingBattle(trialState));
    if (nextPendingRouteId !== null) return nextPendingRouteId;

    const selectedRouteId = trialPresentationState?.activeEnemyRoute ?? null;
    if (selectedRouteId !== null) return selectedRouteId;

    return routeIdOf(trialState.routes?.[0]);
}

export default resolveTrialPresentationRouteId;
