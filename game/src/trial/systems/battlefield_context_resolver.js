import { BattlefieldCapabilityProjector, familyFromTerrainId } from "./battlefield_capability_projector.js";
import { RelativeEngagementResolver } from "./relative_engagement_resolver.js";

function finiteOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function cloneData(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function projectCell(cell) {
    if (!cell) return null;
    const row = Number.isInteger(cell.row) ? cell.row : (Number.isInteger(cell.r) ? cell.r : null);
    const column = Number.isInteger(cell.column) ? cell.column : (Number.isInteger(cell.c) ? cell.c : null);
    const terrainId = cell.terrainId || cell.terrain?.terrainId || cell.terrain?.id || null;
    const e = finiteOrNull(cell.e ?? cell.elevation ?? cell.terrain?.e);
    const gl = finiteOrNull(cell.gl ?? cell.growthLevel ?? cell.terrain?.gl);
    return {
        cellId: cell.cellId || cell.id || null,
        row,
        column,
        r: row,
        c: column,
        terrainId,
        terrainFamily: familyFromTerrainId(terrainId),
        e,
        gl,
        elevation: e,
        growthLevel: gl,
        engagementCapabilities: Array.isArray(cell.engagementCapabilities)
            ? [...cell.engagementCapabilities]
            : []
    };
}

function projectTerrainInteraction(interaction) {
    if (!interaction || typeof interaction !== "object") return null;
    return {
        terrainId: interaction.terrainId || null,
        terrainFamily: interaction.terrainFamily || null,
        bodySize: interaction.bodySize || null,
        equipmentClass: interaction.equipmentClass || null,
        deployment: interaction.deployment || null,
        mobility: interaction.mobility || null,
        equipmentDeployment: interaction.equipmentDeployment || null,
        equipmentMobility: interaction.equipmentMobility || null,
        contactProfile: interaction.contactProfile || null,
        logistics: interaction.logistics || null,
        combatTraits: Array.isArray(interaction.combatTraits) ? [...interaction.combatTraits] : [],
        movementConstraints: Array.isArray(interaction.movementConstraints)
            ? [...interaction.movementConstraints]
            : []
    };
}

function projectFutureInputs(input = {}) {
    const keys = [
        "initiative",
        "investigationEarlyDetection",
        "weather",
        "visibility",
        "groundCondition",
        "timeBand",
        "cumulativeMovementCost",
        "arrivalTiming",
        "formationStretch",
        "commanderPersonality",
        "commandDisruption",
        "maneuverSemantics",
        "zoneContinuity",
        "terrainDepth",
        "tacticalDepth",
        "linkedTerrainNetwork",
        "tacticalContinuity",
        "battlefieldObjects"
    ];
    const result = {};
    for (const key of keys) {
        if (input[key] !== undefined) result[key] = cloneData(input[key]);
    }
    return result;
}

/**
 * Projects only battle-facing data already consumed by the normal battle.
 * Hidden Enemy Truth is deliberately not retained in this read model.
 */
export class BattlefieldContextResolver {
    constructor({
        capabilityProjector = new BattlefieldCapabilityProjector(),
        relativeEngagementResolver = new RelativeEngagementResolver()
    } = {}) {
        this.capabilityProjector = capabilityProjector;
        this.relativeEngagementResolver = relativeEngagementResolver;
    }

    resolve({ battleId = null, routeId = null, battleContext = {}, combatResult = {}, futureInputs = {} } = {}) {
        const interaction = battleContext.enemy?.deployment?.interaction || null;
        const deployment = battleContext.enemy?.deployment?.deployment || null;
        const interceptTerrain = projectCell(battleContext.interceptCell);
        const approachTerrain = projectCell(battleContext.approachCell);
        const humanOriginTerrain = projectCell(battleContext.humanEngagementOrigin);
        const spatialEngagement = this.relativeEngagementResolver.resolve({
            battleLocation: interceptTerrain,
            enemyApproach: approachTerrain,
            humanEngagementOrigin: humanOriginTerrain
        });

        const strategicSuppression = finiteOrNull(
            battleContext.enemy?.strategicSuppression
                ?? deployment?.totalSuppression
        );
        const deployedSuppression = finiteOrNull(
            deployment?.deployedSuppression
                ?? battleContext.enemy?.suppression
        );
        const reserveSuppression = finiteOrNull(
            deployment?.reserveSuppression
                ?? battleContext.enemy?.reserveSuppression
        );
        const deploymentRatio = finiteOrNull(deployment?.deploymentRatio);

        return {
            battleId,
            routeId,
            interceptionLocation: interceptTerrain,
            battleLocation: interceptTerrain,
            enemyApproach: approachTerrain,
            humanEngagementOrigin: humanOriginTerrain,
            spatialEngagement,
            interceptTerrain,
            approachTerrain,
            battlefieldCapabilities: {
                intercept: this.capabilityProjector.project(interceptTerrain),
                approach: this.capabilityProjector.project(approachTerrain),
                humanOrigin: this.capabilityProjector.project(humanOriginTerrain)
            },
            enemy: {
                bodySize: interaction?.bodySize
                    || battleContext.enemy?.deployment?.profile?.bodySize
                    || null,
                equipmentClass: interaction?.equipmentClass || null,
                terrainInteraction: projectTerrainInteraction(interaction),
                deployedSuppression,
                reserveSuppression,
                strategicSuppression,
                deploymentRatio
            },
            human: {
                defenseAllocation: finiteOrNull(battleContext.human?.allocatedDefense),
                baseInterceptionPower: finiteOrNull(battleContext.human?.baseInterceptionPower),
                finalPower: finiteOrNull(combatResult.human?.finalPower ?? combatResult.humanInterception)
            },
            combat: {
                enemyFinalPower: finiteOrNull(combatResult.enemy?.finalPower ?? combatResult.enemySuppression),
                margin: finiteOrNull(combatResult.prediction?.margin),
                outcome: combatResult.prediction?.outcome || null,
                damageToSuppression: finiteOrNull(combatResult.damageToSuppression),
                remainingSuppression: finiteOrNull(combatResult.remainingSuppression),
                remainingForceSuppression: finiteOrNull(
                    combatResult.remainingForceSuppression
                        ?? combatResult.enemy?.remainingForceSuppression
                ),
                appliedModifiers: cloneData(combatResult.appliedModifiers || []),
                terrainEvents: cloneData(combatResult.events || [])
            },
            futureInputs: projectFutureInputs(futureInputs)
        };
    }
}

export default BattlefieldContextResolver;
