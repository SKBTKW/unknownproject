import { TrialController } from "../flow/trial_controller.js";
import { EmberSystem } from "../../systems/ember_system.js";
import { TrialState } from "../domain/trial_state.js";
import { TRIAL_ROUTE_PLAN_STATUSES, TRIAL_BATTLE_STATUSES, TRIAL_OUTCOMES } from "../domain/trial_types.js";
function assert(condition, message) { if (!condition) throw new Error(message); }
const gameState = { turn: 21, ember: 1, maxEmber: 20 };
const engine = {};
const emberSystem = new EmberSystem(gameState, engine);
const controller = new TrialController({ emberSystem });
controller.state = Object.assign(new TrialState({ ember: 1, maxEmber: 20 }), {
    phase: "BATTLE", planActivated: true, trialCompleted: false, ember: 1, human: { ember: 1 }, enemy: { totalSuppression: 20 },
    routes: [{ id: "R_BREAK", suppression: 7, cells: [{ r: 0, c: 0 }, { r: 1, c: 0 }] }],
    interceptionPlan: { routes: [{ routeId: "R_BREAK", status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT }] },
    battleQueue: [{ routeId: "R_BREAK", status: TRIAL_BATTLE_STATUSES.RESOLVED, traversalApplied: true, sequenceAdvanced: true }],
    currentBattleIndex: null,
    battleResults: [{ routeId: "R_BREAK", enemyActualPower: 7, playerActualPower: 1, outcome: TRIAL_OUTCOMES.BREAKTHROUGH }],
    traversalResults: [{ battleIndex: 0, routeId: "R_BREAK", reachedRouteEnd: true }],
    routeProgress: {}, skippedRouteResults: {}, hqDamageResolution: null
});
const completion = controller.completeTrial();
assert(completion.success, "fatal Trial still completes its RESULT state");
assert(completion.result.outcome === "FAILED", "fatal Trial result must be FAILED");
assert(gameState.ember === 0, "fatal HQ damage must reach shared EmberSystem");
assert(completion.runTermination?.terminated === true, "fatal HQ damage must terminate the run");
assert(controller.isTrialCompleted(), "FAILED Trial result must remain presentable");
console.log("PASS: fatal aggregate HQ damage records FAILED Trial and terminates run");
