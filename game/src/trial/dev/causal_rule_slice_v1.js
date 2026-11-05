import { createTacticRequirement } from "../domain/tactic_requirement.js";
import { freezeBattleResolutionData } from "../domain/battle_resolution_snapshot.js";
import { RELATIVE_ENGAGEMENT } from "../domain/spatial_engagement.js";
import { TacticRequirementEvaluator } from "../systems/tactic_requirement_evaluator.js";

export const CAUSAL_RULE_SLICE_SCHEMA = "DEV_CAUSAL_RULE_SLICE_V1";

export const CAUSAL_RULE_IDS = Object.freeze({
    FOREST_LARGE_DEPLOYMENT: "FOREST_LARGE_DEPLOYMENT_CONSTRAINT_V1",
    LARGE_FRONTAL_RESISTANCE: "LARGE_FORCE_FRONTAL_RESISTANCE_V1",
    SMALL_FLANK_DETECTION: "SMALL_FORCE_FLANK_DETECTION_POTENTIAL_V1"
});

export const CAUSAL_RULE_CLASSIFICATIONS = Object.freeze({
    CONFIRMED_CONDITION: "CONFIRMED_CONDITION",
    TACTICAL_CONSTRAINT: "TACTICAL_CONSTRAINT",
    UNRESOLVED: "UNRESOLVED"
});

export const CAUSAL_RULE_TRAITS = Object.freeze({
    PHYSICAL_STRENGTH: "PHYSICAL_STRENGTH",
    PHYSICAL_RESILIENCE: "PHYSICAL_RESILIENCE",
    SENSORY_AWARENESS: "SENSORY_AWARENESS",
    MOBILITY: "MOBILITY",
    UNIT_CONTROL: "UNIT_CONTROL"
});

export const CAUSAL_RULE_FACTS = Object.freeze({
    FORMATION_MAINTAINED: "FORMATION_MAINTAINED"
});

const VALID_ACTORS = new Set(["HUMAN", "ENEMY"]);
const VALID_ACTION_TYPES = new Set(["ATTACK", "AMBUSH_APPROACH"]);
const FOREST_FAMILIES = new Set(["FOREST", "DEEP_FOREST"]);
const CONSTRAINED_DEPLOYMENT = new Set(["CONSTRAINED", "SEVERELY_CONSTRAINED"]);
const FLANKS = new Set([RELATIVE_ENGAGEMENT.LEFT_FLANK, RELATIVE_ENGAGEMENT.RIGHT_FLANK]);

const frontalRequirement = createTacticRequirement({
    requiredContext: [RELATIVE_ENGAGEMENT.FRONT],
    requiredCapabilities: ["EXPLICIT_PHYSICAL_RESISTANCE"],
    requiredStates: [CAUSAL_RULE_FACTS.FORMATION_MAINTAINED]
});

const flankDetectionRequirement = createTacticRequirement({
    requiredContext: ["FLANK"],
    requiredCapabilities: [CAUSAL_RULE_TRAITS.SENSORY_AWARENESS]
});

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function validText(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function validateSubject(subject, target) {
    return subject?.actor === target.actor && subject?.forceId === target.forceId;
}

function validateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("CAUSAL_RULE_SLICE_INPUT_REQUIRED");
    }
    if (!input.battlefieldContext || typeof input.battlefieldContext !== "object") {
        throw new TypeError("RESOLVED_BATTLEFIELD_CONTEXT_REQUIRED");
    }
    if (!input.target || !VALID_ACTORS.has(input.target.actor) || !validText(input.target.forceId)) {
        throw new TypeError("CAUSAL_RULE_TARGET_REQUIRED");
    }
    const action = input.action;
    if (!action || !validText(action.actionId) || !VALID_ACTORS.has(action.actor)
        || !VALID_ACTION_TYPES.has(action.type)) {
        throw new TypeError("CAUSAL_RULE_ACTION_REQUIRED");
    }
    if (action.actor === input.target.actor) throw new TypeError("OPPOSING_ACTION_ACTOR_REQUIRED");
    if (!Array.isArray(input.facts) || !Array.isArray(input.traits)) {
        throw new TypeError("CAUSAL_RULE_EVIDENCE_LISTS_REQUIRED");
    }
    const factIds = new Set();
    for (const fact of input.facts) {
        if (!validText(fact?.factId) || !validText(fact?.type)
            || factIds.has(fact.factId) || !validateSubject(fact.subject, input.target)) {
            throw new TypeError("INVALID_CAUSAL_RULE_FACT");
        }
        factIds.add(fact.factId);
    }
    const traitIds = new Set();
    for (const trait of input.traits) {
        if (!validText(trait?.traitId) || !validText(trait?.capability)
            || trait.explicit !== true || traitIds.has(trait.traitId)
            || !validateSubject(trait.subject, input.target)) {
            throw new TypeError("INVALID_CAUSAL_RULE_TRAIT");
        }
        traitIds.add(trait.traitId);
    }
}

function evidenceRefs({ facts = [], traits = [], action = null } = {}) {
    return {
        facts: facts.map(row => row.factId),
        traits: traits.map(row => row.traitId),
        actions: action ? [action.actionId] : []
    };
}

function evaluation({ ruleId, target, classification, status, result, facts = [], traits = [], action,
    evidence = [], missing = [], unresolvedPrerequisites = [] }) {
    return {
        ruleId,
        target: clone(target),
        classification,
        status,
        result,
        inputReferences: evidenceRefs({ facts, traits, action }),
        evidence: clone(evidence),
        missing: clone(missing),
        unresolvedPrerequisites: [...unresolvedPrerequisites],
        resolutionBoundary: {
            battleStateChanged: false,
            tacticOutcomeResolved: false,
            attackOutcomeResolved: false,
            normalOutcomeChanged: false,
            opportunityChanged: false,
            fortuneChanged: false
        }
    };
}

function forestLargeDeployment(input) {
    const context = input.battlefieldContext;
    const family = context.battlefieldCapabilities?.intercept?.terrainFamily || null;
    const frontage = context.battlefieldCapabilities?.intercept?.capabilities?.frontage || null;
    const bodySize = context.enemy?.bodySize || null;
    const deployment = context.enemy?.terrainInteraction?.deployment || null;
    const applies = FOREST_FAMILIES.has(family) && bodySize === "LARGE";
    const confirmed = applies && CONSTRAINED_DEPLOYMENT.has(deployment);
    const missing = [];
    if (!FOREST_FAMILIES.has(family)) missing.push({ axis: "CONTEXT", value: "FOREST_OR_DEEP_FOREST" });
    if (bodySize !== "LARGE") missing.push({ axis: "CAPABILITY", value: "LARGE_BODY" });
    if (applies && !CONSTRAINED_DEPLOYMENT.has(deployment)) {
        missing.push({ axis: "DEPLOYMENT", value: "EXISTING_DEPLOYMENT_CONSTRAINT" });
    }
    return evaluation({
        ruleId: CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT,
        target: input.target,
        classification: confirmed
            ? CAUSAL_RULE_CLASSIFICATIONS.CONFIRMED_CONDITION
            : CAUSAL_RULE_CLASSIFICATIONS.UNRESOLVED,
        status: confirmed ? "CONFIRMED" : (applies ? "REQUIRES_RESOLUTION" : "NOT_APPLICABLE"),
        result: confirmed ? "DEPLOYMENT_CONSTRAINT_CONFIRMED" : "DEPLOYMENT_CONSTRAINT_NOT_CONFIRMED",
        action: input.action,
        evidence: [
            { source: "BattlefieldCapabilityProjector", field: "terrainFamily", value: family },
            { source: "BattlefieldCapabilityProjector", field: "frontage", value: frontage },
            { source: "BattlefieldContextResolver", field: "enemy.bodySize", value: bodySize },
            { source: "EnemyForceTerrainInteractionResolver", field: "deployment", value: deployment }
        ],
        missing,
        unresolvedPrerequisites: confirmed
            ? ["SUPPORT_DISTANCE", "FORCE_RELATIONSHIP", "ADVANCE_STATE"]
            : missing.map(row => `${row.axis}:${row.value}`)
    });
}

function largeFrontalResistance(input, evaluator) {
    const context = input.battlefieldContext;
    const bodySize = context.enemy?.bodySize || null;
    const engagement = context.spatialEngagement?.relativeEngagement || RELATIVE_ENGAGEMENT.UNRESOLVED;
    const physicalTraits = input.traits.filter(row => [
        CAUSAL_RULE_TRAITS.PHYSICAL_STRENGTH,
        CAUSAL_RULE_TRAITS.PHYSICAL_RESILIENCE
    ].includes(row.capability));
    const formationFacts = input.facts.filter(row => row.type === CAUSAL_RULE_FACTS.FORMATION_MAINTAINED);
    const actualCapabilities = physicalTraits.length ? ["EXPLICIT_PHYSICAL_RESISTANCE"] : [];
    const requirement = evaluator.evaluate({
        requirement: frontalRequirement,
        context: [engagement],
        capabilities: actualCapabilities,
        states: formationFacts.map(row => row.type)
    });
    const applies = bodySize === "LARGE" && input.action.type === "ATTACK";
    const confirmed = applies && requirement.eligible;
    const missing = [...requirement.reasons];
    if (bodySize !== "LARGE") missing.unshift({ axis: "CAPABILITY", value: "LARGE_BODY" });
    if (input.action.type !== "ATTACK") missing.unshift({ axis: "ACTION", value: "ATTACK" });
    return evaluation({
        ruleId: CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE,
        target: input.target,
        classification: confirmed
            ? CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT
            : CAUSAL_RULE_CLASSIFICATIONS.UNRESOLVED,
        status: confirmed ? "CONFIRMED" : (applies ? "REQUIRES_RESOLUTION" : "NOT_APPLICABLE"),
        result: confirmed ? "FRONTAL_BREAKTHROUGH_RESISTANCE_PRESENT" : "FRONTAL_RESISTANCE_NOT_CONFIRMED",
        facts: formationFacts,
        traits: physicalTraits,
        action: input.action,
        evidence: [
            { source: "BattlefieldContextResolver", field: "enemy.bodySize", value: bodySize },
            { source: "RelativeEngagementResolver", field: "relativeEngagement", value: engagement }
        ],
        missing,
        unresolvedPrerequisites: confirmed
            ? ["ATTACK_CAPABILITY", "ATTACK_EQUIPMENT", "ATTACK_SPEED", "FORMATION_DISRUPTION", "BREAKTHROUGH_RESOLUTION"]
            : missing.map(row => `${row.axis}:${row.value}`)
    });
}

function smallFlankDetection(input, evaluator) {
    const context = input.battlefieldContext;
    const bodySize = context.enemy?.bodySize || null;
    const engagement = context.spatialEngagement?.relativeEngagement || RELATIVE_ENGAGEMENT.UNRESOLVED;
    const sensoryTraits = input.traits.filter(row => row.capability === CAUSAL_RULE_TRAITS.SENSORY_AWARENESS);
    const flankContext = FLANKS.has(engagement) ? ["FLANK"] : [];
    const requirement = evaluator.evaluate({
        requirement: flankDetectionRequirement,
        context: flankContext,
        capabilities: sensoryTraits.map(row => row.capability)
    });
    const applies = bodySize === "SMALL" && input.action.type === "AMBUSH_APPROACH";
    const confirmed = applies && requirement.eligible;
    const missing = [...requirement.reasons];
    if (bodySize !== "SMALL") missing.unshift({ axis: "CAPABILITY", value: "SMALL_BODY" });
    if (input.action.type !== "AMBUSH_APPROACH") missing.unshift({ axis: "ACTION", value: "AMBUSH_APPROACH" });
    return evaluation({
        ruleId: CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION,
        target: input.target,
        classification: confirmed
            ? CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT
            : CAUSAL_RULE_CLASSIFICATIONS.UNRESOLVED,
        status: confirmed ? "CONFIRMED" : (applies ? "REQUIRES_RESOLUTION" : "NOT_APPLICABLE"),
        result: confirmed ? "AMBUSH_DETECTION_POSSIBLE" : "DETECTION_POTENTIAL_NOT_CONFIRMED",
        traits: sensoryTraits,
        action: input.action,
        evidence: [
            { source: "BattlefieldContextResolver", field: "enemy.bodySize", value: bodySize },
            { source: "RelativeEngagementResolver", field: "relativeEngagement", value: engagement }
        ],
        missing,
        unresolvedPrerequisites: confirmed
            ? ["APPROACH_REACHABILITY", "DETECTION_RESOLUTION", "RESPONSE_CAPACITY", "ATTACK_SUCCESS"]
            : missing.map(row => `${row.axis}:${row.value}`)
    });
}

/**
 * Development-only causal rule projection. It consumes resolved SSOT data and
 * explicit validation evidence, but never mutates Battle State or resolves a
 * tactic, attack, Normal Outcome, Opportunity, or Fortune.
 */
export function evaluateCausalRuleSliceV1(input) {
    validateInput(input);
    const safeInput = clone(input);
    const evaluator = new TacticRequirementEvaluator();
    return freezeBattleResolutionData({
        schema: CAUSAL_RULE_SLICE_SCHEMA,
        status: "DEVELOPMENT_ONLY",
        input: safeInput,
        evaluations: [
            forestLargeDeployment(safeInput),
            largeFrontalResistance(safeInput, evaluator),
            smallFlankDetection(safeInput, evaluator)
        ]
    });
}

export default evaluateCausalRuleSliceV1;
