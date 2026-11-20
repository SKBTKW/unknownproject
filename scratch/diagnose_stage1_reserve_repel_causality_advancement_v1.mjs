import { pathToFileURL } from "node:url";
import { createBattleContext } from "../game/src/trial/domain/battle_context.js";
import {
    TRIAL_BATTLE_STATUSES,
    TRIAL_ROUTE_PLAN_STATUSES
} from "../game/src/trial/domain/trial_types.js";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { InterceptionPowerResolver } from "../game/src/trial/systems/interception_power_resolver.js";
import { TrialCombatResolver } from "../game/src/trial/systems/trial_combat_resolver.js";
import { BattleResolutionSnapshotFactory } from "../game/src/trial/systems/battle_resolution_snapshot_factory.js";
import { TrialEnemyAdvanceService } from "../game/src/trial/systems/trial_enemy_advance_service.js";
import { TrialHqArrivalAggregationService } from "../game/src/trial/systems/trial_hq_arrival_aggregation_service.js";
import { TrialRestoreBoundaryService } from "../game/src/core/trial_restore_boundary_service.js";

const interactionResolver = new EnemyForceTerrainInteractionResolver();
const deploymentResolver = new EnemyForceDeploymentResolver();
const powerResolver = new InterceptionPowerResolver();
const combatResolver = new TrialCombatResolver();
const snapshotFactory = new BattleResolutionSnapshotFactory();
const advanceService = new TrialEnemyAdvanceService();
const aggregationService = new TrialHqArrivalAggregationService();

const TERRAIN = Object.freeze({
    OPEN: Object.freeze({ terrainId: "GL1_PLAINS", e: 1, gl: 1 }),
    FOREST: Object.freeze({ terrainId: "GL2_FOREST", e: 1, gl: 2 }),
    DEEP_FOREST: Object.freeze({ terrainId: "GL3_DEEP_FOREST", e: 1, gl: 3 })
});

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function routeState(routeId, combatResult) {
    return {
        planActivated: true,
        currentBattleIndex: 0,
        interceptionPlan: {
            routes: [{
                routeId,
                status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
                interceptCell: { r: 0, c: 0 },
                defenseAllocation: 0
            }]
        },
        routes: [{
            id: routeId,
            cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]
        }],
        battleQueue: [{
            routeId,
            interceptCell: { r: 0, c: 0 },
            status: TRIAL_BATTLE_STATUSES.RESOLVED
        }],
        battleResults: [clone(combatResult)],
        traversalResults: []
    };
}

function typeList(rows) {
    return (rows || []).map(row => row?.type).filter(Boolean);
}

function resolveFixture({
    id,
    label,
    terrain,
    bodySize = "LARGE",
    equipment = ["HEAVY"],
    strategicSuppression = 20,
    baseHumanInterception
}) {
    const terrainCell = TERRAIN[terrain];
    const interaction = interactionResolver.resolve({
        bodySize,
        equipment,
        terrainId: terrainCell.terrainId
    });
    const deployment = deploymentResolver.resolve({
        forceSuppression: strategicSuppression,
        interaction
    });
    const deployedCombatSuppression = powerResolver.resolveSuppression(deployment.deployedSuppression);
    const reserveCombatSuppression = powerResolver.resolveSuppression(deployment.reserveSuppression);
    const battleContext = createBattleContext({
        interceptCell: {
            id: `${id}:intercept`,
            r: 0,
            c: 0,
            terrain: terrainCell
        },
        approachCell: {
            id: `${id}:approach`,
            r: 0,
            c: 1,
            terrain: terrainCell
        },
        allocatedDefense: baseHumanInterception / powerResolver.defenseConversionRate,
        baseInterceptionPower: baseHumanInterception,
        enemySuppression: deployedCombatSuppression,
        enemyStrategicSuppression: strategicSuppression,
        enemyReserveSuppression: reserveCombatSuppression,
        enemyDeployment: {
            profile: { bodySize, equipment: [...equipment] },
            interaction,
            deployment
        }
    });
    const combatResult = combatResolver.resolve(battleContext);
    const snapshot = snapshotFactory.create({
        battleId: `audit:${id}`,
        routeId: `route:${id}`,
        battleContext,
        combatResult,
        actions: [{
            actionId: `audit:${id}:intercept`,
            type: "INTERCEPT",
            actor: "HUMAN",
            target: "ENEMY_FORCE",
            location: { r: 0, c: 0 }
        }]
    });
    const state = routeState(`route:${id}`, combatResult);
    const advanced = advanceService.advanceAfterBattle(state);
    state.battleQueue[0].sequenceAdvanced = true;
    const aggregation = aggregationService.collect(state);

    return {
        id,
        label,
        fixtureClassification: "DEVELOPMENT_FIXED_INPUT",
        profile: `${bodySize} / ${interaction.equipmentClass}`,
        terrain,
        totalSuppression: strategicSuppression,
        totalCombatSuppression: powerResolver.resolveSuppression(strategicSuppression),
        deployedSuppression: deployment.deployedSuppression,
        deployedCombatSuppression,
        reserveSuppression: deployment.reserveSuppression,
        reserveCombatSuppression,
        deploymentRatio: deployment.deploymentRatio,
        terrainAdjustedCombatPower: combatResult.enemySuppression,
        humanInterception: combatResult.humanInterception,
        normalOutcome: combatResult.prediction.outcome,
        damageToSuppression: combatResult.damageToSuppression,
        remainingDeployedSuppression: combatResult.remainingSuppression,
        remainingTotalForceSuppression: combatResult.remainingForceSuppression,
        traversalSuppression: advanced.traversalResult.remainingForceSuppression,
        routeStopped: advanced.traversalResult.stopped,
        reachedRouteEnd: advanced.traversalResult.reachedRouteEnd,
        hqArrivalSuppression: aggregation.totalSourcePower,
        facts: typeList(snapshot.initialFacts),
        causes: typeList(snapshot.causes),
        consequences: typeList(snapshot.consequences),
        battleState: clone(snapshot.battleState),
        normalOutcomeSnapshot: clone(snapshot.normalOutcome),
        snapshotSuppressionUnits: {
            strategic: snapshot.battlefieldContext.enemy.strategicSuppression,
            deployed: snapshot.battlefieldContext.enemy.deployedSuppression,
            reserve: snapshot.battlefieldContext.enemy.reserveSuppression,
            combatRemainingForce: snapshot.normalOutcome.remainingForceSuppression
        },
        snapshotFrozen: Object.isFrozen(snapshot)
            && Object.isFrozen(snapshot.normalOutcome)
            && Object.isFrozen(snapshot.battlefieldContext)
    };
}

function resolveMultipleRoutes(repelled, breakthrough) {
    const routeIds = ["route:F:repel", "route:F:breakthrough"];
    const combatResults = [repelled, breakthrough].map(row => ({
        prediction: { outcome: row.normalOutcome },
        remainingSuppression: row.remainingDeployedSuppression,
        remainingForceSuppression: row.remainingTotalForceSuppression,
        enemy: { remainingForceSuppression: row.remainingTotalForceSuppression }
    }));
    const state = {
        planActivated: true,
        currentBattleIndex: 0,
        interceptionPlan: {
            routes: routeIds.map(routeId => ({
                routeId,
                status: TRIAL_ROUTE_PLAN_STATUSES.INTERCEPT,
                interceptCell: { r: 0, c: 0 },
                defenseAllocation: 0
            }))
        },
        routes: routeIds.map((id, index) => ({
            id,
            cells: [{ r: index, c: 0 }, { r: index, c: 1 }, { r: index, c: 2 }]
        })),
        battleQueue: routeIds.map((routeId, index) => ({
            routeId,
            interceptCell: { r: index, c: 0 },
            status: TRIAL_BATTLE_STATUSES.RESOLVED
        })),
        battleResults: clone(combatResults),
        traversalResults: []
    };

    const traversals = [];
    for (let index = 0; index < routeIds.length; index += 1) {
        state.currentBattleIndex = index;
        traversals.push(advanceService.advanceAfterBattle(state).traversalResult);
        state.battleQueue[index].sequenceAdvanced = true;
    }
    state.currentBattleIndex = null;
    const aggregation = aggregationService.collect(state);
    return {
        fixtureClassification: "DEVELOPMENT_FIXED_INPUT",
        routeCount: routeIds.length,
        traversals,
        arrivals: aggregation.arrivals,
        hqArrivalSuppression: aggregation.totalSourcePower,
        routeStatesIndependent: traversals[0].stopped === true
            && traversals[1].reachedRouteEnd === true
    };
}

function resolveCases() {
    const cases = [
        resolveFixture({
            id: "A",
            label: "Open terrain normal engagement",
            terrain: "OPEN",
            baseHumanInterception: 105
        }),
        resolveFixture({
            id: "B",
            label: "Large heavy force in forest is locally repelled",
            terrain: "FOREST",
            baseHumanInterception: 50
        }),
        resolveFixture({
            id: "C",
            label: "Large heavy force in deep forest is locally repelled",
            terrain: "DEEP_FOREST",
            baseHumanInterception: 35
        }),
        resolveFixture({
            id: "D",
            label: "Large heavy force breaks through forest interception",
            terrain: "FOREST",
            baseHumanInterception: 20
        }),
        resolveFixture({
            id: "E_WITH_RESERVE",
            label: "Exact result with reserve",
            terrain: "FOREST",
            baseHumanInterception: 45
        }),
        resolveFixture({
            id: "E_WITHOUT_RESERVE",
            label: "Exact result without reserve",
            terrain: "OPEN",
            bodySize: "MEDIUM",
            equipment: ["STANDARD"],
            baseHumanInterception: 100
        })
    ];
    return cases;
}

export function runStage1ReserveRepelCausalityAdvancementAudit() {
    const cases = resolveCases();
    const byId = Object.fromEntries(cases.map(row => [row.id, row]));
    const multipleRoutes = resolveMultipleRoutes(byId.B, byId.D);

    const restoreEngine = { state: { turn: 15 } };
    const restoreBoundary = new TrialRestoreBoundaryService(restoreEngine);
    restoreBoundary.begin();
    const redirectedRestoreVerse = restoreBoundary.resolveRestoreVerse(16);
    const replay = resolveCases();

    return {
        productionMutation: false,
        fixtureClassification: "DEVELOPMENT_FIXED_INPUT",
        units: {
            strategic: "route strategic suppression before InterceptionPowerResolver conversion",
            combat: `strategic suppression x ${powerResolver.suppressionConversionRate}`,
            terrainAdjusted: "combat suppression after TrialTerrainEffectResolver modifiers"
        },
        cases,
        multipleRoutes,
        saveRestore: {
            activeTrialRestorePolicy: "RESTORE_TO_TRIAL_START_VERSE",
            trialStartVerse: restoreBoundary.getStartVerse(),
            requestedRestoreVerse: 16,
            redirectedRestoreVerse,
            deterministicReplay: JSON.stringify(cases) === JSON.stringify(replay),
            midBattleTrialStateSerialized: false
        },
        centralFinding: {
            localOutcome: byId.B.normalOutcome,
            combatReservePreserved: byId.B.reserveCombatSuppression,
            combatRemainingForcePreserved: byId.B.remainingTotalForceSuppression,
            traversalSuppression: byId.B.traversalSuppression,
            routeStopped: byId.B.routeStopped,
            hqArrivalSuppression: byId.B.hqArrivalSuppression
        }
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log(JSON.stringify(runStage1ReserveRepelCausalityAdvancementAudit(), null, 2));
}
