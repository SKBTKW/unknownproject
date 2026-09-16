import { TrialEnemyAdvanceService } from "../systems/trial_enemy_advance_service.js";
import { TrialHqArrivalAggregationService } from "../systems/trial_hq_arrival_aggregation_service.js";
import {
    TRIAL_BATTLE_STATUSES,
    TRIAL_OUTCOMES,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../domain/trial_types.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createState(outcome) {
    return {
        planActivated: true,
        currentBattleIndex: 0,
        routes: [{
            id: "R1",
            cells: [
                { r: 0, c: 0 },
                { r: 0, c: 1 },
                { r: 0, c: 2 },
                { r: 0, c: 3 },
                { r: 0, c: 4 }
            ]
        }],
        interceptionPlan: {
            routes: [{
                routeId: "R1",
                status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT
            }]
        },
        battleQueue: [{
            routeId: "R1",
            interceptCell: { r: 0, c: 1 },
            status: TRIAL_BATTLE_STATUSES.RESOLVED,
            sequenceAdvanced: true,
            traversalApplied: false
        }],
        battleResults: [{
            outcome,
            remainingSuppression: outcome === TRIAL_OUTCOMES.REPEL ? 0 : 17
        }],
        traversalResults: [],
        routeProgress: {}
    };
}

const advanceService = new TrialEnemyAdvanceService();
const aggregationService = new TrialHqArrivalAggregationService();

const breakthroughState = createState(TRIAL_OUTCOMES.BREAKTHROUGH);
const breakthrough = advanceService.advanceAfterBattle(breakthroughState);
assert(breakthrough.success, "BREAKTHROUGH traversal must resolve");
assert(breakthrough.traversalResult.fromIndex === 1, "BREAKTHROUGH must start at intercept");
assert(breakthrough.traversalResult.toIndex === 4, "BREAKTHROUGH survivors must continue to route end");
assert(breakthrough.traversalResult.advance === 3, "advance distance must cover every remaining segment");
assert(breakthrough.traversalResult.reachedRouteEnd === true, "BREAKTHROUGH must reach HQ");
assert(breakthroughState.routeProgress.R1.status === "REACHED_END", "route progress must expose HQ arrival");

const breakthroughArrivals = aggregationService.collect(breakthroughState);
assert(breakthroughArrivals.success, "completed BREAKTHROUGH route must be aggregatable");
assert(breakthroughArrivals.arrivals.length === 1, "BREAKTHROUGH must contribute one HQ arrival");
assert(breakthroughArrivals.arrivals[0].sourcePower === 17, "HQ arrival must preserve residual suppression");

const repelState = createState(TRIAL_OUTCOMES.REPEL);
const repel = advanceService.advanceAfterBattle(repelState);
assert(repel.success, "REPEL traversal must resolve");
assert(repel.traversalResult.stopped === true, "REPEL must stop at intercept");
assert(repel.traversalResult.reachedRouteEnd === false, "REPEL must not reach HQ");

const repelArrivals = aggregationService.collect(repelState);
assert(repelArrivals.success, "stopped REPEL route must count as fully resolved");
assert(repelArrivals.arrivals.length === 0, "REPEL must contribute zero HQ arrival");

const incompleteState = createState(TRIAL_OUTCOMES.BREAKTHROUGH);
incompleteState.traversalResults[0] = {
    routeId: "R1",
    stopped: false,
    advanced: true,
    reachedRouteEnd: false
};
incompleteState.battleQueue[0].traversalApplied = true;

const incomplete = aggregationService.collect(incompleteState);
assert(incomplete.success === false, "non-stopped mid-route traversal must remain unresolved");
assert(
    incomplete.unresolvedRouteIds.includes("R1"),
    "incomplete breakthrough route must block Trial completion"
);

console.log("PASS: BREAKTHROUGH continues to HQ, REPEL stops, incomplete traversal blocks completion");
