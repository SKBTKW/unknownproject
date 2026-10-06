import assert from "node:assert/strict";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { BattleResolutionSnapshotFactory } from "../game/src/trial/systems/battle_resolution_snapshot_factory.js";
import { projectBattleResolutionResult, projectBattleSequenceCombatResult } from "../game/src/trial/systems/battle_resolution_result_projector.js";
import { evolveBattleResolutionSnapshot } from "../game/src/trial/domain/battle_resolution_snapshot.js";
import { createBattleOpportunityState } from "../game/src/trial/domain/battle_opportunity_domain.js";
import {
    BATTLE_CAUSE_CATEGORIES,
    BATTLE_CAUSE_TYPES,
    BATTLE_CONSEQUENCE_TYPES,
    BATTLE_FACT_TYPES
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
    interceptCell: { cellId: "2:2", r: 2, c: 2, terrainId: "E2_HILL", e: 2, gl: 1 },
    approachCell: { cellId: "2:1", r: 2, c: 1, terrainId: "E0_WETLAND", e: 0, gl: 1 },
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

const action = {
    actionId: "action:intercept:0",
    type: "INTERCEPT",
    actor: "HUMAN",
    target: "ENEMY_FORCE",
    location: "2:2",
    timing: "CONTACT",
    provenance: { source: "TRIAL_BATTLE_SEQUENCE" }
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
        actions: [action],
        futureInputs: {
            formationStretch: "STRETCHED",
            zoneContinuity: null,
            terrainDepth: null,
            tacticalDepth: null,
            linkedTerrainNetwork: null
        }
    });
} finally {
    Math.random = originalRandom;
}

assert.equal(snapshot.actions.length, 1);
assert.equal(snapshot.actions[0].provenance.source, "TRIAL_BATTLE_SEQUENCE");
assert.equal(snapshot.battlefieldContext.approachTerrain.terrainFamily, "WETLAND");
assert.equal(snapshot.battlefieldContext.approachTerrain.e, 0);
assert.equal(snapshot.battlefieldContext.approachTerrain.gl, 1);
assert.equal(snapshot.battlefieldContext.approachTerrain.elevation, 0);
assert.equal(snapshot.battlefieldContext.approachTerrain.growthLevel, 1);
assert.equal(snapshot.battlefieldContext.battlefieldCapabilities.approach.capabilities.footing, "POOR");

const movementCause = snapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED);
assert.ok(movementCause);
assert.equal(movementCause.category, BATTLE_CAUSE_CATEGORIES.MOBILITY);
assert.equal(movementCause.sourceAction, action.actionId);

const supportDelayed = snapshot.consequences.find(row => row.type === BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED);
assert.ok(supportDelayed);
assert.equal(supportDelayed.sourceAction, action.actionId);
assert.ok(supportDelayed.sourceFacts.includes(BATTLE_FACT_TYPES.TERRAIN_WETLAND));
assert.equal(supportDelayed.severity, movementCause.severity);
assert.equal(supportDelayed.presentationPriority, movementCause.presentationPriority);

const isolated = snapshot.causes.find(row => row.type === BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED);
assert.ok(isolated);
assert.equal(isolated.category, BATTLE_CAUSE_CATEGORIES.COHESION);
assert.ok(isolated.derivedFrom.includes(supportDelayed.consequenceId));

assert.equal(snapshot.battleState.mobility, "CONSTRAINED");
assert.equal(snapshot.battleState.cohesion, "SHAKEN");
assert.equal(snapshot.battleState.supportDelay, "DELAYED");
assert.equal(snapshot.normalOutcome.engagedPower.human, 75);
assert.equal(snapshot.normalOutcome.engagedPower.enemy, 45);
assert.equal(snapshot.normalOutcome.enemyLoss.suppressionDamage, 45);
assert.equal(snapshot.normalOutcome.damageToSuppression, 45);
assert.equal(snapshot.normalOutcome.battleControl, "REPEL");
assert.equal(snapshot.normalOutcome.humanLoss, null);
assert.equal(snapshot.normalOutcome.exploitationPotential, null);
assert.equal(JSON.stringify(snapshot).includes("DO_NOT_COPY"), false);

const contextOnly = new BattleResolutionSnapshotFactory().create({
    battleId: "trial-1:battle-context-only",
    routeId: "route-a",
    battleContext,
    combatResult,
    actions: [],
    futureInputs: { formationStretch: "STRETCHED" }
});
assert.equal(contextOnly.causes.some(row => row.type === BATTLE_CAUSE_TYPES.MOVEMENT_CONSTRAINED), false);
assert.equal(contextOnly.consequences.some(row => row.type === BATTLE_CONSEQUENCE_TYPES.SUPPORT_DELAYED), false);
assert.equal(contextOnly.causes.some(row => row.type === BATTLE_CAUSE_TYPES.VANGUARD_ISOLATED), false);
assert.equal(contextOnly.causes.some(row => row.type === BATTLE_CAUSE_TYPES.DEPLOYMENT_CONSTRAINED), true);

const opportunity = createBattleOpportunityState({
    opportunityId: "battle-opportunity:trial-1:battle-0",
    battleId: snapshot.battleId,
    state: "AVAILABLE",
    eligibility: "ELIGIBLE",
    normalOutcomeProvenance: { battleId: snapshot.battleId },
    causalProvenance: {
        causeIds: snapshot.causes.map(row => row.causeId),
        consequenceIds: snapshot.consequences.map(row => row.consequenceId)
    },
    sourceCauses: snapshot.causes.map(row => row.causeId),
    emberCommitHook: { status: "UNRESOLVED" },
    fortuneResultHook: { status: "UNRESOLVED" }
});
assert.equal(opportunity.battleId, snapshot.battleId);
assert.ok(opportunity.sourceCauses.includes(movementCause.causeId));
assert.ok(opportunity.causalProvenance.consequenceIds.includes(supportDelayed.consequenceId));

const evolved = evolveBattleResolutionSnapshot(snapshot, { opportunity });
assert.equal(snapshot.opportunity, null);
assert.equal(evolved.opportunity.state, "AVAILABLE");
assert.deepEqual(evolved.normalOutcome, snapshot.normalOutcome);
assert.deepEqual(evolved.actions, snapshot.actions);
assert.deepEqual(evolved.consequences, snapshot.consequences);
assert.throws(
    () => evolveBattleResolutionSnapshot(snapshot, { normalOutcome: { outcome: "MUTATED" } }),
    /BATTLE_RESOLUTION_A_OWNED_FIELD_IMMUTABLE:normalOutcome/
);
assert.throws(
    () => evolveBattleResolutionSnapshot(snapshot, { unknownField: true }),
    /BATTLE_RESOLUTION_EVOLVE_FIELD_NOT_ALLOWED:unknownField/
);
assert.throws(() => evolved.causes.push({}), TypeError);


const baselineProjection = projectBattleResolutionResult(snapshot);
assert.equal(baselineProjection.routeId, "route-a");
assert.equal(baselineProjection.interceptionLocation.row, 2);
assert.equal(baselineProjection.interceptionLocation.column, 2);
assert.equal(baselineProjection.resultStage, "NORMAL_OUTCOME");
assert.equal(baselineProjection.outcome, "REPEL");
assert.equal(baselineProjection.remainingForceSuppression, deployment.reserveSuppression);
assert.equal(baselineProjection.damageToSuppression, 45);
assert.deepEqual(baselineProjection.effectiveCombatResult, snapshot.normalOutcome);
assert.equal(baselineProjection.finalCombatResult, null);

const finalSnapshot = evolveBattleResolutionSnapshot(evolved, {
    emberCommit: {
        committed: true,
        cost: 2,
        emberBefore: 10,
        emberAfter: 8
    },
    fortuneRoll: {
        dice: [4, 5],
        total: 9,
        result: "DECISIVE_SUCCESS"
    },
    decisiveEvent: {
        eventId: "decisive:1",
        type: "TEST_ONLY",
        sourceCauses: [movementCause.causeId]
    },
    finalCombatResult: {
        outcome: "DECISIVE_REPEL"
    },
    resolutionPhase: "FINALIZED",
    finalized: true
});
const finalProjection = projectBattleResolutionResult(finalSnapshot);
assert.equal(finalProjection.resultStage, "FINAL");
assert.equal(finalProjection.outcome, "DECISIVE_REPEL");
assert.equal(finalProjection.damageToSuppression, snapshot.normalOutcome.damageToSuppression);
assert.equal(
    finalProjection.remainingForceSuppression,
    snapshot.normalOutcome.remainingForceSuppression
);
assert.equal(finalProjection.routeId, snapshot.routeId);
assert.deepEqual(finalProjection.interceptionLocation, snapshot.battlefieldContext.interceptionLocation);
assert.deepEqual(finalProjection.normalOutcome, snapshot.normalOutcome);
assert.equal(finalProjection.intervention.fortuneRoll.total, 9);
assert.deepEqual(finalProjection.provenance.decisiveSourceCauses, [movementCause.causeId]);
assert.ok(finalProjection.provenance.causeIds.includes(movementCause.causeId));
assert.ok(finalProjection.provenance.consequenceIds.includes(supportDelayed.consequenceId));
assert.throws(() => { finalProjection.outcome = "MUTATED"; }, TypeError);
assert.deepEqual(snapshot.normalOutcome, evolved.normalOutcome);
assert.equal(snapshot.finalCombatResult, null);

const baselineSequenceResult = projectBattleSequenceCombatResult(snapshot);
assert.equal(baselineSequenceResult.prediction.outcome, "REPEL");
assert.equal(baselineSequenceResult.prediction.margin, 30);
assert.equal(baselineSequenceResult.human.finalPower, 75);
assert.equal(baselineSequenceResult.enemy.finalPower, 45);
assert.equal(baselineSequenceResult.playerActualPower, 75);
assert.equal(baselineSequenceResult.enemyActualPower, 45);
assert.equal(
    baselineSequenceResult.remainingForceSuppression,
    snapshot.normalOutcome.remainingForceSuppression
);
assert.equal(baselineSequenceResult.finalCombatResult, null);

const finalSequenceResult = projectBattleSequenceCombatResult(finalSnapshot);
assert.equal(finalSequenceResult.prediction.outcome, "DECISIVE_REPEL");
assert.equal(finalSequenceResult.prediction.margin, snapshot.normalOutcome.margin);
assert.equal(finalSequenceResult.human.finalPower, snapshot.normalOutcome.humanFinalPower);
assert.equal(finalSequenceResult.enemy.finalPower, snapshot.normalOutcome.enemyFinalPower);
assert.equal(
    finalSequenceResult.remainingForceSuppression,
    snapshot.normalOutcome.remainingForceSuppression
);
assert.equal(finalSequenceResult.damageToSuppression, snapshot.normalOutcome.damageToSuppression);
assert.equal(finalSequenceResult.finalCombatResult.outcome, "DECISIVE_REPEL");
assert.equal(finalSequenceResult.fortuneRoll.total, 9);
assert.throws(() => { finalSequenceResult.prediction.outcome = "MUTATED"; }, TypeError);

console.log("✅ Battle Causality / Resolution Domain focused test PASS");
