import assert from "node:assert/strict";
import {
    COMPARISON_SEEDS,
    runStage1ThreatParticipationPolicyComparison,
    summarizeStage1ThreatParticipationPolicyComparison
} from "./diagnose_stage1_threat_participation_policy_comparison_v1.mjs";

const result = runStage1ThreatParticipationPolicyComparison();
assert.equal(COMPARISON_SEEDS.length, 8);
assert.equal(result.records.length, 3 * 3 * 8);
for (const record of result.records) {
    assert.equal(record.status, "PROTOTYPE");
    assert.equal(record.appliesToProduction, false);
    assert.equal(record.participants.length, record.participantCount);
    assert.equal(record.participants.flatMap(item => item.sourceForceIds).length, 3);
    assert.equal(new Set(record.participants.flatMap(item => item.sourceForceIds)).size, 3);
    assert.ok(Math.abs(record.participants.reduce(
        (sum, item) => sum + item.strategicSuppression, 0
    ) - record.strategicSuppression) < 1e-9);
    for (const outcome of record.outcomes) {
        assert.equal(outcome.attenuationCombatPower + outcome.remainingCombatPower,
            outcome.initialCombatPower);
        assert.equal(outcome.remainingStrategicEquivalent, outcome.remainingCombatPower / 5);
        assert.equal(outcome.emberDamage, Math.ceil(outcome.remainingCombatPower / 5));
    }
    const basic = record.outcomes.find(item => item.mode === "BASIC");
    const informed = record.outcomes.find(item => item.mode === "INFORMED");
    assert.ok(informed.remainingCombatPower <= basic.remainingCombatPower + 1e-9);
}
assert.equal(result.boundaryComparisons.length, 8);
for (const pair of result.boundaryComparisons) {
    assert.deepEqual(pair.below.development, pair.at.development);
    assert.equal(pair.below.participantCount, 1);
    assert.equal(pair.at.participantCount, 2);
}
const summary = summarizeStage1ThreatParticipationPolicyComparison(result);
assert.equal(summary.policies.length, 3);
assert.ok(summary.policies.every(item => item.standardSampleCount === 16));
assert.ok(summary.policies.some(item => item.standard.participants.max > item.standard.participants.min));
assert.equal(summary.boundary.BASIC.below30.participants, 1);
assert.equal(summary.boundary.BASIC.at30.participants, 2);

console.log("Stage1 threat/participation policy comparison v1: 72 policy + 16 boundary scenarios PASS");
