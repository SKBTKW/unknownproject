import { createInterceptionPlanCandidate } from "../domain/interception_plan_candidate.js";
import { InterceptionPlanCandidateCompactor } from "./interception_plan_candidate_compactor.js";
import { TacticRequirementEvaluator } from "./tactic_requirement_evaluator.js";

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function unique(...sources) {
    return [...new Set(sources.flatMap(source => list(source)))];
}

function deploymentEvidence(origin, maneuver) {
    return {
        originType: origin?.originType || null,
        capabilities: unique(origin?.capabilities),
        infrastructure: unique(origin?.infrastructure),
        route: clone(maneuver?.deployment || maneuver?.routeDeployment || {})
    };
}

/**
 * Composes already-existing semantic providers into interception-plan candidates.
 *
 * Dependencies own their own truths:
 * - DeploymentOriginResolver / Board Query owns available origins.
 * - maneuverProvider owns route/maneuver proposals (this class does no pathfinding).
 * - TacticRequirementEvaluator owns prerequisite matching only.
 * - Compactor owns semantic representative compression.
 *
 * This generator does not decide tactic success, Battle Outcome, dice, or UI.
 */
export class InterceptionPlanCandidateGenerator {
    constructor({
        deploymentOriginResolver,
        maneuverProvider,
        requirementEvaluator = new TacticRequirementEvaluator(),
        compactor = new InterceptionPlanCandidateCompactor()
    } = {}) {
        this.deploymentOriginResolver = deploymentOriginResolver || null;
        this.maneuverProvider = maneuverProvider || null;
        this.requirementEvaluator = requirementEvaluator;
        this.compactor = compactor;
    }

    generate({
        battleLocation = null,
        context = {},
        contextFacts = [],
        capabilities = [],
        states = [],
        infrastructure = [],
        timing = []
    } = {}) {
        if (!battleLocation) {
            return {
                success: false,
                reason: "BATTLE_LOCATION_REQUIRED",
                candidates: [],
                rejected: []
            };
        }
        if (!this.deploymentOriginResolver?.resolveCandidates) {
            return {
                success: false,
                reason: "DEPLOYMENT_ORIGIN_RESOLVER_UNAVAILABLE",
                candidates: [],
                rejected: []
            };
        }
        if (!this.maneuverProvider || typeof this.maneuverProvider.listManeuvers !== "function") {
            return {
                success: false,
                reason: "MANEUVER_PROVIDER_UNAVAILABLE",
                candidates: [],
                rejected: []
            };
        }

        const origins = this.deploymentOriginResolver.resolveCandidates({
            ...context,
            battleLocation
        });
        if (!origins.success) {
            return {
                success: false,
                reason: origins.reason,
                candidates: [],
                rejected: []
            };
        }

        const accepted = [];
        const rejected = [];

        for (const origin of origins.candidates) {
            const maneuvers = this.maneuverProvider.listManeuvers({
                deploymentOrigin: clone(origin),
                battleLocation: clone(battleLocation),
                context: clone(context)
            });
            if (!Array.isArray(maneuvers)) continue;

            for (const maneuver of maneuvers) {
                const requirement = maneuver?.requirements || {};
                const effectiveCapabilities = unique(
                    capabilities,
                    origin?.capabilities,
                    maneuver?.capabilities
                );
                const effectiveInfrastructure = unique(
                    infrastructure,
                    origin?.infrastructure,
                    maneuver?.infrastructure
                );
                const evaluation = this.requirementEvaluator.evaluate({
                    requirement,
                    context: unique(contextFacts, maneuver?.contextFacts),
                    capabilities: effectiveCapabilities,
                    deployment: deploymentEvidence(origin, maneuver),
                    states: unique(states, maneuver?.states),
                    infrastructure: effectiveInfrastructure,
                    timing: unique(timing, maneuver?.timing)
                });

                if (!evaluation.eligible) {
                    rejected.push({
                        deploymentOrigin: clone(origin),
                        maneuverRef: maneuver?.routeRef || maneuver?.routeId || null,
                        tacticIntent: maneuver?.tacticIntent || null,
                        reasons: clone(evaluation.reasons)
                    });
                    continue;
                }

                accepted.push(createInterceptionPlanCandidate({
                    planId: maneuver?.planId || null,
                    battleLocation,
                    deploymentOrigin: origin,
                    maneuver,
                    humanEngagementOrigin: maneuver?.humanEngagementOrigin || null,
                    initialPositioning: maneuver?.initialPositioning || null,
                    tacticIntent: maneuver?.tacticIntent || null,
                    requirements: requirement,
                    capabilities: effectiveCapabilities,
                    infrastructure: effectiveInfrastructure,
                    burden: maneuver?.burden || {
                        deploymentCost: maneuver?.deploymentCost,
                        movementCost: maneuver?.movementCost,
                        arrivalCost: maneuver?.arrivalCost
                    },
                    provenance: {
                        source: "INTERCEPTION_PLAN_CANDIDATE_GENERATOR",
                        originRef: origin?.originId || origin?.id || null,
                        maneuverRef: maneuver?.routeRef || maneuver?.routeId || null
                    }
                }));
            }
        }

        const compacted = this.compactor.compact(accepted);
        return {
            success: compacted.candidates.length > 0,
            reason: compacted.candidates.length > 0 ? null : "NO_ELIGIBLE_INTERCEPTION_PLAN",
            candidates: compacted.candidates,
            groups: compacted.groups,
            rejected,
            sourceCandidateCount: compacted.sourceCandidateCount,
            semanticGroupCount: compacted.semanticGroupCount,
            omittedSemanticGroups: compacted.omittedSemanticGroups
        };
    }
}

export default InterceptionPlanCandidateGenerator;
