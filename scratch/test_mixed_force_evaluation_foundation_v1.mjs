import assert from "node:assert/strict";
import {
    MIXED_FORCE_EVALUATION_MODES,
    MixedForceTerrainEvaluationResolver
} from "../game/src/trial/systems/mixed_force_terrain_evaluation_resolver.js";

const source = (id, speciesComposition, equipmentComposition) => ({
    id,
    slot: id.at(-1),
    composition: { speciesComposition, equipmentComposition }
});

const pureParticipant = (species, equipment) => ({
    id: `PARTICIPANT_${species}_${equipment}`,
    primarySourceForceId: "SOURCE_A",
    sourceForceIds: ["SOURCE_A"],
    sourceForces: [source(
        "SOURCE_A",
        [{ type: species, share: 1 }],
        [{ type: equipment, share: 1 }]
    )],
    strategicSuppression: 100,
    profile: { bodySize: species, equipment: [equipment] }
});

const resolver = new MixedForceTerrainEvaluationResolver();
const primaryRatio = (participant, terrainId) => resolver.resolve({
    participatingForce: participant,
    terrainId,
    mode: MIXED_FORCE_EVALUATION_MODES.PRIMARY_SOURCE
}).participantAggregate.deploymentRatio;

const large = pureParticipant("LARGE", "HEAVY");
const medium = pureParticipant("MEDIUM", "STANDARD");
const small = pureParticipant("SMALL", "LIGHT");
assert.equal(primaryRatio(large, "GL1_PLAINS"), 1);
assert.ok(Math.abs(primaryRatio(large, "GL2_FOREST") - 0.45) < 1e-9);
assert.equal(primaryRatio(large, "GL3_DEEP_FOREST"), 0.25);
for (const participant of [medium, small]) {
    assert.equal(primaryRatio(participant, "GL1_PLAINS"), 1);
    assert.equal(primaryRatio(participant, "GL2_FOREST"), 1);
    assert.equal(primaryRatio(participant, "GL3_DEEP_FOREST"), 1);
}

const mixedSource = source("SOURCE_A", [
    { type: "LARGE", share: 0.3 },
    { type: "MEDIUM", share: 0.6 },
    { type: "SMALL", share: 0.1 }
], [
    { type: "HEAVY", share: 0.3 },
    { type: "STANDARD", share: 0.6 },
    { type: "LIGHT", share: 0.1 }
]);
const mixed = {
    id: "PARTICIPANT_MIXED",
    primarySourceForceId: "SOURCE_A",
    sourceForceIds: ["SOURCE_A"],
    sourceForces: [mixedSource],
    strategicSuppression: 100,
    profile: { bodySize: "LARGE", equipment: ["HEAVY", "STANDARD", "LIGHT"] }
};

const marginalBefore = structuredClone(mixed);
const marginal = resolver.resolve({
    participatingForce: mixed,
    terrainId: "GL2_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS
});
assert.equal(marginal.policy.productionConnected, false);
assert.equal(marginal.sourceEvaluations[0].jointCompositionStatus, "UNKNOWN");
assert.equal(marginal.sourceEvaluations[0].combinedDeploymentRatio, null);
assert.equal(marginal.participantAggregate, null);
assert.ok(marginal.limitations.includes("JOINT_SPECIES_EQUIPMENT_COMPOSITION_UNKNOWN"));
assert.deepEqual(mixed, marginalBefore);
assert.ok(Object.isFrozen(marginal));
assert.ok(Object.isFrozen(marginal.sourceEvaluations[0].composition));

const correlated = [{ sourceForceId: "SOURCE_A", rows: [
    { species: "LARGE", equipment: "HEAVY", share: 0.3 },
    { species: "MEDIUM", equipment: "STANDARD", share: 0.6 },
    { species: "SMALL", equipment: "LIGHT", share: 0.1 }
] }];
const independent = [];
for (const species of mixedSource.composition.speciesComposition) {
    for (const equipment of mixedSource.composition.equipmentComposition) {
        independent.push({
            species: species.type,
            equipment: equipment.type,
            share: species.share * equipment.share
        });
    }
}
const hypotheses = rows => ({ SOURCE_A: rows });
const explicit = rows => resolver.resolve({
    participatingForce: mixed,
    terrainId: "GL2_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.EXPLICIT_JOINT_HYPOTHESIS,
    jointHypothesesBySource: hypotheses(rows),
    sourceSuppressionById: { SOURCE_A: 100 }
});
const correlatedResult = explicit(correlated[0].rows);
const independentResult = explicit(independent);
assert.equal(correlatedResult.sourceEvaluations[0].jointCompositionStatus, "EXPLICIT_HYPOTHESIS");
assert.equal(correlatedResult.participantAggregate.strategicSuppression, 100);
assert.notEqual(
    correlatedResult.sourceEvaluations[0].combinedDeploymentRatio,
    independentResult.sourceEvaluations[0].combinedDeploymentRatio
);
assert.ok(correlatedResult.limitations.includes("JOINT_COMPOSITION_IS_DIAGNOSTIC_HYPOTHESIS"));

const repeated = explicit(correlated[0].rows);
assert.deepEqual(repeated, correlatedResult);
const restoredInput = JSON.parse(JSON.stringify(mixed));
assert.deepEqual(resolver.resolve({
    participatingForce: restoredInput,
    terrainId: "GL2_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.EXPLICIT_JOINT_HYPOTHESIS,
    jointHypothesesBySource: hypotheses(correlated[0].rows),
    sourceSuppressionById: { SOURCE_A: 100 }
}), correlatedResult);
assert.deepEqual(restoredInput, mixed);

const originalRandom = Math.random;
Math.random = () => { throw new Error("mixed-force evaluation must not consume RNG"); };
try {
    assert.deepEqual(explicit(independent), independentResult);
} finally {
    Math.random = originalRandom;
}

const knownEnemyState = { reports: [{ id: "KNOWN_A", fields: { bodySize: "LARGE" } }] };
const knownBefore = structuredClone(knownEnemyState);
resolver.resolve({
    participatingForce: mixed,
    terrainId: "GL3_DEEP_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS
});
assert.deepEqual(knownEnemyState, knownBefore);

assert.throws(() => explicit([
    { species: "LARGE", equipment: "HEAVY", share: 0.3 },
    { species: "MEDIUM", equipment: "STANDARD", share: 0.7 }
]), /JOINT_SPECIES_MISMATCH|JOINT_EQUIPMENT_MISMATCH/);
assert.throws(() => resolver.resolve({
    participatingForce: mixed,
    terrainId: "GL2_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.EXPLICIT_JOINT_HYPOTHESIS,
    jointHypothesesBySource: hypotheses(correlated[0].rows),
    sourceSuppressionById: { SOURCE_A: 99 }
}), /SOURCE_SUPPRESSION_TOTAL_MISMATCH/);

const primary = resolver.resolve({
    participatingForce: mixed,
    terrainId: "GL2_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.PRIMARY_SOURCE
});
assert.equal(primary.primarySourceForceId, "SOURCE_A");
assert.equal(primary.sources[0].sourceForceId, "SOURCE_A");
assert.ok(primary.limitations.includes("NON_PRIMARY_SOURCE_COMPOSITION_NOT_EVALUATED"));
assert.notEqual(primary.participantAggregate.deploymentRatio, correlatedResult.sourceEvaluations[0].combinedDeploymentRatio);

const multiSource = {
    id: "PARTICIPANT_AB",
    primarySourceForceId: "SOURCE_A",
    sourceForceIds: ["SOURCE_A", "SOURCE_B"],
    sourceForces: [
        source("SOURCE_A", [{ type: "LARGE", share: 1 }], [{ type: "HEAVY", share: 1 }]),
        source("SOURCE_B", [{ type: "SMALL", share: 1 }], [{ type: "LIGHT", share: 1 }])
    ],
    strategicSuppression: 100,
    profile: { bodySize: "LARGE", equipment: ["HEAVY"] }
};
const multiMarginal = resolver.resolve({
    participatingForce: multiSource,
    terrainId: "GL3_DEEP_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS
});
assert.deepEqual(multiMarginal.sourceForceIds, ["SOURCE_A", "SOURCE_B"]);
assert.deepEqual(multiMarginal.sourceEvaluations.map(row => row.sourceForceId), ["SOURCE_A", "SOURCE_B"]);
assert.equal(multiMarginal.participantAggregate, null);
const multiExplicit = resolver.resolve({
    participatingForce: multiSource,
    terrainId: "GL3_DEEP_FOREST",
    mode: MIXED_FORCE_EVALUATION_MODES.EXPLICIT_JOINT_HYPOTHESIS,
    jointHypothesesBySource: {
        SOURCE_A: [{ species: "LARGE", equipment: "HEAVY", share: 1 }],
        SOURCE_B: [{ species: "SMALL", equipment: "LIGHT", share: 1 }]
    },
    sourceSuppressionById: { SOURCE_A: 60, SOURCE_B: 40 }
});
assert.equal(multiExplicit.sourceEvaluations[0].sourceForceId, "SOURCE_A");
assert.equal(multiExplicit.sourceEvaluations[1].sourceForceId, "SOURCE_B");
assert.equal(multiExplicit.participantAggregate.strategicSuppression, 100);
assert.equal(
    multiExplicit.participantAggregate.deployedSuppression,
    multiExplicit.sourceEvaluations.reduce((sum, row) => sum + row.deployedSuppression, 0)
);

console.log("Mixed force evaluation foundation v1: PASS");
