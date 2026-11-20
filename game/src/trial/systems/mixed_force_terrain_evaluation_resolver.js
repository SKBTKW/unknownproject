import {
    ENEMY_BLUEPRINT_SPECIES,
    validateForceComposition
} from "../domain/enemy_army_blueprint.js";
import {
    ACTIVE_EQUIPMENT_TYPES,
    EnemyForceTerrainInteractionResolver
} from "./enemy_force_terrain_interaction_resolver.js";
import { EnemyForceDeploymentResolver } from "./enemy_force_deployment_resolver.js";

export const MIXED_FORCE_EVALUATION_MODES = Object.freeze({
    PRIMARY_SOURCE: "PRIMARY_SOURCE",
    INDEPENDENT_MARGINALS: "INDEPENDENT_MARGINALS",
    EXPLICIT_JOINT_HYPOTHESIS: "EXPLICIT_JOINT_HYPOTHESIS"
});

export const MIXED_FORCE_EVALUATION_POLICY = Object.freeze({
    id: "mixed-force-terrain-evaluation-foundation-v1",
    version: 1,
    productionConnected: false
});

const MODES = new Set(Object.values(MIXED_FORCE_EVALUATION_MODES));

function clone(value) {
    return structuredClone(value);
}

function freezeDeep(value) {
    Object.values(value).forEach(child => {
        if (child && typeof child === "object") freezeDeep(child);
    });
    return Object.freeze(value);
}

function validateParticipant(participatingForce) {
    if (!participatingForce || typeof participatingForce.id !== "string" || !participatingForce.id
        || typeof participatingForce.primarySourceForceId !== "string"
        || !Array.isArray(participatingForce.sourceForceIds)
        || participatingForce.sourceForceIds.length === 0
        || new Set(participatingForce.sourceForceIds).size !== participatingForce.sourceForceIds.length
        || !Array.isArray(participatingForce.sourceForces)
        || participatingForce.sourceForces.length !== participatingForce.sourceForceIds.length) {
        throw new TypeError("MIXED_FORCE_EVALUATION_PARTICIPANT_INVALID");
    }
    const sourceIds = participatingForce.sourceForces.map(source => source?.id);
    if (sourceIds.some(id => typeof id !== "string" || !id)
        || new Set(sourceIds).size !== sourceIds.length
        || participatingForce.sourceForceIds.some(id => !sourceIds.includes(id))
        || !sourceIds.includes(participatingForce.primarySourceForceId)) {
        throw new TypeError("MIXED_FORCE_EVALUATION_SOURCE_IDENTITY_INVALID");
    }
    for (const source of participatingForce.sourceForces) {
        validateForceComposition(source.composition);
    }
}

function evaluateProfile({ bodySize, equipment, terrainId, interactionResolver, deploymentResolver }) {
    const interaction = interactionResolver.resolve({ bodySize, equipment, terrainId });
    const deployment = deploymentResolver.resolve({ forceSuppression: 1, interaction });
    return {
        bodySize: interaction.bodySize,
        equipmentClass: interaction.equipmentClass,
        interaction,
        deploymentRatio: deployment.deploymentRatio
    };
}

function marginalMap(rows) {
    return new Map(rows.map(row => [row.type, row.share]));
}

function validateJointHypothesis(rows, source) {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_HYPOTHESIS_INVALID");
    }
    let total = 0;
    const speciesTotals = new Map(ENEMY_BLUEPRINT_SPECIES.map(type => [type, 0]));
    const equipmentTotals = new Map(ACTIVE_EQUIPMENT_TYPES.map(type => [type, 0]));
    const pairs = new Set();
    for (const row of rows) {
        if (!row || !ENEMY_BLUEPRINT_SPECIES.includes(row.species)
            || !ACTIVE_EQUIPMENT_TYPES.includes(row.equipment)
            || !Number.isFinite(row.share) || row.share <= 0 || row.share > 1) {
            throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_HYPOTHESIS_INVALID");
        }
        const pair = `${row.species}:${row.equipment}`;
        if (pairs.has(pair)) throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_HYPOTHESIS_DUPLICATE");
        pairs.add(pair);
        total += row.share;
        speciesTotals.set(row.species, speciesTotals.get(row.species) + row.share);
        equipmentTotals.set(row.equipment, equipmentTotals.get(row.equipment) + row.share);
    }
    if (Math.abs(total - 1) > 1e-12) {
        throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_HYPOTHESIS_TOTAL_INVALID");
    }
    const expectedSpecies = marginalMap(source.composition.speciesComposition);
    const expectedEquipment = marginalMap(source.composition.equipmentComposition);
    for (const type of ENEMY_BLUEPRINT_SPECIES) {
        if (Math.abs((speciesTotals.get(type) || 0) - (expectedSpecies.get(type) || 0)) > 1e-12) {
            throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_SPECIES_MISMATCH");
        }
    }
    for (const type of ACTIVE_EQUIPMENT_TYPES) {
        if (Math.abs((equipmentTotals.get(type) || 0) - (expectedEquipment.get(type) || 0)) > 1e-12) {
            throw new TypeError("MIXED_FORCE_EVALUATION_JOINT_EQUIPMENT_MISMATCH");
        }
    }
}

function validateSourceSuppression(sourceSuppressionById, participatingForce) {
    if (sourceSuppressionById === null || sourceSuppressionById === undefined) return null;
    const ids = Object.keys(sourceSuppressionById);
    if (ids.length !== participatingForce.sourceForceIds.length
        || participatingForce.sourceForceIds.some(id => !Object.hasOwn(sourceSuppressionById, id))) {
        throw new TypeError("MIXED_FORCE_EVALUATION_SOURCE_SUPPRESSION_INVALID");
    }
    const values = Object.fromEntries(ids.map(id => [id, Number(sourceSuppressionById[id])]));
    if (Object.values(values).some(value => !Number.isFinite(value) || value < 0)) {
        throw new TypeError("MIXED_FORCE_EVALUATION_SOURCE_SUPPRESSION_INVALID");
    }
    if (Number.isFinite(participatingForce.strategicSuppression)) {
        const total = Object.values(values).reduce((sum, value) => sum + value, 0);
        if (Math.abs(total - participatingForce.strategicSuppression) > 1e-9) {
            throw new TypeError("MIXED_FORCE_EVALUATION_SOURCE_SUPPRESSION_TOTAL_MISMATCH");
        }
    }
    return values;
}

export class MixedForceTerrainEvaluationResolver {
    constructor({
        interactionResolver = new EnemyForceTerrainInteractionResolver(),
        deploymentResolver = new EnemyForceDeploymentResolver()
    } = {}) {
        this.interactionResolver = interactionResolver;
        this.deploymentResolver = deploymentResolver;
    }

    resolve({
        participatingForce,
        terrainId,
        mode = MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS,
        jointHypothesesBySource = {},
        sourceSuppressionById = null
    } = {}) {
        validateParticipant(participatingForce);
        if (typeof terrainId !== "string" || !terrainId || !MODES.has(mode)) {
            throw new TypeError("MIXED_FORCE_EVALUATION_INPUT_INVALID");
        }
        const allocations = validateSourceSuppression(sourceSuppressionById, participatingForce);
        const sources = participatingForce.sourceForces.map(source => ({
            sourceForceId: source.id,
            composition: clone(source.composition)
        }));

        if (mode === MIXED_FORCE_EVALUATION_MODES.PRIMARY_SOURCE) {
            const profile = participatingForce.profile;
            if (!profile || typeof profile.bodySize !== "string" || !Array.isArray(profile.equipment)) {
                throw new TypeError("MIXED_FORCE_EVALUATION_PRIMARY_PROFILE_INVALID");
            }
            const evaluation = evaluateProfile({
                bodySize: profile.bodySize,
                equipment: profile.equipment,
                terrainId,
                interactionResolver: this.interactionResolver,
                deploymentResolver: this.deploymentResolver
            });
            return freezeDeep({
                schemaVersion: 1,
                policy: { ...MIXED_FORCE_EVALUATION_POLICY, mode },
                participantUnitId: participatingForce.id,
                primarySourceForceId: participatingForce.primarySourceForceId,
                sourceForceIds: [...participatingForce.sourceForceIds],
                terrainId,
                sources,
                primarySourceEvaluation: evaluation,
                sourceEvaluations: [],
                participantAggregate: Number.isFinite(participatingForce.strategicSuppression)
                    ? {
                        strategicSuppression: participatingForce.strategicSuppression,
                        deploymentRatio: evaluation.deploymentRatio,
                        deployedSuppression: participatingForce.strategicSuppression * evaluation.deploymentRatio,
                        reserveSuppression: participatingForce.strategicSuppression * (1 - evaluation.deploymentRatio)
                    }
                    : null,
                limitations: ["NON_PRIMARY_SOURCE_COMPOSITION_NOT_EVALUATED"]
            });
        }

        const sourceEvaluations = participatingForce.sourceForces.map(source => {
            const speciesAxis = source.composition.speciesComposition.map(row => ({
                type: row.type,
                share: row.share,
                evaluation: evaluateProfile({
                    bodySize: row.type,
                    equipment: ["STANDARD"],
                    terrainId,
                    interactionResolver: this.interactionResolver,
                    deploymentResolver: this.deploymentResolver
                })
            }));
            const equipmentAxis = source.composition.equipmentComposition.map(row => ({
                type: row.type,
                share: row.share,
                evaluation: evaluateProfile({
                    bodySize: "MEDIUM",
                    equipment: [row.type],
                    terrainId,
                    interactionResolver: this.interactionResolver,
                    deploymentResolver: this.deploymentResolver
                })
            }));
            const base = {
                sourceForceId: source.id,
                composition: clone(source.composition),
                speciesAxis,
                equipmentAxis,
                allocatedSuppression: allocations?.[source.id] ?? null
            };
            if (mode === MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS) {
                return {
                    ...base,
                    jointCompositionStatus: "UNKNOWN",
                    combinedDeploymentRatio: null,
                    deployedSuppression: null,
                    reserveSuppression: null
                };
            }

            const jointRows = jointHypothesesBySource[source.id];
            validateJointHypothesis(jointRows, source);
            const jointEvaluations = jointRows.map(row => ({
                species: row.species,
                equipment: row.equipment,
                share: row.share,
                evaluation: evaluateProfile({
                    bodySize: row.species,
                    equipment: [row.equipment],
                    terrainId,
                    interactionResolver: this.interactionResolver,
                    deploymentResolver: this.deploymentResolver
                })
            }));
            const combinedDeploymentRatio = jointEvaluations.reduce(
                (sum, row) => sum + row.share * row.evaluation.deploymentRatio,
                0
            );
            const allocatedSuppression = allocations?.[source.id] ?? null;
            return {
                ...base,
                jointCompositionStatus: "EXPLICIT_HYPOTHESIS",
                jointEvaluations,
                combinedDeploymentRatio,
                deployedSuppression: allocatedSuppression === null
                    ? null : allocatedSuppression * combinedDeploymentRatio,
                reserveSuppression: allocatedSuppression === null
                    ? null : allocatedSuppression * (1 - combinedDeploymentRatio)
            };
        });

        const canAggregate = mode === MIXED_FORCE_EVALUATION_MODES.EXPLICIT_JOINT_HYPOTHESIS
            && allocations !== null;
        const deployedSuppression = canAggregate
            ? sourceEvaluations.reduce((sum, row) => sum + row.deployedSuppression, 0)
            : null;
        const strategicSuppression = canAggregate
            ? Object.values(allocations).reduce((sum, value) => sum + value, 0)
            : null;
        return freezeDeep({
            schemaVersion: 1,
            policy: { ...MIXED_FORCE_EVALUATION_POLICY, mode },
            participantUnitId: participatingForce.id,
            primarySourceForceId: participatingForce.primarySourceForceId,
            sourceForceIds: [...participatingForce.sourceForceIds],
            terrainId,
            sources,
            primarySourceEvaluation: null,
            sourceEvaluations,
            participantAggregate: canAggregate ? {
                strategicSuppression,
                deployedSuppression,
                reserveSuppression: strategicSuppression - deployedSuppression
            } : null,
            limitations: mode === MIXED_FORCE_EVALUATION_MODES.INDEPENDENT_MARGINALS
                ? [
                    "JOINT_SPECIES_EQUIPMENT_COMPOSITION_UNKNOWN",
                    "SOURCE_SUPPRESSION_ALLOCATION_NOT_INFERRED",
                    "NO_COMBINED_GAMEPLAY_VALUE"
                ]
                : allocations === null
                    ? ["SOURCE_SUPPRESSION_ALLOCATION_REQUIRED_FOR_PARTICIPANT_AGGREGATE"]
                    : ["JOINT_COMPOSITION_IS_DIAGNOSTIC_HYPOTHESIS"]
        });
    }
}

export default MixedForceTerrainEvaluationResolver;
