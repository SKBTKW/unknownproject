import assert from "node:assert/strict";
import {
    FORCE_ACTORS,
    FORCE_RELATIONSHIP_STATUS,
    FORCE_RELATIONSHIP_TYPES,
    SPATIAL_EVIDENCE_STATUS,
    createForceRelationshipSnapshot
} from "../game/src/trial/domain/force_relationship_foundation.js";
import { createTacticRequirement } from "../game/src/trial/domain/tactic_requirement.js";
import {
    restoreForceRelationshipCausalIntegrationV1 as restore,
    validateForceRelationshipCausalIntegrationV1 as run
} from "../game/src/trial/dev/force_relationship_causal_integration_model.js";

let cases = 0;
function test(name, fn) { fn(); cases += 1; console.log(`PASS ${name}`); }

const unresolvedPosition = () => ({ status: SPATIAL_EVIDENCE_STATUS.UNRESOLVED, value: null });
const force = (forceId, actor, state) => ({
    forceId,
    actor,
    state,
    spatialEvidence: { position: unresolvedPosition() }
});
const relation = (relationId, sourceForceId, targetForceId, status) => ({
    relationId,
    type: FORCE_RELATIONSHIP_TYPES.SUPPORT,
    sourceForceId,
    targetForceId,
    status
});

function snapshot({ main = FORCE_RELATIONSHIP_STATUS.UNRESOLVED,
    reserve = FORCE_RELATIONSHIP_STATUS.UNRESOLVED, complete = true } = {}) {
    return createForceRelationshipSnapshot({
        forces: [
            force("ENEMY_VANGUARD", FORCE_ACTORS.ENEMY,
                { position: { r: 2, c: 2 }, deployment: "ADVANCED", formation: "ORDERED" }),
            force("ENEMY_MAIN", FORCE_ACTORS.ENEMY,
                { position: { r: 4, c: 2 }, deployment: "CONSTRAINED", terrain: "GL2_FOREST" }),
            force("ENEMY_RESERVE", FORCE_ACTORS.ENEMY,
                { position: { r: 5, c: 2 }, deployment: "HELD", formation: "ORDERED" }),
            force("HUMAN_FORCE_1", FORCE_ACTORS.HUMAN,
                { position: { r: 2, c: 3 }, deployment: "READY", formation: "ORDERED" })
        ],
        relations: [
            relation("support:main:vanguard", "ENEMY_MAIN", "ENEMY_VANGUARD", main),
            relation("support:vanguard:main", "ENEMY_VANGUARD", "ENEMY_MAIN",
                FORCE_RELATIONSHIP_STATUS.UNRESOLVED),
            relation("support:reserve:vanguard", "ENEMY_RESERVE", "ENEMY_VANGUARD", reserve)
        ],
        supportScopes: [{
            targetForceId: "ENEMY_VANGUARD",
            candidateForceIds: ["ENEMY_MAIN", "ENEMY_RESERVE"],
            complete
        }]
    });
}

const facts = [
    "fact:pursuit-resolved", "fact:main-move-resolved", "fact:route-open", "fact:route-blocked",
    "fact:support-capable", "fact:support-incapable", "fact:timing-valid", "fact:timing-invalid"
];
const causalBasis = { initialFacts: facts.map(factId => ({ factId })) };

const axis = (status, sourceFactId) => status === "UNRESOLVED"
    ? { status }
    : { status, sourceFactId };

function supportAssessment(status, overrides = {}) {
    const denied = status === FORCE_RELATIONSHIP_STATUS.DENIED;
    const unresolved = status === FORCE_RELATIONSHIP_STATUS.UNRESOLVED;
    return {
        relationId: "support:main:vanguard",
        eventId: `event:relation:${status.toLowerCase()}`,
        status,
        reason: "Explicit route, capability and timing assessment",
        evidence: {
            requiredAxes: ["routeReachability", "supportCapability", "timing"],
            routeReachability: axis(unresolved ? "UNRESOLVED" : denied ? "DENIED" : "CONFIRMED",
                denied ? "fact:route-blocked" : "fact:route-open"),
            supportCapability: axis(unresolved ? "UNRESOLVED" : "CONFIRMED", "fact:support-capable"),
            timing: axis(unresolved ? "UNRESOLVED" : "CONFIRMED", "fact:timing-valid"),
            distance: { status: "CONFIRMED", value: 4, sourceFactId: "fact:route-open" }
        },
        ...overrides
    };
}

function resolvedAction(overrides = {}) {
    return {
        actionId: "action:vanguard-pursuit",
        eventId: "event:vanguard-advanced",
        actionType: "PURSUE",
        actor: FORCE_ACTORS.ENEMY,
        forceId: "ENEMY_VANGUARD",
        order: 0,
        resolutionEvidence: {
            status: "RESOLVED",
            outcome: "CONFIRMED",
            source: "EXTERNAL_VALIDATION_SCENARIO",
            sourceFactId: "fact:pursuit-resolved",
            verifiedFields: ["position"]
        },
        resultingState: { position: { r: 1, c: 2 } },
        relationAssessments: [supportAssessment(FORCE_RELATIONSHIP_STATUS.UNRESOLVED)],
        ...overrides
    };
}

function mainMove(order, status, overrides = {}) {
    return resolvedAction({
        actionId: `action:main-move:${order}`,
        eventId: `event:main-move:${order}`,
        actionType: "MOVE",
        forceId: "ENEMY_MAIN",
        order,
        resolutionEvidence: {
            status: "RESOLVED",
            outcome: "CONFIRMED",
            source: "EXTERNAL_VALIDATION_SCENARIO",
            sourceFactId: "fact:main-move-resolved",
            verifiedFields: ["position"]
        },
        resultingState: { position: { r: 3 + order, c: 2 } },
        relationAssessments: [supportAssessment(status, {
            eventId: `event:main-support:${order}`
        })],
        ...overrides
    });
}

const tactics = [
    {
        tacticId: "ENEMY_SUPPORTED_PRESSURE",
        actor: FORCE_ACTORS.ENEMY,
        requirement: createTacticRequirement({
            requiredStates: ["RELATION:support:main:vanguard:CONFIRMED"]
        })
    },
    {
        tacticId: "ENEMY_INDEPENDENT_HOLD",
        actor: FORCE_ACTORS.ENEMY,
        requirement: createTacticRequirement({
            requiredStates: ["FORCE:ENEMY_VANGUARD:formation:ORDERED"]
        })
    },
    {
        tacticId: "HUMAN_EXPLOIT_SUPPORT_GAP",
        actor: FORCE_ACTORS.HUMAN,
        requirement: createTacticRequirement({
            requiredStates: ["RELATION:support:main:vanguard:DENIED"]
        })
    },
    {
        tacticId: "HUMAN_EXPLOIT_ISOLATION",
        actor: FORCE_ACTORS.HUMAN,
        requirement: createTacticRequirement({
            requiredStates: ["ISOLATION:ENEMY_VANGUARD:CONFIRMED"]
        })
    }
];

function input(actions = [resolvedAction()], initialSnapshot = snapshot(), knownEnemyState = {
    relationIds: [], isolationForceIds: []
}) {
    return { initialSnapshot, causalBasis, actions, tactics, knownEnemyState };
}

const state = (result, forceId) => result.finalSnapshot.forces.find(row => row.forceId === forceId).state;
const relationStatus = (result, relationId) => result.finalSnapshot.relations
    .find(row => row.relationId === relationId).status;
const isolated = result => result.finalIsolation.find(row => row.forceId === "ENEMY_VANGUARD");
const tactic = (result, tacticId) => result.finalEligibility.rows.find(row => row.tacticId === tacticId);

test("unresolved action selection never changes force state", () => {
    const action = resolvedAction({
        resolutionEvidence: {
            status: "UNRESOLVED", outcome: "UNRESOLVED", source: "EXTERNAL_VALIDATION_SCENARIO",
            sourceFactId: "fact:pursuit-resolved", verifiedFields: ["position"]
        }
    });
    const result = run(input([action]));
    assert.equal(result.history[0].status, "REJECTED");
    assert.ok(result.history[0].reasons.includes("ACTION_RESOLUTION_NOT_CONFIRMED"));
    assert.deepEqual(state(result, "ENEMY_VANGUARD").position, { r: 2, c: 2 });
});

test("resolved pursuit moves only the vanguard then reevaluates support", () => {
    const result = run(input());
    assert.deepEqual(state(result, "ENEMY_VANGUARD").position, { r: 1, c: 2 });
    assert.deepEqual(state(result, "ENEMY_MAIN").position, { r: 4, c: 2 });
    assert.equal(result.stateTransitions.length, 1);
    assert.equal(result.history[0].relationReevaluations.length, 1);
    assert.equal(relationStatus(result, "support:main:vanguard"), "UNRESOLVED");
});

test("distance is recorded but cannot decide support by itself", () => {
    const action = resolvedAction({ relationAssessments: [supportAssessment("DENIED", {
        evidence: {
            requiredAxes: ["distance"],
            distance: { status: "DENIED", value: 9, sourceFactId: "fact:route-blocked" }
        }
    })] });
    const result = run(input([action]));
    assert.ok(result.history[0].relationReevaluations[0].reasons
        .includes("DISTANCE_IS_NOT_A_DECISIVE_SUPPORT_AXIS"));
    assert.equal(relationStatus(result, "support:main:vanguard"), "UNRESOLVED");
});

test("forest deployment persists while grounded support denial changes only relation", () => {
    const result = run(input([mainMove(0, "DENIED")]));
    assert.equal(state(result, "ENEMY_MAIN").deployment, "CONSTRAINED");
    assert.equal(state(result, "ENEMY_MAIN").terrain, "GL2_FOREST");
    assert.equal(state(result, "ENEMY_VANGUARD").deployment, "ADVANCED");
    assert.equal(relationStatus(result, "support:main:vanguard"), "DENIED");
    assert.equal(result.relationTransitions[0].sourceAction, "action:main-move:0");
});

test("directed support never changes the reverse relation", () => {
    const result = run(input([mainMove(0, "DENIED")]));
    assert.equal(relationStatus(result, "support:vanguard:main"), "UNRESOLVED");
    assert.equal(result.relationTransitions[0].sourceForceId, "ENEMY_MAIN");
    assert.equal(result.relationTransitions[0].targetForceId, "ENEMY_VANGUARD");
});

test("confirmed reserve support prevents isolation after main denial", () => {
    const result = run(input([mainMove(0, "DENIED")], snapshot({ reserve: "CONFIRMED" })));
    assert.equal(isolated(result).status, "DENIED");
    assert.equal(tactic(result, "HUMAN_EXPLOIT_ISOLATION").objective.eligible, false);
});

test("complete candidate set with every support denied confirms isolation", () => {
    const result = run(input([mainMove(0, "DENIED")], snapshot({ reserve: "DENIED" })));
    assert.equal(isolated(result).status, "CONFIRMED");
    assert.deepEqual([...isolated(result).supportRelations].sort(),
        ["support:main:vanguard", "support:reserve:vanguard"].sort());
    assert.equal(tactic(result, "HUMAN_EXPLOIT_ISOLATION").objective.eligible, true);
    assert.equal(tactic(result, "HUMAN_EXPLOIT_ISOLATION").successResolved, false);
});

test("incomplete support candidate scope keeps isolation unresolved", () => {
    const result = run(input([mainMove(0, "DENIED")], snapshot({ reserve: "DENIED", complete: false })));
    assert.equal(isolated(result).status, "UNRESOLVED");
});

test("support can recover and history retains the earlier denial", () => {
    const result = run(input([
        mainMove(0, "DENIED"),
        mainMove(1, "CONFIRMED")
    ], snapshot({ reserve: "DENIED" })));
    assert.equal(relationStatus(result, "support:main:vanguard"), "CONFIRMED");
    assert.deepEqual(result.relationTransitions.map(row => [row.before, row.after]), [
        ["UNRESOLVED", "DENIED"], ["DENIED", "CONFIRMED"]
    ]);
    assert.equal(tactic(result, "ENEMY_SUPPORTED_PRESSURE").objective.eligible, true);
});

test("objective human eligibility does not leak into unknown enemy state", () => {
    const result = run(input([mainMove(0, "DENIED")]));
    const row = tactic(result, "HUMAN_EXPLOIT_SUPPORT_GAP");
    assert.equal(row.objective.eligible, true);
    assert.equal(row.known.eligible, false);
    assert.deepEqual(result.knownEnemyProjection.states.filter(token => token.includes("support:main")), []);
});

test("explicitly revealed relation can enable known human eligibility", () => {
    const result = run(input([mainMove(0, "DENIED")], snapshot(), {
        relationIds: ["support:main:vanguard"], isolationForceIds: []
    }));
    assert.equal(tactic(result, "HUMAN_EXPLOIT_SUPPORT_GAP").known.eligible, true);
});

test("unresolved required relation evidence cannot create denial", () => {
    const action = mainMove(0, "DENIED");
    action.relationAssessments[0].evidence.timing = { status: "UNRESOLVED" };
    const result = run(input([action]));
    assert.ok(result.history[0].relationReevaluations[0].reasons
        .includes("RELATION_ASSESSMENT_NOT_SUPPORTED_BY_EVIDENCE"));
    assert.equal(relationStatus(result, "support:main:vanguard"), "UNRESOLVED");
});

test("relation evidence with an unknown Fact reference fails closed", () => {
    const action = mainMove(0, "DENIED");
    action.relationAssessments[0].evidence.routeReachability.sourceFactId = "fact:future-route";
    const result = run(input([action]));
    assert.ok(result.history[0].relationReevaluations[0].reasons
        .includes("INVALID_CAUSAL_REFERENCE:FACT:fact:future-route"));
    assert.equal(relationStatus(result, "support:main:vanguard"), "UNRESOLVED");
});

test("resolved evidence cannot update an unverified state field", () => {
    const action = resolvedAction();
    action.resolutionEvidence.verifiedFields = [];
    const result = run(input([action]));
    assert.ok(result.history[0].reasons.includes("UNVERIFIED_RESULT_FIELD:position"));
    assert.deepEqual(state(result, "ENEMY_VANGUARD").position, { r: 2, c: 2 });
});

test("known enemy projection rejects unknown relation identifiers", () => {
    assert.throws(() => run(input([], snapshot(), {
        relationIds: ["support:unknown"], isolationForceIds: []
    })), /UNKNOWN_KNOWN_ENEMY_REFERENCE/);
});

test("unknown force and ownership mismatch fail closed", () => {
    const unknown = run(input([resolvedAction({ forceId: "UNKNOWN" })]));
    assert.ok(unknown.history[0].reasons.includes("UNKNOWN_FORCE"));
    const mismatch = run(input([resolvedAction({ actor: "HUMAN" })]));
    assert.ok(mismatch.history[0].reasons.includes("FORCE_ACTOR_MISMATCH"));
});

test("duplicate actions and events are rejected without double application", () => {
    const first = mainMove(0, "DENIED");
    const second = mainMove(1, "CONFIRMED", { actionId: first.actionId });
    const result = run(input([first, second]));
    assert.equal(result.history[1].status, "REJECTED");
    assert.ok(result.history[1].reasons.includes("DUPLICATE_ACTION_ID"));
    assert.equal(result.relationTransitions.length, 1);
});

test("missing and future references are rejected", () => {
    const result = run(input([resolvedAction({ sourceEventIds: ["event:future"] })]));
    assert.equal(result.history[0].status, "REJECTED");
    assert.ok(result.history[0].reasons.includes("INVALID_CAUSAL_REFERENCE:EVENT:event:future"));
});

test("unchanged relation suppresses unnecessary duplicate transition", () => {
    const result = run(input([mainMove(0, "DENIED")], snapshot({ main: "DENIED" })));
    assert.equal(result.history[0].relationReevaluations[0].status, "EVALUATED");
    assert.equal(result.relationTransitions.length, 0);
});

test("provenance preserves resolved action and relation evidence scope", () => {
    const result = run(input([mainMove(0, "DENIED")]));
    const stateRow = result.stateTransitions[0];
    const relationRow = result.relationTransitions[0];
    assert.equal(stateRow.sourceAction, "action:main-move:0");
    assert.ok(stateRow.sourceFacts.includes("fact:main-move-resolved"));
    assert.ok(relationRow.sourceFacts.includes("fact:route-blocked"));
    assert.ok(relationRow.sourceFacts.includes("fact:support-capable"));
    assert.ok(relationRow.sourceFacts.includes("fact:timing-valid"));
    assert.ok(relationRow.order >= 0);
});

test("same input is deterministic immutable and restore detects tampering", () => {
    const value = input([mainMove(0, "DENIED")], snapshot({ reserve: "DENIED" }));
    const before = JSON.stringify(value);
    const first = run(value);
    assert.deepEqual(first, run(value));
    assert.equal(JSON.stringify(value), before);
    assert.equal(Object.isFrozen(first), true);
    assert.deepEqual(restore(JSON.parse(JSON.stringify(first))), first);
    const changed = JSON.parse(JSON.stringify(first));
    changed.finalIsolation[0].status = "DENIED";
    assert.throws(() => restore(changed), /FORCE_RELATIONSHIP_CAUSAL_REPLAY_MISMATCH/);
});

test("explicit action order and finite maximum fail closed", () => {
    assert.throws(() => run(input([resolvedAction({ order: 1 })])), /INVALID_RESOLVED_FORCE_ACTION/);
    const value = input([mainMove(0, "DENIED"), mainMove(1, "CONFIRMED")]);
    value.maxActions = 1;
    const result = run(value);
    assert.equal(result.stopped, "MAX_ACTIONS_REACHED");
    assert.equal(result.history.length, 1);
});

test("integration consumes zero gameplay RNG and preserves production boundaries", () => {
    const random = Math.random;
    try {
        Math.random = () => { throw new Error("UNEXPECTED_RNG_USE"); };
        const result = run(input([mainMove(0, "DENIED")]));
        assert.deepEqual(result.resolutionBoundary, {
            productionTrialChanged: false,
            actionOutcomeResolved: false,
            tacticSelected: false,
            tacticSuccessResolved: false,
            damageChanged: false,
            opportunityChanged: false,
            fortuneChanged: false,
            advisorChanged: false,
            uiChanged: false
        });
    } finally {
        Math.random = random;
    }
});

console.log(`Trial Force Relationship Causal Integration v1: ${cases}/${cases} cases PASS`);
