import assert from "node:assert/strict";
import { createBattleContext } from "../domain/battle_context.js";
import { TrialCombatResolver } from "../systems/trial_combat_resolver.js";
import { TrialEnemyAdvanceService } from "../systems/trial_enemy_advance_service.js";
import { TrialHqArrivalAggregationService } from "../systems/trial_hq_arrival_aggregation_service.js";
import { TRIAL_BATTLE_STATUSES, TRIAL_ROUTE_PLAN_STATUSES } from "../domain/trial_types.js";

const neutralTerrainResolver = {
    resolve: () => ({
        canIntercept: true,
        canEnterApproachRoute: true,
        modifiers: [],
        events: []
    })
};
const combatResolver = new TrialCombatResolver({ terrainResolver: neutralTerrainResolver });
const advanceService = new TrialEnemyAdvanceService();
const aggregationService = new TrialHqArrivalAggregationService();

function combat({ humanPower, deployed = 45, reserve = 55 }) {
    return combatResolver.resolve(createBattleContext({
        interceptCell: { terrainId: "GL2_FOREST" },
        approachCell: { terrainId: "GL2_FOREST" },
        baseInterceptionPower: humanPower,
        allocatedDefense: 0,
        enemySuppression: deployed,
        enemyReserveSuppression: reserve
    }));
}

function stateFor(combatResult) {
    return {
        planActivated: true,
        currentBattleIndex: 0,
        interceptionPlan: {
            routes: [{
                routeId: "R1",
                status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
                interceptCell: { r: 0, c: 0 },
                defenseAllocation: 1
            }]
        },
        routes: [{
            id: "R1",
            cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]
        }],
        battleQueue: [{
            routeId: "R1",
            interceptCell: { r: 0, c: 0 },
            status: TRIAL_BATTLE_STATUSES.RESOLVED
        }],
        battleResults: [combatResult],
        traversalResults: []
    };
}

const breakthrough = combat({ humanPower: 20 });
assert.equal(breakthrough.remainingSuppression, 25);
assert.equal(breakthrough.reserveSuppression, 55);
assert.equal(breakthrough.remainingForceSuppression, 80);

const breakthroughState = stateFor(breakthrough);
const advanced = advanceService.advanceAfterBattle(breakthroughState);
assert.equal(advanced.success, true);
assert.equal(advanced.traversalResult.reachedRouteEnd, true);
assert.equal(advanced.traversalResult.remainingForceSuppression, 80);
breakthroughState.battleQueue[0].sequenceAdvanced = true;
const aggregated = aggregationService.collect(breakthroughState);
assert.equal(aggregated.success, true);
assert.equal(aggregated.totalSourcePower, 80);

const repelled = combat({ humanPower: 50 });
assert.equal(repelled.reserveSuppression, 55);
assert.equal(repelled.remainingForceSuppression, 55);

const repelledState = stateFor(repelled);
const stopped = advanceService.advanceAfterBattle(repelledState);
assert.equal(stopped.success, true);
assert.equal(stopped.traversalResult.stopped, true);
assert.equal(stopped.traversalResult.reachedRouteEnd, false);
assert.equal(stopped.traversalResult.remainingForceSuppression, 0);
repelledState.battleQueue[0].sequenceAdvanced = true;
const stoppedAggregation = aggregationService.collect(repelledState);
assert.equal(stoppedAggregation.success, true);
assert.equal(stoppedAggregation.totalSourcePower, 0);

console.log("diagnose_enemy_force_reserve_progression: PASS");
