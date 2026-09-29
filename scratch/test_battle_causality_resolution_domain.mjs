import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { BattleResolutionSnapshotFactory } from "../game/src/trial/systems/battle_resolution_snapshot_factory.js";
import { evolveBattleResolutionSnapshot } from "../game/src/trial/domain/battle_resolution_snapshot.js";
import {
    BATTLE_CAUSE_CATEGORIES,
    BATTLE_CAUSE_TYPES,
    BATTLE_CONSEQUENCE_TYPES
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

const battleContext = {
    interceptCell: { cellId: "2:2", r: 2, c: 2, terrainId: "E2_HILL", elevation: 2 },
    approachCell: { cellId: "2:1", r: 2, c: 1, terrainId: "E0_WETLAND", elevation: 0 },
    human: { allocatedDefense: 12, baseInterceptionPower: 60 },
    enemy: {
        suppression: deployment.deployedSuppression,
        strategicSuppression: 100,
        reserveSuppression: deployment.reserveSuppression,
        hiddenTruth: { secret: "DO_NOT_COPY" },
        deployment: {
            profile: { bodySize: "LARGE", equipment: ["HEAVY"], secretOrder: "DO_NOT_COPY" },
            interaction,
            deployment
        }
    }
};

const combatResult = {
    human: { finalPower: 75 },
    enemy: { finalPower: 45, remainingForceSuppression: deployment.reserveSuppression },
    appliedModifiers: [],
    prediction: { outcome: "REPEL", margin: 30 },
    damageToSuppression: 45,
    remainingSuppression: 0,
    remainingForceSuppression: deployment.reserveSuppression,
    events: []
};

const originalRandom = Math.random;
Math.random = () => { throw new Error("Battle causality domain must not use RNG"); };

let snapshot;
try {
    snapshot = new BattleResolutionSnapshotFactory().create({
        battleId: "trial-1:battle-0",
        routeId: "route-a",
        battleContext,
        combatResult,
        actions: [{
            type: "INTERCEPT",
            actor: "HUMAN",
            target: "ENEMY_FORCE",
            location: "2:2",
            timing: "CONTACT"
        }],
        futureInputs: { formationStretch: "STRETCHED" }
    });
} finally {
    Math.random = originalRandom;
}

assert.equal(snapshot.actions.length, 1);
assert.equal(snapshot.battlefieldContext.approachTerrain.terrainFamily, "WETLAND");
assert.equal(snapshot.battlefieldContext.battlefieldCapabilities.approach.capabilities.footing, "POOR");

const movementCause = snapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED);
assert.ok(movementCause);
assert.equal(movementCause.category, BATTLE_CAUSE_CATEGORIES.MOBILITY);

const supportDelayed = snapshot.consequences.find(row => row.type === BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED);
assert.ok(supportDelayed);

const isolated = snapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED);
assert.ok(isolated);
assert.equal(isolated.category, BATTLE_CAUSE_CATEGORIES.COHESION);
assert.ok(isolated.derivedFrom.includes(supportDelayed.consequenceId));

assert.equal(snapshot.battleState.supportDelay, "DELAYED");
assert.equal(snapshot.normalOutcome.engagedPower.human, 75);
assert.equal(snapshot.normalOutcome.engagedPower.enemy, 45);
assert.equal(snapshot.normalOutcome.enemyLoss.suppressionDamage, 45);
assert.equal(snapshot.normalOutcome.battleControl, "REPEL");
assert.equal(snapshot.normalOutcome.humanLoss, null);
assert.equal(snapshot.normalOutcome.exploitationPotential, null);
assert.equal(JSON.stringify(snapshot).includes("DO_NOT_COPY"), false);

const evolved = evolveBattleResolutionSnapshot(snapshot, {
    opportunity: {
        state: "AVAILABLE",
        eligibility: "ELIGIBLE",
        normalOutcomeProvenance: { battleId: snapshot.battleId }
    }
});
assert.equal(snapshot.opportunity, null);
assert.equal(evolved.opportunity.state, "AVAILABLE");
assert.deepEqual(evolved.normalOutcome, snapshot.normalOutcome);
assert.throws(() => evolved.causes.push({}), TypeError);

console.log("✅ Battle Causality / Resolution Domain focused test PASS");
