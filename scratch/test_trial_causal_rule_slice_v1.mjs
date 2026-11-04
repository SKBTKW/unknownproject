import assert from "node:assert/strict";
import {
    CAUSAL_RULE_CLASSIFICATIONS,
    CAUSAL_RULE_FACTS,
    CAUSAL_RULE_IDS,
    CAUSAL_RULE_TRAITS,
    evaluateCausalRuleSliceV1
} from "../game/src/trial/dev/causal_rule_slice_v1.js";
import { BattlefieldContextResolver } from "../game/src/trial/systems/battlefield_context_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

function context({ terrainId = "GL2_FOREST", bodySize = "LARGE", engagement = "FRONT",
    includeInteraction = true } = {}) {
    const positions = {
        FRONT: { approach: { r: 2, c: 1 }, origin: { r: 2, c: 3 } },
        LEFT_FLANK: { approach: { r: 2, c: 1 }, origin: { r: 1, c: 2 } },
        RIGHT_FLANK: { approach: { r: 2, c: 1 }, origin: { r: 3, c: 2 } },
        UNRESOLVED: { approach: null, origin: null }
    }[engagement];
    const interaction = includeInteraction
        ? new EnemyForceTerrainInteractionResolver().resolve({ bodySize, equipment: ["STANDARD"], terrainId })
        : null;
    const deployment = interaction
        ? new EnemyForceDeploymentResolver().resolve({ forceSuppression: 10, interaction })
        : null;
    return new BattlefieldContextResolver().resolve({
        battleContext: {
            interceptCell: { r: 2, c: 2, terrainId },
            approachCell: positions.approach && { ...positions.approach, terrainId: "GL1_PLAINS" },
            humanEngagementOrigin: positions.origin && { ...positions.origin, terrainId: "GL1_PLAINS" },
            enemy: { deployment: { interaction, deployment, profile: { bodySize } } }
        }
    });
}

function subject() {
    return { actor: "ENEMY", forceId: "ENEMY_FORCE" };
}

function input({ battlefieldContext = context(), actionType = "ATTACK", facts = [], traits = [] } = {}) {
    return {
        battlefieldContext,
        target: subject(),
        action: { actionId: "human-action:1", actor: "HUMAN", type: actionType },
        facts,
        traits
    };
}

function trait(capability, traitId = `validation-trait:${capability.toLowerCase()}`) {
    return { traitId, capability, explicit: true, subject: subject() };
}

function fact(type, factId = `validation-fact:${type.toLowerCase()}`) {
    return { factId, type, subject: subject() };
}

function rule(result, ruleId) {
    return result.evaluations.find(row => row.ruleId === ruleId);
}

test("forest capability and existing large-force deployment confirm the constraint", () => {
    const result = evaluateCausalRuleSliceV1(input());
    const row = rule(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(row.classification, CAUSAL_RULE_CLASSIFICATIONS.CONFIRMED_CONDITION);
    assert.equal(row.result, "DEPLOYMENT_CONSTRAINT_CONFIRMED");
    assert.equal(row.evidence.find(item => item.field === "frontage").value, "LIMITED");
    assert.equal(row.evidence.find(item => item.field === "deployment").value, "CONSTRAINED");
});

test("deep forest preserves severe deployment evidence", () => {
    const result = evaluateCausalRuleSliceV1(input({ battlefieldContext: context({ terrainId: "GL3_DEEP_FOREST" }) }));
    const row = rule(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(row.result, "DEPLOYMENT_CONSTRAINT_CONFIRMED");
    assert.equal(row.evidence.find(item => item.field === "frontage").value, "SEVERELY_LIMITED");
    assert.equal(row.evidence.find(item => item.field === "deployment").value, "SEVERELY_CONSTRAINED");
});

test("missing deployment evaluation stays unresolved", () => {
    const result = evaluateCausalRuleSliceV1(input({ battlefieldContext: context({ includeInteraction: false }) }));
    const row = rule(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(row.status, "REQUIRES_RESOLUTION");
    assert.equal(row.result, "DEPLOYMENT_CONSTRAINT_NOT_CONFIRMED");
});

test("plains do not create a forest-specific deployment constraint", () => {
    const result = evaluateCausalRuleSliceV1(input({ battlefieldContext: context({ terrainId: "GL1_PLAINS" }) }));
    const row = rule(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(row.status, "NOT_APPLICABLE");
    assert.equal(row.result, "DEPLOYMENT_CONSTRAINT_NOT_CONFIRMED");
});

test("explicit physical trait and maintained formation constrain a frontal attack", () => {
    const result = evaluateCausalRuleSliceV1(input({
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_STRENGTH)],
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE);
    assert.equal(row.classification, CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT);
    assert.equal(row.result, "FRONTAL_BREAKTHROUGH_RESISTANCE_PRESENT");
    assert.deepEqual(row.inputReferences.traits, ["validation-trait:physical_strength"]);
    assert.ok(row.unresolvedPrerequisites.includes("BREAKTHROUGH_RESOLUTION"));
});

test("large body alone does not invent physical resilience", () => {
    const result = evaluateCausalRuleSliceV1(input({ facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)] }));
    const row = rule(result, CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE);
    assert.equal(row.status, "REQUIRES_RESOLUTION");
    assert.equal(row.result, "FRONTAL_RESISTANCE_NOT_CONFIRMED");
    assert.ok(row.missing.some(item => item.axis === "CAPABILITY"));
});

test("flank attack is not misread as frontal resistance", () => {
    const result = evaluateCausalRuleSliceV1(input({
        battlefieldContext: context({ engagement: "LEFT_FLANK" }),
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_RESILIENCE)],
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE);
    assert.equal(row.result, "FRONTAL_RESISTANCE_NOT_CONFIRMED");
});

test("frontal resistance never produces attack success or failure", () => {
    const result = evaluateCausalRuleSliceV1(input({
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_RESILIENCE)],
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE);
    assert.equal(row.resolutionBoundary.attackOutcomeResolved, false);
    assert.equal("success" in row, false);
    assert.equal("failure" in row, false);
});

test("explicit sensory trait at a flank yields detection possibility only", () => {
    const result = evaluateCausalRuleSliceV1(input({
        battlefieldContext: context({ bodySize: "SMALL", engagement: "RIGHT_FLANK" }),
        actionType: "AMBUSH_APPROACH",
        traits: [trait(CAUSAL_RULE_TRAITS.SENSORY_AWARENESS)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION);
    assert.equal(row.classification, CAUSAL_RULE_CLASSIFICATIONS.TACTICAL_CONSTRAINT);
    assert.equal(row.result, "AMBUSH_DETECTION_POSSIBLE");
    assert.ok(row.unresolvedPrerequisites.includes("DETECTION_RESOLUTION"));
    assert.ok(row.unresolvedPrerequisites.includes("RESPONSE_CAPACITY"));
    assert.equal(row.resolutionBoundary.attackOutcomeResolved, false);
});

test("front and flank remain distinct for ambush detection potential", () => {
    const result = evaluateCausalRuleSliceV1(input({
        battlefieldContext: context({ bodySize: "SMALL", engagement: "FRONT" }),
        actionType: "AMBUSH_APPROACH",
        traits: [trait(CAUSAL_RULE_TRAITS.SENSORY_AWARENESS)]
    }));
    assert.equal(rule(result, CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION).result, "DETECTION_POTENTIAL_NOT_CONFIRMED");
});

test("mobility and control traits do not substitute for sensory evidence", () => {
    const result = evaluateCausalRuleSliceV1(input({
        battlefieldContext: context({ bodySize: "SMALL", engagement: "LEFT_FLANK" }),
        actionType: "AMBUSH_APPROACH",
        traits: [trait(CAUSAL_RULE_TRAITS.MOBILITY), trait(CAUSAL_RULE_TRAITS.UNIT_CONTROL)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION);
    assert.equal(row.status, "REQUIRES_RESOLUTION");
    assert.ok(row.missing.some(item => item.value === CAUSAL_RULE_TRAITS.SENSORY_AWARENESS));
});

test("unknown position is not filled in", () => {
    const result = evaluateCausalRuleSliceV1(input({
        battlefieldContext: context({ bodySize: "SMALL", engagement: "UNRESOLVED" }),
        actionType: "AMBUSH_APPROACH",
        traits: [trait(CAUSAL_RULE_TRAITS.SENSORY_AWARENESS)]
    }));
    const row = rule(result, CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION);
    assert.equal(row.result, "DETECTION_POTENTIAL_NOT_CONFIRMED");
    assert.ok(row.missing.some(item => item.axis === "CONTEXT"));
});

test("malformed and cross-force evidence fails closed", () => {
    assert.throws(() => evaluateCausalRuleSliceV1(input({ traits: [{
        traitId: "bad", capability: CAUSAL_RULE_TRAITS.SENSORY_AWARENESS,
        explicit: false, subject: subject()
    }] })), /INVALID_CAUSAL_RULE_TRAIT/);
    assert.throws(() => evaluateCausalRuleSliceV1(input({ facts: [{
        factId: "bad", type: CAUSAL_RULE_FACTS.FORMATION_MAINTAINED,
        subject: { actor: "ENEMY", forceId: "OTHER_FORCE" }
    }] })), /INVALID_CAUSAL_RULE_FACT/);
});

test("same input returns the same immutable output without mutating input", () => {
    const source = input({
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_STRENGTH)],
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)]
    });
    const before = JSON.stringify(source);
    const first = evaluateCausalRuleSliceV1(source);
    const second = evaluateCausalRuleSliceV1(source);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(source), before);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.evaluations[0]), true);
});

test("evaluation consumes no gameplay RNG and changes no battle state or outcomes", () => {
    const originalRandom = Math.random;
    let calls = 0;
    Math.random = () => { calls += 1; return 0.5; };
    try {
        const result = evaluateCausalRuleSliceV1(input());
        assert.equal(calls, 0);
        for (const row of result.evaluations) {
            assert.deepEqual(row.resolutionBoundary, {
                battleStateChanged: false,
                tacticOutcomeResolved: false,
                attackOutcomeResolved: false,
                normalOutcomeChanged: false,
                opportunityChanged: false,
                fortuneChanged: false
            });
        }
    } finally {
        Math.random = originalRandom;
    }
});

console.log(`Trial Causal Rule Slice v1: ${cases}/${cases} cases PASS`);
