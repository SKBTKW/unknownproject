import assert from "node:assert/strict";
import { createTacticRequirement } from "../game/src/trial/domain/tactic_requirement.js";
import {
    applyCausalInteractionStateTransitionsV1 as apply,
    restoreCausalInteractionStateTransitionsV1 as restore
} from "../game/src/trial/dev/causal_interaction_state_transition_v1.js";
import {
    CAUSAL_RULE_FACTS,
    CAUSAL_RULE_IDS,
    CAUSAL_RULE_TRAITS,
    evaluateCausalRuleSliceV1
} from "../game/src/trial/dev/causal_rule_slice_v1.js";
import { BattlefieldContextResolver } from "../game/src/trial/systems/battlefield_context_resolver.js";
import { EnemyForceDeploymentResolver } from "../game/src/trial/systems/enemy_force_deployment_resolver.js";
import { EnemyForceTerrainInteractionResolver } from "../game/src/trial/systems/enemy_force_terrain_interaction_resolver.js";

let cases = 0;
function test(name, fn) { fn(); cases += 1; console.log(`PASS ${name}`); }

const subject = () => ({ actor: "ENEMY", forceId: "ENEMY_FORCE" });
const trait = capability => ({ traitId: `trait:${capability}`, capability, explicit: true, subject: subject() });
const fact = type => ({ factId: `fact:${type}`, type, subject: subject() });

function context({ terrainId = "GL2_FOREST", bodySize = "LARGE", engagement = "FRONT" } = {}) {
    const positions = {
        FRONT: { approach: { r: 2, c: 1 }, origin: { r: 2, c: 3 } },
        LEFT_FLANK: { approach: { r: 2, c: 1 }, origin: { r: 1, c: 2 } }
    }[engagement];
    const interaction = new EnemyForceTerrainInteractionResolver().resolve({
        bodySize, equipment: ["STANDARD"], terrainId
    });
    const deployment = new EnemyForceDeploymentResolver().resolve({ forceSuppression: 10, interaction });
    return new BattlefieldContextResolver().resolve({
        battleContext: {
            interceptCell: { r: 2, c: 2, terrainId },
            approachCell: { ...positions.approach, terrainId: "GL1_PLAINS" },
            humanEngagementOrigin: { ...positions.origin, terrainId: "GL1_PLAINS" },
            enemy: { deployment: { interaction, deployment, profile: { bodySize } } }
        }
    });
}

const tactics = [
    { tacticId: "ENEMY_WIDE_FRONT", actor: "ENEMY",
        requirement: createTacticRequirement({ requiredStates: ["DEPLOYMENT_SPACE"] }) },
    { tacticId: "ENEMY_NARROW_FRONT", actor: "ENEMY",
        requirement: createTacticRequirement({ requiredStates: ["DEPLOYMENT_CONSTRAINED"] }) },
    { tacticId: "HUMAN_FRONTAL_ATTACK", actor: "HUMAN",
        requirement: createTacticRequirement({ requiredStates: ["FREE_MOVEMENT"] }) },
    { tacticId: "HUMAN_WITHDRAW", actor: "HUMAN",
        requirement: createTacticRequirement({ requiredStates: ["ESCAPE_ROUTE"] }) }
];

function source({ battlefieldContext = context(), actionType = "ATTACK", facts = [], traits = [] } = {}) {
    return {
        battlefieldContext,
        target: subject(),
        action: { actionId: "human-action:1", actor: "HUMAN", type: actionType },
        facts,
        traits
    };
}

function input(ruleInput = source()) {
    return {
        ruleSlice: evaluateCausalRuleSliceV1(ruleInput),
        initialState: {
            human: { freedom: "FREE", escapeRoute: "AVAILABLE" },
            enemy: { formation: "ORDERED", pursuit: "NONE", deployment: "UNCONSTRAINED" }
        },
        tactics
    };
}

const record = (result, ruleId) => result.records.find(row => row.ruleId === ruleId);
const eligible = (rows, tacticId) => rows.find(row => row.tacticId === tacticId).eligible;

test("forest confirmation updates only the enemy deployment axis", () => {
    const result = apply(input());
    assert.equal(result.finalState.enemy.deployment, "CONSTRAINED");
    assert.deepEqual(result.finalState.human, input().initialState.human);
    assert.equal(result.transitionHistory.length, 1);
    assert.equal(result.transitionHistory[0].state, "deployment");
});

test("deployment transition changes width-dependent enemy eligibility", () => {
    const result = apply(input());
    assert.equal(eligible(result.initialEligibility, "ENEMY_WIDE_FRONT"), true);
    assert.equal(eligible(result.finalEligibility, "ENEMY_WIDE_FRONT"), false);
    assert.equal(eligible(result.initialEligibility, "ENEMY_NARROW_FRONT"), false);
    assert.equal(eligible(result.finalEligibility, "ENEMY_NARROW_FRONT"), true);
});

test("both actors are reevaluated after the state change", () => {
    const transition = apply(input()).transitionHistory[0];
    assert.equal(transition.beforeEligibility.length, tactics.length);
    assert.equal(transition.afterEligibility.length, tactics.length);
    assert.deepEqual(new Set(transition.afterEligibility.map(row => row.actor)), new Set(["HUMAN", "ENEMY"]));
});

test("forest constraint does not invent vanguard isolation or an outcome", () => {
    const result = apply(input());
    assert.equal(JSON.stringify(result).includes("VANGUARD_ISOLATED"), false);
    assert.deepEqual(result.resolutionBoundary, {
        actionSelected: false, actionExecuted: false, actionOutcomeResolved: false,
        damageChanged: false, normalOutcomeChanged: false,
        opportunityChanged: false, fortuneChanged: false
    });
});

test("state transition carries action cause consequence fact and event provenance", () => {
    const row = record(apply(input()), CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(row.provenance.actionId, "human-action:1");
    assert.equal(row.provenance.cause.sourceFacts.length > 0, true);
    assert.equal(row.provenance.consequence.sourceCause, row.provenance.cause.causeId);
    assert.equal(row.provenance.event.sourceCause, row.provenance.cause.causeId);
    assert.equal(row.transitions[0].sourceEvents.includes(row.provenance.event.eventId), true);
});

test("confirmed frontal resistance remains a referenceable interaction constraint", () => {
    const result = apply(input(source({
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)],
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_RESILIENCE)]
    })));
    const row = record(result, CAUSAL_RULE_IDS.LARGE_FRONTAL_RESISTANCE);
    const constraint = result.interactionConstraints.find(item => item.ruleId === row.ruleId);
    assert.equal(row.stateChangeAllowed, false);
    assert.equal(row.stateChanged, false);
    assert.equal(constraint.type, "FRONTAL_BREAKTHROUGH_RESISTANCE_PRESENT");
    assert.equal(constraint.resolutionStatus, "PENDING_LATER_ACTION_RESOLUTION");
});

test("frontal resistance does not block the human attack attempt", () => {
    const result = apply(input(source({
        facts: [fact(CAUSAL_RULE_FACTS.FORMATION_MAINTAINED)],
        traits: [trait(CAUSAL_RULE_TRAITS.PHYSICAL_RESILIENCE)]
    })));
    assert.equal(eligible(result.finalEligibility, "HUMAN_FRONTAL_ATTACK"), true);
    assert.equal(result.resolutionBoundary.actionOutcomeResolved, false);
    assert.equal(JSON.stringify(result).includes("ATTACK_FAILED"), false);
});

test("small sensory flank creates a detection condition but no detection state", () => {
    const result = apply(input(source({
        battlefieldContext: context({ bodySize: "SMALL", engagement: "LEFT_FLANK" }),
        actionType: "AMBUSH_APPROACH",
        traits: [trait(CAUSAL_RULE_TRAITS.SENSORY_AWARENESS)]
    })));
    const row = record(result, CAUSAL_RULE_IDS.SMALL_FLANK_DETECTION);
    const constraint = result.interactionConstraints.find(item => item.ruleId === row.ruleId);
    assert.equal(row.stateChangeAllowed, false);
    assert.equal(constraint.type, "AMBUSH_DETECTION_POSSIBLE");
    assert.ok(constraint.unresolvedPrerequisites.includes("DETECTION_RESOLUTION"));
    assert.ok(constraint.unresolvedPrerequisites.includes("RESPONSE_CAPACITY"));
    assert.equal("detection" in result.finalState.enemy, false);
});

test("unresolved rules cannot change state", () => {
    const ruleInput = source({ battlefieldContext: context({ terrainId: "GL1_PLAINS" }) });
    const result = apply(input(ruleInput));
    const forest = record(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(forest.stateChangeAllowed, false);
    assert.deepEqual(forest.rejectionReasons, ["RULE_NOT_CONFIRMED"]);
    assert.equal(result.transitionHistory.length, 0);
});

test("arbitrary or tampered evaluation IDs are not accepted as evidence", () => {
    const forged = JSON.parse(JSON.stringify(input()));
    forged.ruleSlice.evaluations[0].ruleId = "EXTERNAL_CONFIRMED_RULE";
    assert.throws(() => apply(forged), /CAUSAL_RULE_SLICE_REPLAY_MISMATCH/);
});

test("cross-force Rule Slice evidence still fails before the adapter", () => {
    const ruleInput = source({ traits: [{
        traitId: "bad", capability: CAUSAL_RULE_TRAITS.SENSORY_AWARENESS,
        explicit: true, subject: { actor: "ENEMY", forceId: "OTHER_FORCE" }
    }] });
    assert.throws(() => evaluateCausalRuleSliceV1(ruleInput), /INVALID_CAUSAL_RULE_TRAIT/);
});

test("same input is deterministic frozen and does not mutate its caller", () => {
    const value = input();
    const before = JSON.stringify(value);
    const first = apply(value);
    assert.deepEqual(first, apply(value));
    assert.equal(JSON.stringify(value), before);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.transitionHistory[0]), true);
});

test("restore replays inputs and rejects modified derived history", () => {
    const result = apply(input());
    assert.deepEqual(restore(JSON.parse(JSON.stringify(result))), result);
    const changed = JSON.parse(JSON.stringify(result));
    changed.transitionHistory[0].after = "OPEN";
    assert.throws(() => restore(changed), /CAUSAL_INTERACTION_REPLAY_MISMATCH/);
});

test("reapplying an already confirmed deployment emits no duplicate transition", () => {
    const value = input();
    value.initialState.enemy.deployment = "CONSTRAINED";
    const result = apply(value);
    const forest = record(result, CAUSAL_RULE_IDS.FOREST_LARGE_DEPLOYMENT);
    assert.equal(forest.stateChangeAllowed, true);
    assert.equal(forest.stateChanged, false);
    assert.equal(result.transitionHistory.length, 0);
});

test("adapter consumes no gameplay RNG", () => {
    const random = Math.random;
    try {
        Math.random = () => { throw new Error("UNEXPECTED_RNG_USE"); };
        assert.equal(apply(input()).finalState.enemy.deployment, "CONSTRAINED");
    } finally {
        Math.random = random;
    }
});

console.log(`Trial Causal Interaction & State Transition v1: ${cases}/${cases} cases PASS`);
