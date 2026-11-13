import assert from "node:assert/strict";
import { blueprintArmyId } from "../game/src/trial/domain/enemy_army_blueprint.js";
import { Stage1EnemyParticipationTrialAdapter } from "../game/src/trial/systems/stage1_enemy_participation_trial_adapter.js";
import { EnemyArmyBlueprintLifecycleService } from "../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js";
import { EnemyInvasionFoundationLifecycleService } from "../game/src/trial/systems/enemy_invasion_foundation_lifecycle_service.js";
import { TrialIngressResolver } from "../game/src/trial/scenario/trial_ingress_resolver.js";
import { TrialRouteGenerator } from "../game/src/trial/scenario/trial_route_generator.js";
import { TrialRouteSuppressionAllocator } from "../game/src/trial/scenario/trial_route_suppression_allocator.js";
import { TrialScenarioFactory } from "../game/src/trial/scenario/trial_scenario_factory.js";
import { TrialController } from "../game/src/trial/flow/trial_controller.js";
import {
    readStage1TrialParticipationState,
    Stage1TrialParticipationSnapshot
} from "../game/src/trial/domain/stage1_trial_participation_snapshot.js";
import { serializeGameState } from "../game/src/core/state_serializer.js";
import { hydrateGameState } from "../game/src/core/hydrate_game_state.js";
import { TrialThreatResolver } from "../game/src/trial/systems/trial_threat_resolver.js";

const policy = {
    enabled: true,
    id: "test-stage1-participation-policy",
    version: 1,
    stageId: 1,
    trialIndex: 1,
    sourceDisposition: "CONSOLIDATE_ALL_SOURCES",
    runtimeProfileSource: "PRIMARY_SOURCE",
    participantBands: [
        { participantCount: 1, minInclusive: 0, maxExclusive: 10 },
        { participantCount: 2, minInclusive: 10, maxExclusive: 30 },
        { participantCount: 3, minInclusive: 30, maxExclusive: null }
    ],
    sourceWeights: { A: 3, B: 2, C: 1 },
    ingressDirectionPriority: ["NORTH", "EAST", "SOUTH", "WEST"]
};

function makeState(seed = 20260923) {
    const grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
        r, c, placed: true, isHQ: r === 2 && c === 2,
        placementGroupId: r === 2 && c === 2 ? null : `BOARD_BLOCK_${(r * 5 + c) % 9}`,
        terrain: { id: "GL1_PLAINS" }
    })));
    return {
        runSeed: seed,
        stage: { id: 1 },
        turn: 15,
        grid,
        placedBlockCount: 9,
        mergedBlocks: {},
        mergeLinks: new Set(),
        roadEdges: new Set(),
        grantedConnectionPairs: new Set(),
        handOffering: [],
        reserveSlots: [],
        currentDefense: 18,
        ember: 15,
        maxEmber: 20,
        mystic: 0,
        getTerritoryTileCount: () => 11
    };
}

function registerFoundation(state) {
    const armyId = blueprintArmyId(state.runSeed, 1);
    const slots = ["A", "B", "C"];
    new EnemyArmyBlueprintLifecycleService({ gameState: state }).registerBlueprint(1, {
        schemaVersion: 1,
        runSeed: state.runSeed,
        stageId: 1,
        armyId,
        generationPolicy: { id: "test-fixture", version: 1 },
        forces: slots.map((slot, index) => ({
            id: `${armyId}_${slot}`,
            slot,
            composition: {
                speciesComposition: [{ type: ["LARGE", "MEDIUM", "SMALL"][index], share: 1 }],
                equipmentComposition: [{ type: ["HEAVY", "STANDARD", "LIGHT"][index], share: 1 }]
            }
        }))
    });
    new EnemyInvasionFoundationLifecycleService({ gameState: state }).registerDirectionSnapshot({
        schemaVersion: 1,
        stageId: 1,
        armyId,
        forces: slots.map(slot => ({
            sourceForceId: `${armyId}_${slot}`,
            slot,
            activityDirection: "NORTH"
        }))
    });
    return armyId;
}

const state = makeState();
const armyId = registerFoundation(state);
state.knownEnemyState = {
    reports: [{ id: "KNOWN_A", observations: [{
        tag: "A_ONLY",
        subject: { scope: "SOURCE_FORCE", sourceForceId: `${armyId}_A` }
    }] }]
};
const knownBefore = structuredClone(state.knownEnemyState);
const ingressResolver = new TrialIngressResolver({ selector: () => [] });
const adapter = new Stage1EnemyParticipationTrialAdapter({ policy });
const factory = new TrialScenarioFactory({
    // Test-only coefficients prove Board development -> Threat -> participation.
    // They are deliberately not exported as production balance values.
    threatResolver: new TrialThreatResolver({
        baseThreatByTrial: { 1: 2 },
        placedBlockWeight: 2
    }),
    enemyParticipationAdapter: adapter,
    ingressResolver,
    routeGenerator: new TrialRouteGenerator({ costResolver: () => 1 }),
    suppressionAllocator: new TrialRouteSuppressionAllocator()
});

const built = factory.build({ trialIndex: 1, gameState: state });
assert.equal(built.success, true);
assert.equal(built.diagnostics.development.placedBlockCount, 9);
assert.equal(built.diagnostics.threat.breakdown.placedBlockThreat, 18);
assert.equal(built.scenario.enemySuppression, 20);
assert.equal(adapter.policyResolver.resolve({ strategicSuppression: 9.5 }).participantCount, 1);
assert.equal(adapter.policyResolver.resolve({ strategicSuppression: 10 }).participantCount, 2);
assert.equal(built.scenario.routes.length, 2);
assert.equal(built.scenario.forces.length, 2);
assert.equal(built.scenario.enemyParticipation.armyId, armyId);
assert.deepEqual(
    built.scenario.forces.flatMap(force => force.sourceForceIds).sort(),
    [`${armyId}_A`, `${armyId}_B`, `${armyId}_C`].sort()
);
assert.equal(
    built.scenario.routes.reduce((sum, route) => sum + route.strategicSuppression, 0),
    20
);
assert.equal(built.scenario.forces[0].role, "MAIN");
assert.equal(built.scenario.routes[0].forceId, built.scenario.forces[0].id);
assert.deepEqual(state.knownEnemyState, knownBefore);
const duplicateAssignment = structuredClone(built.scenario.enemyParticipation);
duplicateAssignment.forces[1].sourceForceIds[0] = duplicateAssignment.forces[0].sourceForceIds[0];
assert.throws(
    () => Stage1TrialParticipationSnapshot.fromSnapshot(duplicateAssignment),
    /STAGE1_TRIAL_PARTICIPATION_FORCE_INVALID/
);

const persistedBefore = JSON.parse(JSON.stringify(readStage1TrialParticipationState(state)));
assert.equal(persistedBefore.snapshots.length, 1);
assert.deepEqual(factory.build({ trialIndex: 1, gameState: state }).scenario.enemyParticipation,
    built.scenario.enemyParticipation);
assert.deepEqual(JSON.parse(JSON.stringify(readStage1TrialParticipationState(state))), persistedBefore);
const changedThreatFactory = new TrialScenarioFactory({
    threatResolver: new TrialThreatResolver({ baseThreatByTrial: { 1: 21 } }),
    enemyParticipationAdapter: adapter,
    ingressResolver,
    routeGenerator: new TrialRouteGenerator({ costResolver: () => 1 }),
    suppressionAllocator: new TrialRouteSuppressionAllocator()
});
const conflict = changedThreatFactory.build({ trialIndex: 1, gameState: state });
assert.equal(conflict.success, false);
assert.deepEqual(conflict.errors, ["ENEMY_PARTICIPATION_UNRESOLVED"]);
assert.equal(conflict.diagnostics.enemyParticipationError, "STAGE1_PARTICIPATION_SNAPSHOT_CONFLICT");
const serialized = JSON.parse(JSON.stringify(serializeGameState(state)));
const restored = {};
hydrateGameState(restored, serialized);
assert.deepEqual(readStage1TrialParticipationState(restored), persistedBefore);
delete serialized.stage1TrialParticipationState;
const restoredLegacy = { stage1TrialParticipationState: persistedBefore };
hydrateGameState(restoredLegacy, serialized);
assert.equal(Object.hasOwn(restoredLegacy, "stage1TrialParticipationState"), false);

const controller = new TrialController();
controller.startScenario(built.scenario, { cellResolver: (r, c) => state.grid[r]?.[c] });
const drafts = new Map();
for (const route of controller.getPlanningRoutes()) {
    let planned = false;
    for (const point of route.cells) {
        if (state.grid[point.r][point.c].isHQ) continue;
        const result = controller.setRouteInterceptPlan(drafts, route.id, point, 3);
        if (result.success) { planned = true; break; }
    }
    assert.equal(planned, true);
}
assert.equal(controller.confirmInterceptionPlan(drafts, { allowWarnings: true }).success, true);
assert.equal(controller.activateInterceptionPlan().success, true);
for (let index = 0; index < 2; index += 1) {
    assert.equal(controller.startNextBattle().success, true);
    assert.equal(controller.resolveCurrentBattle().success, true);
    assert.equal(controller.advanceAfterCurrentBattle().success, true);
    assert.equal(controller.transitionAfterCurrentBattle().success, true);
}
assert.equal(controller.canCompleteTrial(), true);
const completion = controller.completeTrial();
assert.equal(completion.success, true);
assert.equal(completion.hqDamage.sourcePower, 70);
assert.equal(completion.hqDamage.emberDamage, 14);
assert.equal(completion.hqDamage.emberAfter, 1);

const legacyState = makeState(20260924);
registerFoundation(legacyState);
const legacyFactory = new TrialScenarioFactory({
    enemyTruthReadModel: { getSnapshot: () => ({ trialIndex: 1, strategicSuppression: 20 }) },
    armyStructureResolver: { resolve: () => ({
        strategicSuppression: 20,
        forceCount: 1,
        routeCount: 1,
        commander: null,
        forces: [{ id: "LEGACY_FORCE", role: "MAIN", strategicSuppression: 20 }]
    }) },
    ingressResolver: new TrialIngressResolver({ selector: ({ candidates }) => candidates.slice(0, 1) }),
    routeGenerator: new TrialRouteGenerator({ costResolver: () => 1 }),
    suppressionAllocator: new TrialRouteSuppressionAllocator()
});
assert.equal(legacyFactory.build({ trialIndex: 1, gameState: legacyState }).scenario.routes.length, 1);
assert.equal(Object.hasOwn(legacyState, "stage1TrialParticipationState"), false);

assert.throws(() => new Stage1EnemyParticipationTrialAdapter({
    policy: { ...policy, sourceDisposition: "DROP_NON_PARTICIPANTS" }
}), /STAGE1_PARTICIPATION_POLICY_INVALID/);

const missingFoundationState = makeState(20260925);
const missingFoundation = factory.build({ trialIndex: 1, gameState: missingFoundationState });
assert.equal(missingFoundation.success, false);
assert.deepEqual(missingFoundation.errors, ["ENEMY_PARTICIPATION_UNRESOLVED"]);
assert.equal(Object.hasOwn(missingFoundationState, "stage1TrialParticipationState"), false);

const noIngressState = makeState(20260926);
registerFoundation(noIngressState);
const noIngressFactory = new TrialScenarioFactory({
    threatResolver: new TrialThreatResolver({ baseThreatByTrial: { 1: 20 } }),
    enemyParticipationAdapter: adapter,
    ingressResolver: { listCandidates: () => [], resolve: () => [] },
    routeGenerator: new TrialRouteGenerator({ costResolver: () => 1 }),
    suppressionAllocator: new TrialRouteSuppressionAllocator()
});
const noIngress = noIngressFactory.build({ trialIndex: 1, gameState: noIngressState });
assert.equal(noIngress.success, false);
assert.equal(Object.hasOwn(noIngressState, "stage1TrialParticipationState"), false);
assert.equal(noIngressState.enemyInvasionFoundationState.consolidations.length, 0);

console.log("Stage1 threat/participation production integration v1: PASS");
