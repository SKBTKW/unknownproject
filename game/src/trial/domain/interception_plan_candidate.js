import { createTacticRequirement } from "./tactic_requirement.js";

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

function point(value) {
    const cell = value?.cell || value;
    const r = Number.isInteger(cell?.r) ? cell.r : cell?.row;
    const c = Number.isInteger(cell?.c) ? cell.c : cell?.column;
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return { r, c, cellId: cell?.cellId || cell?.id || null };
}

function list(value) {
    return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : [];
}

function finiteOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Pre-battle semantic candidate for "how to intercept at this battleLocation".
 *
 * This is deliberately NOT a battle result and NOT a pathfinding object.
 * It preserves the internal causal chain:
 * Deployment Origin -> Maneuver -> humanEngagementOrigin -> battleLocation,
 * while keeping tactic intent distinct from tactic success.
 */
export function createInterceptionPlanCandidate({
    planId = null,
    battleLocation = null,
    deploymentOrigin = null,
    maneuver = {},
    humanEngagementOrigin = null,
    initialPositioning = null,
    tacticIntent = null,
    requirements = {},
    capabilities = [],
    infrastructure = [],
    burden = {},
    provenance = null
} = {}) {
    const normalizedBattleLocation = point(battleLocation);
    if (!normalizedBattleLocation) {
        throw new TypeError("INTERCEPTION_PLAN_BATTLE_LOCATION_REQUIRED");
    }

    const normalizedHumanOrigin = humanEngagementOrigin
        ? point(humanEngagementOrigin)
        : null;
    if (humanEngagementOrigin && !normalizedHumanOrigin) {
        throw new TypeError("INTERCEPTION_PLAN_HUMAN_ENGAGEMENT_ORIGIN_INVALID");
    }

    const normalizedManeuver = {
        routeRef: maneuver?.routeRef || maneuver?.routeId || null,
        routeLength: finiteOrNull(maneuver?.routeLength),
        movementCost: finiteOrNull(maneuver?.movementCost),
        semantics: list(maneuver?.semantics),
        terrainSemantics: list(maneuver?.terrainSemantics)
    };

    const normalizedBurden = {
        deploymentCost: finiteOrNull(burden?.deploymentCost),
        movementCost: finiteOrNull(
            burden?.movementCost ?? normalizedManeuver.movementCost
        ),
        arrivalCost: finiteOrNull(burden?.arrivalCost)
    };

    const requirement = createTacticRequirement({
        requiredContext: requirements?.requiredContext,
        requiredCapabilities: requirements?.requiredCapabilities,
        requiredDeployment: requirements?.requiredDeployment,
        requiredStates: requirements?.requiredStates,
        requiredInfrastructure: requirements?.requiredInfrastructure,
        requiredTiming: requirements?.requiredTiming
    });

    return deepFreeze({
        planId,
        battleLocation: normalizedBattleLocation,
        deploymentOrigin: clone(deploymentOrigin),
        maneuver: normalizedManeuver,
        humanEngagementOrigin: normalizedHumanOrigin,
        initialPositioning: initialPositioning || null,
        tacticIntent: tacticIntent || null,
        requirements: requirement,
        capabilities: list(capabilities),
        infrastructure: list(infrastructure),
        burden: normalizedBurden,
        provenance: clone(provenance)
    });
}

/**
 * Minimal projection intended for a future runtime adapter.
 * No combat result, tactic success, dice or outcome is produced here.
 */
export function projectInterceptionPlanSelection(candidate) {
    if (!candidate || typeof candidate !== "object") {
        throw new TypeError("INTERCEPTION_PLAN_CANDIDATE_REQUIRED");
    }
    return deepFreeze({
        planId: candidate.planId ?? null,
        battleLocation: clone(candidate.battleLocation),
        deploymentOrigin: clone(candidate.deploymentOrigin),
        humanEngagementOrigin: clone(candidate.humanEngagementOrigin),
        tacticIntent: candidate.tacticIntent ?? null,
        initialPositioning: candidate.initialPositioning ?? null
    });
}

export default createInterceptionPlanCandidate;
