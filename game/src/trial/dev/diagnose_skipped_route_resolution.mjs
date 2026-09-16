import { TrialSkippedRouteResolutionService } from "../systems/trial_skipped_route_resolution_service.js";
import { TRIAL_ROUTE_PLAN_STATUSES } from "../domain/trial_types.js";

const ok = (condition, label) => { if (!condition) throw new Error(label); };

const state = {
    planActivated: true,
    enemy: { totalSuppression: 99 },
    routes: [{ id: "R_SKIP", suppression: 6, cells: [
        { r: 0, c: 2 }, { r: 1, c: 2 }, { r: 2, c: 2 }, { r: 3, c: 2 }
    ] }],
    interceptionPlan: { routes: [{
        routeId: "R_SKIP", status: TRIAL_ROUTE_PLAN_STATUSES.SKIP, defenseAllocation: 0
    }] },
    routeProgress: {},
    skippedRouteResults: {}
};

const service = new TrialSkippedRouteResolutionService();
const first = service.resolve(state, "R_SKIP");
ok(first.success, "resolve");
ok(first.traversalResult.skipped === true, "semantic");
ok(first.traversalResult.reachedRouteEnd === true, "route end");
ok(first.traversalResult.sourcePower === 6, "route power");
ok(first.traversalResult.fromIndex === 0 && first.traversalResult.toIndex === 3, "range");
ok(first.traversalResult.damageApplied === false, "deferred conversion");
ok(state.routeProgress.R_SKIP.status === "REACHED_END", "progress");
ok(service.resolve(state, "R_SKIP").success === false, "duplicate guard");
ok(service.resolvePending(state).resolvedCount === 0, "pending guard");
console.log("Trial skipped route resolution contract: PASS");
