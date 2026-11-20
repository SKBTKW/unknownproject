import assert from "node:assert/strict";
import { Stage1TrialGameplayAuditResolver } from "../game/src/trial/dev/stage1_trial_gameplay_audit_resolver.js";
import {
    createDiagnosticSourceIdentity,
    diagnosticPolicies,
    runStage1GameplayFoundationAudit
} from "./diagnose_stage1_trial_gameplay_foundation.mjs";

const resolver = new Stage1TrialGameplayAuditResolver();
const development = {
    stage: 1,
    placedBlockCount: 9,
    territoryTiles: 11,
    completedZones: 0,
    links: 0
};
const comparison = resolver.compare({
    development,
    productionStrategicSuppression: 20,
    candidatePolicies: diagnosticPolicies,
    sourceIdentity: createDiagnosticSourceIdentity(20260923)
});

assert.equal(comparison.scope, "STAGE1_TRIAL_GAMEPLAY_DIAGNOSTIC_ONLY");
assert.deepEqual(comparison.production, {
    strategicSuppression: 20,
    participantCount: 1,
    routeCount: 1,
    policy: { mainForceWeight: 2, suppressionPerForce: 35, maxForces: 5 }
});
assert.deepEqual(comparison.legacy35PerForce.allocations, [20]);
assert.equal(comparison.candidates[0].strategicSuppression, 38);
assert.equal(comparison.candidates[0].participantPolicy.participantCount, 2);
assert.equal(comparison.candidates[0].sourceIdentityConsolidation.participantCount, 2);
assert.equal(comparison.candidates[0].conservation.sourceIdentityPreserved, true);
assert.equal(comparison.candidates[1].strategicSuppression, 31);
assert.equal(comparison.candidates[1].participantPolicy.participantCount, 2);
assert.ok(comparison.causalChain.every(edge => typeof edge.state === "string"));

const boundaryPolicy = [{
    ...diagnosticPolicies[0],
    id: "prototype-boundary-test",
    baseSuppression: 34,
    placedBlockWeight: 0
}];
assert.equal(resolver.compare({
    development: {}, productionStrategicSuppression: 20, candidatePolicies: boundaryPolicy
}).candidates[0].participantPolicy.participantCount, 1);
boundaryPolicy[0].baseSuppression = 35;
assert.equal(resolver.compare({
    development: {}, productionStrategicSuppression: 20, candidatePolicies: boundaryPolicy
}).candidates[0].participantPolicy.participantCount, 2);

assert.throws(() => resolver.compare({
    development,
    productionStrategicSuppression: 20,
    candidatePolicies: [{ ...diagnosticPolicies[0], appliesToProduction: true }]
}), /STAGE1_AUDIT_POLICY_BOUNDARY_INVALID/);

const report = runStage1GameplayFoundationAudit({ seeds: [20260923] });
assert.equal(report.productionMutation, false);
assert.deepEqual(report.samples.map(sample => sample.strategy), ["expansion", "concentration", "balanced"]);
assert.ok(report.samples.every(sample => sample.comparison.production.strategicSuppression === 20));
assert.ok(report.samples.every(sample => sample.board.interceptionCandidateCount > 0));
assert.ok(report.samples.every(sample => sample.comparison.candidates.every(candidate =>
    candidate.appliesToProduction === false && candidate.status === "PROTOTYPE"
)));

console.log("Stage1 Trial gameplay foundation audit v1: 17/17 assertions passed");
