import "./diagnose_trial_breakthrough_route_completion.mjs";
import "./diagnose_trial_reserved_card_retirement.mjs";
import { TrialHqArrivalAggregationService } from "../systems/trial_hq_arrival_aggregation_service.js";
import { TRIAL_ROUTE_PLAN_STATUSES, TRIAL_OUTCOMES } from "../domain/trial_types.js";
function assert(condition, message) { if (!condition) throw new Error(message); }
const state = {
    planActivated: true,
    interceptionPlan: { routes: [
        { routeId: "R_BREAK", status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT },
        { routeId: "R_REPEL", status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT },
        { routeId: "R_SKIP", status: TRIAL_ROUTE_PLAN_STATUSES.SKIP }
    ] },
    battleQueue: [
        { routeId: "R_BREAK", sequenceAdvanced: true },
        { routeId: "R_REPEL", sequenceAdvanced: true }
    ],
    traversalResults: [
        { routeId: "R_BREAK", outcome: TRIAL_OUTCOMES.BREAKTHROUGH, reachedRouteEnd: true },
        { routeId: "R_REPEL", outcome: TRIAL_OUTCOMES.REPEL, reachedRouteEnd: false }
    ],
    battleResults: [
        { enemyActualPower: 13, playerActualPower: 5 },
        { enemyActualPower: 5, playerActualPower: 10 }
    ],
    skippedRouteResults: { R_SKIP: { routeId: "R_SKIP", reachedRouteEnd: true, sourcePower: 4 } }
};
const result = new TrialHqArrivalAggregationService().collect(state);
assert(result.success, "all planned routes are resolved");
assert(result.arrivals.length === 2, "only HQ arrivals are aggregated");
assert(result.totalSourcePower === 12, "arrival power is summed before Ember conversion");
assert(!result.arrivals.some(item => item.routeId === "R_REPEL"), "repelled route contributes zero");
console.log("PASS: HQ arrivals aggregate before Ember conversion");
