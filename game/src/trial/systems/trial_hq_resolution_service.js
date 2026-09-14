import { TRIAL_PLAN_REASONS, TRIAL_BATTLE_STATUSES, TRIAL_ROUTE_PLAN_STATUSES } from "../domain/trial_types.js";
import { TrialSkippedRouteResolutionService } from "./trial_skipped_route_resolution_service.js";
import { TrialHqArrivalAggregationService } from "./trial_hq_arrival_aggregation_service.js";
import { TrialHqDamageResolver } from "./trial_hq_damage_resolver.js";
import { InterceptionPowerResolver } from "./interception_power_resolver.js";

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}
function nonNegative(value) {
    return Math.max(0, Number(value) || 0);
}

export class TrialHqResolutionService {
    constructor({
        powerResolver = new InterceptionPowerResolver(),
        skippedRouteService = null,
        aggregationService = new TrialHqArrivalAggregationService(),
        damageResolver = new TrialHqDamageResolver()
    } = {}) {
        this.powerResolver = powerResolver;
        this.skippedRouteService = skippedRouteService || new TrialSkippedRouteResolutionService({ powerResolver });
        this.aggregationService = aggregationService;
        this.damageResolver = damageResolver;
    }

    canResolve(state) {
        if (!state?.planActivated || !state?.interceptionPlan || state.currentBattleIndex !== null) {
            return false;
        }
        if (!Array.isArray(state.battleQueue)) return false;
        const interceptCount = Array.isArray(state.interceptionPlan.routes)
            ? state.interceptionPlan.routes.filter(r => r?.status === TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT).length
            : 0;
        if (state.battleQueue.length !== interceptCount) return false;
        return state.battleQueue.every((battle, index) =>
            battle?.status === TRIAL_BATTLE_STATUSES.RESOLVED
            && battle.traversalApplied
            && battle.sequenceAdvanced
            && Boolean(state.traversalResults?.[index])
        );
    }

    resolve(state, { emberBefore = 20 } = {}) {
        if (!state) return { success: false, errors: ["TRIAL_NOT_STARTED"] };
        if (state.hqDamageResolution?.damageApplied) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.DAMAGE_ALREADY_APPLIED] };
        }
        if (!this.canResolve(state)) {
            return { success: false, errors: [TRIAL_PLAN_REASONS.INCOMPLETE_BATTLES] };
        }

        const skipped = this.skippedRouteService.resolvePending(state);
        if (!skipped.success) return skipped;

        const aggregation = this.aggregationService.collect(state);
        if (!aggregation.success) return aggregation;

        const sourcePower = nonNegative(aggregation.totalSourcePower);
        const before = nonNegative(emberBefore);
        const conversionRate = this.damageResolver.suppressionConversionRate || 5;
        const emberDamage = this.damageResolver.calculateDamage(sourcePower, conversionRate);
        const emberAfter = Math.max(0, before - emberDamage);

        const damageResult = {
            aggregate: true,
            arrivals: cloneData(aggregation.arrivals),
            routeEndCount: aggregation.arrivals.length,
            sourcePower,
            conversionRate,
            emberBefore: before,
            emberDamage,
            emberAfter,
            damageApplied: true
        };
        state.hqDamageResolution = cloneData(damageResult);

        return {
            success: true,
            skippedRouteResults: cloneData(skipped.traversalResults),
            damageResult: cloneData(damageResult)
        };
    }
}

export default TrialHqResolutionService;
