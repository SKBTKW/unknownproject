import {
    TRIAL_PLAN_REASONS,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../domain/trial_types.js";
import { InterceptionPowerResolver } from "./interception_power_resolver.js";

function cloneData(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizePower(value) {
    return Math.max(0, Number(value) || 0);
}

/**
 * Resolves the traversal meaning of a SKIP decision only.
 *
 * This service deliberately does NOT apply Ember/HQ damage. HQ arrivals from
 * every route must be aggregated before suppression is converted to Ember
 * damage. Keeping SKIP traversal separate prevents a skipped route from
 * accidentally reintroducing per-route damage conversion.
 */
export class TrialSkippedRouteResolutionService {
    constructor({ powerResolver = new InterceptionPowerResolver() } = {}) {
        this.powerResolver = powerResolver;
    }

    resolve(state, routeId) {
        if (!state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!state.planActivated || !state.interceptionPlan) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }

        const decision = Array.isArray(state.interceptionPlan.routes)
            ? state.interceptionPlan.routes.find(item => item?.routeId === routeId)
            : null;
        if (!decision || decision.status !== TRIAL_ROUTE_PLAN_STATUSES.SKIP) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_CONFIRMED_PLAN] };
        }

        const route = Array.isArray(state.routes)
            ? state.routes.find(item => (item?.id ?? item?.routeId) === routeId)
            : null;
        const cells = route?.cells || route?.path || [];
        if (!route || !Array.isArray(cells) || cells.length === 0) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INVALID_TRAVERSAL_ROUTE] };
        }

        if (!state.skippedRouteResults || typeof state.skippedRouteResults !== "object") {
            state.skippedRouteResults = {};
        }
        if (state.skippedRouteResults[routeId]) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.TRAVERSAL_ALREADY_APPLIED] };
        }

        const first = cells[0];
        const last = cells[cells.length - 1];
        const routeStrategicSuppression = Number(route.strategicSuppression);
        const sourcePower = Number.isFinite(routeStrategicSuppression) && routeStrategicSuppression >= 0
            ? this.powerResolver.resolveSuppression(routeStrategicSuppression)
            : normalizePower(
                route.suppression
                ?? route.enemySuppression
                ?? state.enemy?.totalSuppression
                ?? state.enemy?.strategicSuppression
            );

        const traversalResult = Object.freeze({
            routeId,
            planStatus: TRIAL_ROUTE_PLAN_STATUSES.SKIP,
            skipped: true,
            intercepted: false,
            sourcePower,
            fromIndex: 0,
            toIndex: cells.length - 1,
            fromCell: { r: first.r ?? first.row, c: first.c ?? first.column },
            toCell: { r: last.r ?? last.row, c: last.c ?? last.column },
            stopped: false,
            advanced: cells.length > 1,
            reachedRouteEnd: true,
            damageApplied: false
        });

        state.skippedRouteResults[routeId] = cloneData(traversalResult);
        if (!state.routeProgress) state.routeProgress = {};
        state.routeProgress[routeId] = {
            routeId,
            currentIndex: cells.length - 1,
            currentCell: cloneData(traversalResult.toCell),
            status: "REACHED_END",
            stopped: false,
            advanced: traversalResult.advanced,
            reachedRouteEnd: true,
            skipped: true
        };

        return {
            success: true,
            routeId,
            traversalResult: cloneData(traversalResult)
        };
    }

    resolvePending(state) {
        if (!state) {
            return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        }
        if (!state.planActivated || !state.interceptionPlan) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.PLAN_NOT_ACTIVATED] };
        }

        const decisions = Array.isArray(state.interceptionPlan.routes)
            ? state.interceptionPlan.routes
            : [];
        const routeIds = decisions
            .filter(item => item?.status === TRIAL_ROUTE_PLAN_STATUSES.SKIP)
            .map(item => item.routeId);

        const results = [];
        for (const routeId of routeIds) {
            if (state.skippedRouteResults?.[routeId]) continue;
            const resolved = this.resolve(state, routeId);
            if (!resolved.success) return resolved;
            results.push(resolved.traversalResult);
        }

        return {
            success: true,
            resolvedCount: results.length,
            traversalResults: cloneData(results)
        };
    }
}

export default TrialSkippedRouteResolutionService;
