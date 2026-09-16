import { TrialHqResolutionService } from "../systems/trial_hq_resolution_service.js";
import { TrialCompletionService } from "../systems/trial_completion_service.js";
import { TRIAL_ROUTE_PLAN_STATUSES, TRIAL_BATTLE_STATUSES, TRIAL_OUTCOMES } from "../domain/trial_types.js";
function assert(condition, message) { if (!condition) throw new Error(message); }
const state = {
    phase: "BATTLE", planActivated: true, trialCompleted: false, ember: 10, human: { ember: 10 }, enemy: { totalSuppression: 20 },
    routes: [
        { id: "R_BREAK", suppression: 9, cells: [{ r: 0, c: 0 }, { r: 1, c: 0 }] },
        { id: "R_SKIP", suppression: 4, cells: [{ r: 0, c: 1 }, { r: 1, c: 1 }] }
    ],
    interceptionPlan: { routes: [
        { routeId: "R_BREAK", status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT },
        { routeId: "R_SKIP", status: TRIAL_ROUTE_PLAN_STATUSES.SKIP }
    ] },
    battleQueue: [{ routeId: "R_BREAK", status: TRIAL_BATTLE_STATUSES.RESOLVED, traversalApplied: true, sequenceAdvanced: true }],
    currentBattleIndex: null,
    battleResults: [{ routeId: "R_BREAK", enemyActualPower: 9, playerActualPower: 4, outcome: TRIAL_OUTCOMES.BREAKTHROUGH }],
    traversalResults: [{ battleIndex: 0, routeId: "R_BREAK", reachedRouteEnd: true }],
    routeProgress: {}, skippedRouteResults: {}, hqDamageResolution: null
};
const hq = new TrialHqResolutionService();
const result = hq.resolve(state, { emberBefore: 10 });
assert(result.success, "aggregate HQ resolution must succeed");
assert(state.skippedRouteResults.R_SKIP?.reachedRouteEnd, "SKIP traversal must resolve");
assert(result.damageResult.sourcePower === 9, "5 breakthrough + 4 SKIP must aggregate");
assert(result.damageResult.emberDamage === 2, "ceil(9 / 5) must happen once");
assert(result.damageResult.emberAfter === 8, "aggregate damage must use one Ember conversion");
assert(new TrialCompletionService().validateCompletion(state).success, "completion validation must pass");
assert(hq.resolve(state, { emberBefore: 8 }).success === false, "aggregate HQ damage cannot apply twice");
console.log("PASS: Trial HQ damage aggregates all route arrivals exactly once");
