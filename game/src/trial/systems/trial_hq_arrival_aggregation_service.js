import {
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../domain/trial_types.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

function residualFromBattleResult(result) {
    if (!result || typeof result !== "object") return null;
    if (typeof result.remainingForceSuppression === "number") {
        return nonNegative(result.remainingForceSuppression);
    }
    if (typeof result.enemy?.remainingForceSuppression === "number") {
        return nonNegative(result.enemy.remainingForceSuppression);
    }
    if (typeof result.remainingSuppression === "number") {
        return nonNegative(result.remainingSuppression);
    }
    const enemyPower = nonNegative(result.enemyActualPower ?? result.enemy?.finalPower);
    const humanPower = nonNegative(result.playerActualPower ?? result.human?.finalPower);
    return Math.max(0, enemyPower - humanPower);
}

export class TrialHqArrivalAggregationService {
    collect(state) {
        if (!state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        if (!state.planActivated || !state.interceptionPlan) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }

        const planRoutes = Array.isArray(state.interceptionPlan.routes)
            ? state.interceptionPlan.routes
            : [];
        const arrivals = [];
        const unresolvedRouteIds = [];

        for (const planRoute of planRoutes) {
            const routeId = planRoute?.routeId;
            if (!routeId) {
                unresolvedRouteIds.push(null);
                continue;
            }

            if (planRoute.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP) {
                const skipped = state.skippedRouteResults?.[routeId] || null;
                if (!skipped?.reachedRouteEnd) {
                    unresolvedRouteIds.push(routeId);
                    continue;
                }
                arrivals.push({
                    routeId,
                    sourceType: "SKIP",
                    battleIndex: null,
                    sourcePower: nonNegative(skipped.sourcePower),
                    reachedRouteEnd: true
                });
                continue;
            }

            if (planRoute.status !== TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT) {
                unresolvedRouteIds.push(routeId);
                continue;
            }

            const battleIndex = Array.isArray(state.battleQueue)
                ? state.battleQueue.findIndex(item => item?.routeId === routeId)
                : -1;
            if (battleIndex < 0) {
                unresolvedRouteIds.push(routeId);
                continue;
            }

            const battle = state.battleQueue[battleIndex];
            const traversal = Array.isArray(state.traversalResults)
                ? state.traversalResults[battleIndex]
                : null;
            if (!battle?.sequenceAdvanced || !traversal) {
                unresolvedRouteIds.push(routeId);
                continue;
            }

            if (!traversal.reachedRouteEnd) {
                if (traversal.stopped) continue;
                unresolvedRouteIds.push(routeId);
                continue;
            }

            const battleResult = Array.isArray(state.battleResults)
                ? state.battleResults[battleIndex]
                : null;
            const sourcePower = typeof traversal.remainingForceSuppression === "number"
                ? nonNegative(traversal.remainingForceSuppression)
                : residualFromBattleResult(battleResult);
            if (sourcePower === null) {
                unresolvedRouteIds.push(routeId);
                continue;
            }

            arrivals.push({
                routeId,
                sourceType: "INTERCEPT_BREAKTHROUGH",
                battleIndex,
                sourcePower,
                reachedRouteEnd: true
            });
        }

        const totalSourcePower = arrivals.reduce(
            (sum, arrival) => sum + nonNegative(arrival.sourcePower),
            0
        );

        return {
            success: unresolvedRouteIds.length === 0,
            errors: unresolvedRouteIds.length > 0 ? [TRIAL_PLAN_REASONS.INCOMPLETE_DAMAGE] : [],
            unresolvedRouteIds: cloneData(unresolvedRouteIds),
            arrivals: cloneData(arrivals),
            totalSourcePower
        };
    }
}

export default TrialHqArrivalAggregationService;
