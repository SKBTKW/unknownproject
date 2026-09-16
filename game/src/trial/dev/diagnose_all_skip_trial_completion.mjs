import { TrialHqResolutionService } from "../systems/trial_hq_resolution_service.js";
import { TrialCompletionService } from "../systems/trial_completion_service.js";
import { TRIAL_ROUTE_PLAN_STATUSES } from "../domain/trial_types.js";
function assert(condition, message) { if (!condition) throw new Error(message); }
const state = {
    phase: "BATTLE", planActivated: true, trialCompleted: false, ember: 10, human: { ember: 10 }, enemy: { totalSuppression: 8 },
    routes: [
        { id: "R1", suppression: 3, cells: [{ r: 0, c: 0 }, { r: 1, c: 0 }] },
        { id: "R2", suppression: 4, cells: [{ r: 0, c: 1 }, { r: 1, c: 1 }] }
    ],
    interceptionPlan: { routes: [
        { routeId: "R1", status: TRIAL_ROUTE_PLAN_STATUSES.SKIP },
        { routeId: "R2", status: TRIAL_ROUTE_PLAN_STATUSES.SKIP }
    ] },
    battleQueue: [], currentBattleIndex: null, battleResults: null, traversalResults: null,
    routeProgress: {}, skippedRouteResults: {}, hqDamageResolution: null
};
const result = new TrialHqResolutionService().resolve(state, { emberBefore: 10 });
assert(result.success, "all-SKIP HQ resolution must succeed");
assert(result.damageResult.sourcePower === 7, "all skipped suppression must aggregate");
assert(result.damageResult.emberDamage === 2, "all-SKIP damage converts once");
assert(new TrialCompletionService().validateCompletion(state).success, "zero-battle all-SKIP Trial must complete");
console.log("PASS: all-SKIP Trial completes through aggregate HQ resolution");
