import assert from "node:assert/strict";
import { runStage1ReserveRepelCausalityAdvancementAudit } from "./diagnose_stage1_reserve_repel_causality_advancement_v1.mjs";

const report = runStage1ReserveRepelCausalityAdvancementAudit();
const byId = Object.fromEntries(report.cases.map(row => [row.id, row]));
let assertionCount = 0;
const equal = (actual, expected) => {
    assertionCount += 1;
    assert.equal(actual, expected);
};
const deepEqual = (actual, expected) => {
    assertionCount += 1;
    assert.deepEqual(actual, expected);
};
const approx = (actual, expected) => {
    assertionCount += 1;
    assert.ok(Math.abs(actual - expected) < 1e-9);
};

equal(report.productionMutation, false);
equal(report.cases.length, 6);
equal(report.cases.every(row => row.fixtureClassification === "DEVELOPMENT_FIXED_INPUT"), true);

equal(byId.A.normalOutcome, "REPEL");
equal(byId.A.reserveCombatSuppression, 0);
equal(byId.A.routeStopped, true);
equal(byId.A.hqArrivalSuppression, 0);

approx(byId.B.deploymentRatio, 0.45);
approx(byId.B.deployedCombatSuppression, 45);
approx(byId.B.reserveCombatSuppression, 55);
approx(byId.B.terrainAdjustedCombatPower, 42.5);
equal(byId.B.normalOutcome, "REPEL");
approx(byId.B.remainingTotalForceSuppression, 55);
equal(byId.B.traversalSuppression, 0);
equal(byId.B.routeStopped, true);
equal(byId.B.reachedRouteEnd, false);
equal(byId.B.hqArrivalSuppression, 0);
equal(byId.B.facts.includes("ENEMY_RESERVE_PRESENT"), true);
equal(byId.B.causes.includes("ENEMY_RESERVE_HELD_BACK"), true);
equal(byId.B.consequences.includes("SUPPORT_DELAYED"), true);
equal(byId.B.battleState.withdrawal, "NONE");
equal(byId.B.snapshotFrozen, true);

approx(byId.C.deploymentRatio, 0.25);
approx(byId.C.reserveCombatSuppression, 75);
equal(byId.C.normalOutcome, "REPEL");
approx(byId.C.remainingTotalForceSuppression, 75);
equal(byId.C.traversalSuppression, 0);
equal(byId.C.hqArrivalSuppression, 0);

equal(byId.D.normalOutcome, "BREAKTHROUGH");
approx(byId.D.remainingDeployedSuppression, 22.5);
approx(byId.D.remainingTotalForceSuppression, 77.5);
approx(byId.D.traversalSuppression, 77.5);
equal(byId.D.routeStopped, false);
equal(byId.D.reachedRouteEnd, true);
approx(byId.D.hqArrivalSuppression, 77.5);

equal(byId.E_WITH_RESERVE.normalOutcome, "EXACT");
approx(byId.E_WITH_RESERVE.reserveCombatSuppression, 55);
approx(byId.E_WITH_RESERVE.traversalSuppression, 55);
equal(byId.E_WITH_RESERVE.reachedRouteEnd, true);
equal(byId.E_WITHOUT_RESERVE.normalOutcome, "EXACT");
equal(byId.E_WITHOUT_RESERVE.reserveCombatSuppression, 0);
equal(byId.E_WITHOUT_RESERVE.traversalSuppression, 0);
equal(byId.E_WITHOUT_RESERVE.reachedRouteEnd, true);

equal(report.multipleRoutes.routeCount, 2);
equal(report.multipleRoutes.routeStatesIndependent, true);
equal(report.multipleRoutes.arrivals.length, 1);
approx(report.multipleRoutes.hqArrivalSuppression, 77.5);

equal(report.saveRestore.activeTrialRestorePolicy, "RESTORE_TO_TRIAL_START_VERSE");
equal(report.saveRestore.redirectedRestoreVerse, 15);
equal(report.saveRestore.midBattleTrialStateSerialized, false);
equal(report.saveRestore.deterministicReplay, true);

equal(byId.B.snapshotSuppressionUnits.strategic, 20);
approx(byId.B.snapshotSuppressionUnits.deployed, 9);
approx(byId.B.snapshotSuppressionUnits.reserve, 11);
approx(byId.B.snapshotSuppressionUnits.combatRemainingForce, 55);
deepEqual(report.centralFinding, {
    localOutcome: "REPEL",
    combatReservePreserved: report.centralFinding.combatReservePreserved,
    combatRemainingForcePreserved: report.centralFinding.combatRemainingForcePreserved,
    traversalSuppression: 0,
    routeStopped: true,
    hqArrivalSuppression: 0
});
approx(report.centralFinding.combatReservePreserved, 55);
approx(report.centralFinding.combatRemainingForcePreserved, 55);

console.log(`Stage1 reserve / repel causality & advancement audit v1: ${assertionCount}/${assertionCount} assertions passed`);
