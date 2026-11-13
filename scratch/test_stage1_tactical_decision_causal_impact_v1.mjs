import assert from "node:assert/strict";
import {
    AUDIT_SEEDS,
    runStage1TacticalDecisionCausalImpactAudit
} from "./diagnose_stage1_tactical_decision_causal_impact_v1.mjs";

const report = runStage1TacticalDecisionCausalImpactAudit();

assert.deepEqual(report.seeds, [...AUDIT_SEEDS]);
assert.equal(report.productionMutation, false);
assert.equal(report.productionDefaultsChanged, false);
assert.equal(report.natural.length, 16);
assert.equal(report.summary.naturalSamplesWithDecisionDelta, 7);
assert.equal(report.summary.naturalSamplesWithNoDecisionDelta, 9);
assert.equal(report.summary.naturalZoneSamples, 1);
assert.equal(report.summary.naturalLinkSamples, 0);
assert.equal(report.constructedLegalBoard.classification, "CONSTRUCTED_LEGAL");
assert.equal(report.constructedLegalBoard.completedZones, 2);
assert.equal(report.constructedLegalBoard.links, 1);
assert.equal(report.constructedLegalBoard.linkResolvedByGridEngine, true);
assert.equal(report.constructedLegalBoard.specialBlockValidatedByService, true);
assert.equal(report.constructedLegalBoard.combatProjection.zonesPassedToBattleContext, false);
assert.equal(report.constructedLegalBoard.combatProjection.linksPassedToBattleContext, false);

const strategies = Object.fromEntries(report.constructed.strategies.map(row => [row.label, row]));
assert.equal(strategies.C1_NO_INTERCEPTION.emberDamage, 27);
assert.equal(strategies.C2_EQUAL.emberDamage, 13);
assert.equal(strategies.C3_MAIN_FORCE_CONCENTRATION.emberDamage, 13);
assert.equal(strategies.C4_TERRAIN_PRIORITY.emberDamage, 12);
assert.equal(strategies.C5_SUPPRESSION_PRIORITY.emberDamage, 13);
assert.equal(strategies.C6_EXHAUSTIVE_DIAGNOSTIC_CEILING.emberDamage, 11);
assert.equal(strategies.C6_EXHAUSTIVE_DIAGNOSTIC_CEILING.search.cutoff, null);
assert.equal(strategies.C6_EXHAUSTIVE_DIAGNOSTIC_CEILING.search.evaluated, 2614);
assert.equal(strategies.C6_EXHAUSTIVE_DIAGNOSTIC_CEILING.search.committedResultMatchesPreview, true);
assert.equal(report.summary.constructedBestWorstEmberGap, 16);
assert.equal(report.summary.constructedBestWorstSuppressionGap, 80.5);

const locationRows = report.constructed.locationComparison;
assert.equal(locationRows.length, 2);
assert.equal(locationRows[0].terrainId, "GL1_PLAINS");
assert.equal(locationRows[1].terrainId, "GL2_FOREST");
assert.equal(locationRows[0].emberDamage, locationRows[1].emberDamage);
assert.equal(locationRows[1].causal.facts.includes("ENEMY_DEPLOYMENT_CONSTRAINED"), true);
assert.equal(locationRows[1].causal.causes.some(row => row.type === "DEPLOYMENT_CONSTRAINED"), true);
assert.equal(locationRows[1].causal.consequences.includes("SUPPORT_DELAYED"), true);

assert.equal(report.profiles.length, 12);
assert.equal(report.profiles.every(row => row.tacticAppliedNumerically === false), true);
const largeForest = report.profiles.find(row => row.profile === "LARGE_HEAVY" && row.terrain === "FOREST");
const largeDeepForest = report.profiles.find(row => row.profile === "LARGE_HEAVY" && row.terrain === "DEEP_FOREST");
assert.ok(largeForest.reserveSuppression > 0);
assert.equal(largeForest.remainingSuppression, 40);
assert.ok(largeDeepForest.reserveSuppression > 0);
assert.equal(largeDeepForest.causal.normalOutcome.remainingForceSuppression, 45);
assert.equal(largeDeepForest.remainingSuppression, 0);

assert.equal(report.primarySource.runtimeProfileSource, "PRIMARY_SOURCE");
assert.deepEqual(report.primarySource.runtimeProfile, { bodySize: "LARGE", equipment: ["HEAVY"] });
assert.equal(report.primarySource.ignoredSourceForceIds.length, 2);
assert.equal(report.primarySource.knownStateUnchanged, true);
assert.equal(report.primarySource.truthLeakDetected, false);

assert.deepEqual(report.information.map(row => row.emberDamage), [13, 13, 13]);
assert.equal(report.information[2].informationScope, "TRUE_RUNTIME_PREVIEW_DIAGNOSTIC_ONLY");

const misleading = report.natural
    .find(row => row.seed === 20260921 && row.strategy === "expansion")
    .candidates.find(row => row.emberDamage > 20);
assert.ok(misleading);
assert.equal(misleading.causes.includes("TERRAIN_ADVANTAGE"), true);
assert.equal(misleading.emberDamage, 21);

const deterministicA = runStage1TacticalDecisionCausalImpactAudit({ seeds: [20260920] });
const deterministicB = runStage1TacticalDecisionCausalImpactAudit({ seeds: [20260920] });
assert.deepEqual(deterministicA.constructed, deterministicB.constructed);
assert.deepEqual(deterministicA.profiles, deterministicB.profiles);
assert.deepEqual(deterministicA.natural, deterministicB.natural);

console.log("Stage1 tactical decision causal impact audit v1: 53/53 assertions passed");
