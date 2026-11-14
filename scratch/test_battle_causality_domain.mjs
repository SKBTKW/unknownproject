import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { BattleResolutionSnapshotFactory } from "../game/src/trial/systems/battle_resolution_snapshot_factory.js";
import { TrialCombatResolver } from "../game/src/trial/systems/trial_combat_resolver.js";
import { MODIFIER_TARGETS } from "../game/src/trial/domain/trial_types.js";
import {
    BATTLE_FACT_TYPES,
    BATTLE_CAUSE_TYPES
} from "../game/src/trial/domain/battle_causality_types.js";

const interaction = new EnemyForceTerrainInteractionResolver().resolve({
    bodySize: "LARGE",
    equipment: ["HEAVY"],
    terrainId: "E0_WETLAND"
});
const deployment = new EnemyForceDeploymentResolver().resolve({
    forceSuppression: 100,
    interaction
});

assert.equal(interaction.deployment, "CONSTRAINED");
assert.equal(interaction.equipmentDeployment, "CONSTRAINED");
assert.ok(deployment.reserveSuppression > 0);

const battleContext = {
    interceptCell: {
        cellId: "2:2",
        row: 2,
        column: 2,
        placed: true,
        terrainId: "E2_HILL",
        elevation: 2
    },
    approachCell: {
        cellId: "2:1",
        row: 2,
        column: 1,
        placed: true,
        terrainId: "E0_WETLAND",
        elevation: 0
    },
    human: {
        allocatedDefense: 12,
        baseInterceptionPower: 60
    },
    enemy: {
        suppression: deployment.deployedSuppression,
        strategicSuppression: 100,
        reserveSuppression: deployment.reserveSuppression,
        species: "HIDDEN_SPECIES",
        commander: "HIDDEN_COMMANDER",
        hiddenTruth: { secret: "DO_NOT_COPY" },
        deployment: {
            profile: {
                bodySize: "LARGE",
                equipment: ["HEAVY"],
                secretOrder: "DO_NOT_COPY"
            },
            interaction,
            deployment
        }
    },
    environment: {
        hiddenWeatherTruth: "DO_NOT_COPY"
    }
};

const combatResult = {
    success: true,
    human: { basePower: 60, finalPower: 75 },
    enemy: {
        basePower: deployment.deployedSuppression,
        finalPower: 45,
        reserveSuppression: deployment.reserveSuppression,
        remainingForceSuppression: deployment.reserveSuppression
    },
    appliedModifiers: [{
        source: "HIGH_GROUND",
        target: "HUMAN_INTERCEPTION",
        before: 60,
        after: 75,
        phase: 200,
        priority: 20
    }],
    prediction: { outcome: "REPEL", margin: 30 },
    humanInterception: 75,
    enemySuppression: 45,
    damageToSuppression: 45,
    reserveSuppression: deployment.reserveSuppression,
    remainingSuppression: 0,
    remainingForceSuppression: deployment.reserveSuppression,
    events: [{
        type: "TERRAIN_EFFECT_APPLIED",
        effectId: "HIGH_GROUND",
        sourceCell: "2:1",
        targetCell: "2:2",
        value: 1.2
    }]
};

const beforeCombat = JSON.stringify(combatResult);
const beforeContext = JSON.stringify(battleContext);
const originalRandom = Math.random;
Math.random = () => {
    throw new Error("Battle causality must not use RNG");
};

let snapshot;
try {
    snapshot = new BattleResolutionSnapshotFactory().create({
        battleId: "trial-1:battle-0",
        routeId: "route-a",
        battleContext,
        combatResult,
        presentationMode: "IGNORED"
    });
} finally {
    Math.random = originalRandom;
}

assert.equal(JSON.stringify(combatResult), beforeCombat, "existing CombatResult must not mutate");
assert.equal(JSON.stringify(battleContext), beforeContext, "battle context must not mutate");

const factTypes = snapshot.initialFacts.map(row => row.type);
assert.ok(factTypes.includes(BATTLE_FACT_TYPES.ENEMY_LARGE_BODY));
assert.ok(factTypes.includes(BATTLE_FACT_TYPES.ENEMY_HEAVY_EQUIPMENT));
assert.ok(factTypes.includes(BATTLE_FACT_TYPES.ENEMY_DEPLOYMENT_CONSTRAINED));
assert.ok(factTypes.includes(BATTLE_FACT_TYPES.ENEMY_RESERVE_PRESENT));
assert.ok(factTypes.includes(BATTLE_FACT_TYPES.HIGH_GROUND));

const causeTypes = snapshot.causes.map(row => row.type);
assert.ok(causeTypes.includes(BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED));
assert.ok(causeTypes.includes(BATTLE_CAUSE_TYPES.ENEMY_RESERVE_HELD_BACK));
assert.ok(causeTypes.includes(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE));
assert.ok(causeTypes.includes(BATTLE_CAUSE_TYPES.LOCAL_SUPERIORITY));
assert.ok(causeTypes.includes(BATTLE_CAUSE_TYPES.HUMAN_PRESSURE_ADVANTAGE));

assert.equal(snapshot.normalOutcome.damageToSuppression, 45);
assert.equal(snapshot.normalOutcome.suppression.strategic, 100);
assert.equal(snapshot.normalOutcome.suppression.deployed, deployment.deployedSuppression);
assert.equal(snapshot.normalOutcome.suppression.reserve, deployment.reserveSuppression);
assert.equal(snapshot.normalOutcome.localAdvantage, true);
assert.equal(snapshot.normalOutcome.deploymentState, "CONSTRAINED");
assert.equal(snapshot.normalOutcome.reserveState, "HELD_BACK");

assert.equal(snapshot.opportunity, null);
assert.equal(snapshot.emberCommit, null);
assert.equal(snapshot.fortuneRoll, null);
assert.equal(snapshot.decisiveEvent, null);
assert.equal(snapshot.finalCombatResult, null);
assert.deepEqual(snapshot.flavorEvents, []);
assert.deepEqual(snapshot.presentationFacts, []);

const serialized = JSON.stringify(snapshot);
for (const forbidden of [
    "HIDDEN_SPECIES",
    "HIDDEN_COMMANDER",
    "DO_NOT_COPY",
    "hiddenWeatherTruth"
]) {
    assert.equal(serialized.includes(forbidden), false, `snapshot leaked hidden truth: ${forbidden}`);
}

assert.ok(Object.isFrozen(snapshot));
assert.ok(Object.isFrozen(snapshot.initialFacts));
assert.throws(() => snapshot.initialFacts.push({ type: "MUTATION" }), TypeError);

const replay = new BattleResolutionSnapshotFactory().create({
    battleId: "trial-1:battle-0",
    routeId: "route-a",
    battleContext,
    combatResult
});
assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), JSON.parse(JSON.stringify(replay)));

const parsed = JSON.parse(serialized);
assert.deepEqual(parsed.normalOutcome.suppression, {
    strategic: 100,
    deployed: deployment.deployedSuppression,
    reserve: deployment.reserveSuppression
});

const highGroundFact = snapshot.initialFacts.find(row => row.type === BATTLE_FACT_TYPES.HIGH_GROUND);
const highGroundCause = snapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE);
assert.deepEqual(highGroundFact.payload, {
    interceptElevation: 2,
    approachElevation: 0,
    higherSide: "HUMAN",
    applied: true,
    beneficiary: "HUMAN",
    polarity: "FAVORABLE",
    modifierTarget: MODIFIER_TARGETS.HUMAN_INTERCEPTION,
    before: 60,
    after: 75
});
assert.equal(highGroundCause.target, "ENEMY_FORCE");
assert.equal(highGroundCause.tags.includes("FAVORABLE"), true);
assert.equal(snapshot.normalOutcome.favorableCauses.includes(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE), true);

const enemyHighContext = JSON.parse(JSON.stringify(battleContext));
enemyHighContext.interceptCell = {
    cellId: "2:2", row: 2, column: 2, terrainId: "GL1_PLAINS", elevation: 1
};
enemyHighContext.approachCell = {
    cellId: "2:1", row: 2, column: 1, terrainId: "E2_HILL", elevation: 2
};
const enemyHighCombat = JSON.parse(JSON.stringify(combatResult));
enemyHighCombat.enemy.finalPower = 54;
enemyHighCombat.enemySuppression = 54;
enemyHighCombat.appliedModifiers = [{
    source: "HIGH_GROUND",
    target: MODIFIER_TARGETS.ENEMY_SUPPRESSION,
    before: 45,
    after: 54,
    phase: 200,
    priority: 20
}];
const enemyHighSnapshot = new BattleResolutionSnapshotFactory().create({
    battleId: "trial-1:enemy-high",
    routeId: "route-a",
    battleContext: enemyHighContext,
    combatResult: enemyHighCombat
});
const enemyHighFact = enemyHighSnapshot.initialFacts.find(row => row.type === BATTLE_FACT_TYPES.HIGH_GROUND);
const enemyHighCause = enemyHighSnapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE);
assert.equal(enemyHighFact.payload.beneficiary, "ENEMY");
assert.equal(enemyHighFact.payload.polarity, "UNFAVORABLE");
assert.equal(enemyHighCause.target, "HUMAN_FORCE");
assert.equal(enemyHighCause.tags.includes("FAVORABLE"), false);
assert.equal(enemyHighCause.tags.includes("DANGER"), true);
assert.equal(enemyHighSnapshot.normalOutcome.favorableCauses.includes(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE), false);
assert.equal(enemyHighSnapshot.normalOutcome.dangerCauses.includes(BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE), true);

const unappliedHighCombat = JSON.parse(JSON.stringify(enemyHighCombat));
unappliedHighCombat.appliedModifiers = [];
const unappliedHighSnapshot = new BattleResolutionSnapshotFactory().create({
    battleId: "trial-1:unapplied-high",
    routeId: "route-a",
    battleContext: enemyHighContext,
    combatResult: unappliedHighCombat
});
const unappliedHighFact = unappliedHighSnapshot.initialFacts.find(row => row.type === BATTLE_FACT_TYPES.HIGH_GROUND);
assert.equal(unappliedHighFact.payload.higherSide, "ENEMY");
assert.equal(unappliedHighFact.payload.applied, false);
assert.equal(unappliedHighFact.payload.polarity, "NEUTRAL");
assert.equal(unappliedHighSnapshot.causes.some(row => row.type === BATTLE_CAUSE_TYPES.TERRAIN_ADVANTAGE), false);

const profileResolver = new EnemyForceTerrainInteractionResolver();
const deploymentResolver = new EnemyForceDeploymentResolver();
const combatResolver = new TrialCombatResolver();
const terrainCase = (terrainId, bodySize, equipment) => {
    const terrainInteraction = profileResolver.resolve({ bodySize, equipment, terrainId });
    const forceDeployment = deploymentResolver.resolve({ forceSuppression: 200, interaction: terrainInteraction });
    const terrainCombat = combatResolver.resolve({
        interceptCell: { cellId: "I", terrainId, elevation: 1 },
        approachCell: { cellId: "A", terrainId: "GL1_PLAINS", elevation: 1 },
        human: { baseInterceptionPower: 100 },
        enemy: {
            suppression: forceDeployment.deployedSuppression,
            reserveSuppression: forceDeployment.reserveSuppression
        }
    });
    return { terrainInteraction, forceDeployment, terrainCombat };
};

const largeHeavyForest = terrainCase("GL2_FOREST", "LARGE", ["HEAVY"]);
assert.equal(largeHeavyForest.terrainInteraction.deployment, "CONSTRAINED");
assert.equal(largeHeavyForest.terrainInteraction.equipmentDeployment, "CONSTRAINED");
assert.ok(Math.abs(largeHeavyForest.forceDeployment.deploymentRatio - 0.45) < 1e-9);
assert.ok(Math.abs(largeHeavyForest.forceDeployment.deployedSuppression - 90) < 1e-9);
assert.ok(Math.abs(largeHeavyForest.forceDeployment.reserveSuppression - 110) < 1e-9);
assert.equal(largeHeavyForest.terrainCombat.enemySuppression, 65);

const largeHeavyDeepForest = terrainCase("GL3_DEEP_FOREST", "LARGE", ["HEAVY"]);
assert.equal(largeHeavyDeepForest.terrainInteraction.deployment, "SEVERELY_CONSTRAINED");
assert.equal(largeHeavyDeepForest.terrainInteraction.equipmentDeployment, "CONSTRAINED");
assert.equal(largeHeavyDeepForest.forceDeployment.deploymentRatio, 0.25);
assert.equal(largeHeavyDeepForest.forceDeployment.deployedSuppression, 50);
assert.equal(largeHeavyDeepForest.forceDeployment.reserveSuppression, 150);
assert.equal(largeHeavyDeepForest.terrainCombat.enemySuppression, 37);

for (const [bodySize, equipment] of [["MEDIUM", ["STANDARD"]], ["SMALL", ["LIGHT"]]]) {
    assert.equal(terrainCase("GL1_PLAINS", bodySize, equipment).forceDeployment.deploymentRatio, 1);
    assert.equal(terrainCase("GL2_FOREST", bodySize, equipment).forceDeployment.deploymentRatio, 1);
    assert.equal(terrainCase("GL3_DEEP_FOREST", bodySize, equipment).forceDeployment.deploymentRatio, 1);
}

const restoredInteraction = JSON.parse(JSON.stringify(largeHeavyForest.terrainInteraction));
const restoredDeployment = deploymentResolver.resolve({ forceSuppression: 200, interaction: restoredInteraction });
assert.deepEqual(restoredDeployment, largeHeavyForest.forceDeployment);
assert.deepEqual(
    terrainCase("GL2_FOREST", "LARGE", ["HEAVY"]).terrainCombat,
    largeHeavyForest.terrainCombat
);

console.log("✅ Battle Causality Domain focused diagnostic PASS");
