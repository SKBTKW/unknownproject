import assert from "node:assert/strict";
import {
    FORCE_ACTORS,
    FORCE_RELATIONSHIP_STATUS,
    FORCE_RELATIONSHIP_TYPES,
    SPATIAL_EVIDENCE_STATUS,
    createForceRelationshipSnapshot,
    createForceSpatialEvidence
} from "../game/src/trial/domain/force_relationship_foundation.js";
import {
    FORCE_OPERATION_TYPES,
    restoreForceRelationshipsV1 as restore,
    validateForceRelationshipsV1 as run
} from "../game/src/trial/dev/force_relationship_validation_model.js";

let cases = 0;
function test(name, fn) { fn(); cases += 1; console.log(`PASS ${name}`); }

const unresolved = () => ({ status: SPATIAL_EVIDENCE_STATUS.UNRESOLVED, value: null });
const position = (r, c, factId) => ({
    status: SPATIAL_EVIDENCE_STATUS.CONFIRMED,
    value: { r, c },
    sourceFactId: factId
});

function force(forceId, actor, state, point = unresolved()) {
    return {
        forceId,
        actor,
        state,
        spatialEvidence: { position: point }
    };
}

function relation(relationId, type, sourceForceId, targetForceId, status) {
    return { relationId, type, sourceForceId, targetForceId, status };
}

function initial({ reserveSupport = FORCE_RELATIONSHIP_STATUS.CONFIRMED,
    complete = true, includeHuman = true } = {}) {
    const forces = [
        force("ENEMY_VANGUARD", FORCE_ACTORS.ENEMY,
            { deployment: "ADVANCED", formation: "ORDERED" }, position(2, 2, "fact:vanguard-position")),
        force("ENEMY_MAIN", FORCE_ACTORS.ENEMY,
            { deployment: "UNCONSTRAINED", formation: "ORDERED" }),
        force("ENEMY_RESERVE", FORCE_ACTORS.ENEMY,
            { deployment: "HELD", formation: "ORDERED" })
    ];
    if (includeHuman) forces.push(force("HUMAN_FORCE_1", FORCE_ACTORS.HUMAN,
        { deployment: "READY", formation: "ORDERED" }, position(2, 3, "fact:human-position")));
    return createForceRelationshipSnapshot({
        forces,
        relations: [
            relation("support:main:vanguard", FORCE_RELATIONSHIP_TYPES.SUPPORT,
                "ENEMY_MAIN", "ENEMY_VANGUARD", FORCE_RELATIONSHIP_STATUS.UNRESOLVED),
            relation("support:vanguard:main", FORCE_RELATIONSHIP_TYPES.SUPPORT,
                "ENEMY_VANGUARD", "ENEMY_MAIN", FORCE_RELATIONSHIP_STATUS.UNRESOLVED),
            relation("support:reserve:vanguard", FORCE_RELATIONSHIP_TYPES.SUPPORT,
                "ENEMY_RESERVE", "ENEMY_VANGUARD", reserveSupport),
            relation("separation:human:vanguard", FORCE_RELATIONSHIP_TYPES.SEPARATION,
                "HUMAN_FORCE_1", "ENEMY_VANGUARD", FORCE_RELATIONSHIP_STATUS.CONFIRMED)
        ],
        supportScopes: [{
            targetForceId: "ENEMY_VANGUARD",
            candidateForceIds: ["ENEMY_MAIN", "ENEMY_RESERVE"],
            complete
        }]
    });
}

function stateOperation(overrides = {}) {
    return {
        actionId: "action:main-deployment",
        eventId: "event:main-deployment",
        actor: FORCE_ACTORS.ENEMY,
        type: FORCE_OPERATION_TYPES.FORCE_STATE,
        forceId: "ENEMY_MAIN",
        resultingState: { deployment: "CONSTRAINED" },
        reason: "Existing forest deployment assessment",
        evidence: { deploymentAssessment: "CONSTRAINED", source: "Rule Slice" },
        ...overrides
    };
}

function supportOperation(status = FORCE_RELATIONSHIP_STATUS.DENIED, overrides = {}) {
    return {
        actionId: "action:main-support",
        eventId: "event:main-support",
        actor: FORCE_ACTORS.ENEMY,
        type: FORCE_OPERATION_TYPES.RELATION,
        relationId: "support:main:vanguard",
        status,
        reason: "External support assessment",
        evidence: {
            supportAssessment: status,
            routeReachability: status === FORCE_RELATIONSHIP_STATUS.DENIED ? "DENIED" : "CONFIRMED",
            timingAssessment: "CONFIRMED"
        },
        ...overrides
    };
}

function input(operations = [], snapshot = initial()) {
    return {
        initialSnapshot: snapshot,
        operations,
        actorCompatibilitySelection: {
            HUMAN: "HUMAN_FORCE_1",
            ENEMY: "ENEMY_MAIN"
        }
    };
}

const forceState = (result, id) => result.finalSnapshot.forces.find(row => row.forceId === id).state;
const relationState = (result, id) => result.finalSnapshot.relations.find(row => row.relationId === id).status;
const isolation = (result, id) => result.isolation.find(row => row.forceId === id);

test("same actor can own multiple independently identified forces", () => {
    const snapshot = initial();
    assert.equal(snapshot.forces.filter(row => row.actor === FORCE_ACTORS.ENEMY).length, 3);
    assert.equal(new Set(snapshot.forces.map(row => row.forceId)).size, snapshot.forces.length);
});

test("duplicate force IDs fail closed", () => {
    const snapshot = initial();
    assert.throws(() => createForceRelationshipSnapshot({
        forces: [...snapshot.forces, snapshot.forces[0]], relations: [], supportScopes: []
    }), /INVALID_FORCE_IDENTITY/);
});

test("unknown and self force relationships are rejected", () => {
    const forces = initial().forces;
    for (const row of [
        relation("bad", FORCE_RELATIONSHIP_TYPES.SUPPORT, "UNKNOWN", "ENEMY_MAIN", "UNRESOLVED"),
        relation("bad", FORCE_RELATIONSHIP_TYPES.SUPPORT, "ENEMY_MAIN", "ENEMY_MAIN", "UNRESOLVED")
    ]) {
        assert.throws(() => createForceRelationshipSnapshot({ forces, relations: [row], supportScopes: [] }),
            /INVALID_FORCE_RELATIONSHIP/);
    }
});

test("force state update never changes another same-actor force", () => {
    const result = run(input([stateOperation()]));
    assert.equal(forceState(result, "ENEMY_MAIN").deployment, "CONSTRAINED");
    assert.equal(forceState(result, "ENEMY_VANGUARD").deployment, "ADVANCED");
    assert.equal(forceState(result, "ENEMY_RESERVE").deployment, "HELD");
});

test("human and enemy force states remain independent", () => {
    const result = run(input([stateOperation()]));
    assert.deepEqual(forceState(result, "HUMAN_FORCE_1"), input().initialSnapshot.forces
        .find(row => row.forceId === "HUMAN_FORCE_1").state);
    assert.equal(result.actorScopedCompatibility.enemy.deployment, "CONSTRAINED");
    assert.equal(result.actorScopedCompatibility.human.deployment, "READY");
});

test("actor-scoped compatibility requires explicit unambiguous force selection", () => {
    const value = input();
    value.actorCompatibilitySelection.ENEMY = "HUMAN_FORCE_1";
    assert.throws(() => run(value), /ACTOR_FORCE_SELECTION_MISMATCH/);
});

test("spatial evidence preserves known data and never fills unknown axes", () => {
    const evidence = createForceSpatialEvidence({ position: position(1, 4, "fact:position") });
    assert.deepEqual(evidence.position.value, { r: 1, c: 4 });
    assert.equal(evidence.distance.status, SPATIAL_EVIDENCE_STATUS.UNRESOLVED);
    assert.equal(evidence.route.status, SPATIAL_EVIDENCE_STATUS.UNRESOLVED);
    assert.equal(evidence.travelTime.value, null);
});

test("unresolved spatial evidence cannot smuggle a coordinate or distance", () => {
    assert.throws(() => createForceSpatialEvidence({
        distance: { status: "UNRESOLVED", value: 2 }
    }), /UNRESOLVED_SPATIAL_VALUE_FORBIDDEN/);
    assert.throws(() => createForceSpatialEvidence({
        reachability: { status: "CONFIRMED", value: true }
    }), /GROUNDED_SPATIAL_VALUE_REQUIRED/);
});

test("forest deployment constraint does not infer support denial", () => {
    const result = run(input([stateOperation()]));
    assert.equal(relationState(result, "support:main:vanguard"), FORCE_RELATIONSHIP_STATUS.UNRESOLVED);
    assert.equal(result.relationTransitions.length, 0);
});

test("directed support denial changes only main to vanguard", () => {
    const result = run(input([supportOperation()]));
    assert.equal(relationState(result, "support:main:vanguard"), FORCE_RELATIONSHIP_STATUS.DENIED);
    assert.equal(relationState(result, "support:vanguard:main"), FORCE_RELATIONSHIP_STATUS.UNRESOLVED);
    assert.equal(result.relationTransitions[0].sourceForceId, "ENEMY_MAIN");
    assert.equal(result.relationTransitions[0].targetForceId, "ENEMY_VANGUARD");
});

test("relation update requires an explicit matching assessment", () => {
    const result = run(input([supportOperation("DENIED", {
        evidence: { supportAssessment: "CONFIRMED" }
    })]));
    assert.equal(result.history[0].status, "REJECTED");
    assert.deepEqual(result.history[0].reasons, ["EXPLICIT_RELATION_ASSESSMENT_REQUIRED"]);
    assert.equal(relationState(result, "support:main:vanguard"), "UNRESOLVED");
});

test("cross-actor support and coordination are invalid while separation is allowed", () => {
    const forces = initial().forces;
    for (const type of [FORCE_RELATIONSHIP_TYPES.SUPPORT, FORCE_RELATIONSHIP_TYPES.COORDINATION]) {
        assert.throws(() => createForceRelationshipSnapshot({
            forces,
            relations: [relation("cross", type, "HUMAN_FORCE_1", "ENEMY_VANGUARD", "UNRESOLVED")],
            supportScopes: []
        }), /CROSS_ACTOR_ALLIED_RELATION_FORBIDDEN/);
    }
    assert.equal(initial().relations.some(row => row.type === FORCE_RELATIONSHIP_TYPES.SEPARATION), true);
});

test("support coordination and separation remain distinct directed relation types", () => {
    const base = initial();
    const snapshot = createForceRelationshipSnapshot({
        forces: base.forces,
        relations: [
            relation("support", FORCE_RELATIONSHIP_TYPES.SUPPORT,
                "ENEMY_MAIN", "ENEMY_VANGUARD", "UNRESOLVED"),
            relation("coordination", FORCE_RELATIONSHIP_TYPES.COORDINATION,
                "ENEMY_MAIN", "ENEMY_VANGUARD", "CONFIRMED"),
            relation("separation", FORCE_RELATIONSHIP_TYPES.SEPARATION,
                "ENEMY_VANGUARD", "HUMAN_FORCE_1", "CONFIRMED")
        ],
        supportScopes: []
    });
    assert.deepEqual(snapshot.relations.map(row => row.type), ["SUPPORT", "COORDINATION", "SEPARATION"]);
    assert.equal(snapshot.relations[2].sourceForceId, "ENEMY_VANGUARD");
    assert.equal(snapshot.relations[2].targetForceId, "HUMAN_FORCE_1");
});

test("invalid relation status fails closed", () => {
    const result = run(input([supportOperation("MAYBE")]));
    assert.deepEqual(result.history[0].reasons, ["INVALID_RELATION_STATUS"]);
    assert.equal(result.relationTransitions.length, 0);
});

test("one denied support relation does not establish isolation when reserve support exists", () => {
    const result = run(input([supportOperation()]));
    assert.equal(isolation(result, "ENEMY_VANGUARD").status, FORCE_RELATIONSHIP_STATUS.DENIED);
    assert.deepEqual(isolation(result, "ENEMY_VANGUARD").reasons, ["CONFIRMED_SUPPORT_AVAILABLE"]);
});

test("unknown support candidates keep isolation unresolved", () => {
    const result = run(input([supportOperation()], initial({ complete: false })));
    assert.equal(isolation(result, "ENEMY_VANGUARD").status, FORCE_RELATIONSHIP_STATUS.UNRESOLVED);
    assert.deepEqual(isolation(result, "ENEMY_VANGUARD").reasons, ["UNKNOWN_SUPPORT_CANDIDATES_REMAIN"]);
});

test("complete candidate scope with unresolved relations still leaves isolation unresolved", () => {
    const result = run(input([], initial({ reserveSupport: FORCE_RELATIONSHIP_STATUS.UNRESOLVED })));
    assert.equal(isolation(result, "ENEMY_VANGUARD").status, FORCE_RELATIONSHIP_STATUS.UNRESOLVED);
    assert.deepEqual(isolation(result, "ENEMY_VANGUARD").reasons, ["SUPPORT_RELATION_UNRESOLVED"]);
});

test("all known candidates denied can confirm isolation", () => {
    const snapshot = initial({ reserveSupport: FORCE_RELATIONSHIP_STATUS.DENIED });
    const result = run(input([supportOperation()], snapshot));
    assert.equal(isolation(result, "ENEMY_VANGUARD").status, FORCE_RELATIONSHIP_STATUS.CONFIRMED);
    assert.equal(isolation(result, "ENEMY_VANGUARD").supportRelations.length, 2);
});

test("relation transition records full causal provenance and global order", () => {
    const result = run(input([supportOperation()]));
    const row = result.relationTransitions[0];
    assert.equal(row.order, 0);
    assert.equal(row.sourceAction, "action:main-support");
    assert.equal(row.sourceCause, "dev-force-cause:0");
    assert.equal(row.sourceConsequence, "dev-force-consequence:0");
    assert.deepEqual(row.sourceFacts, ["dev-fact:0:0"]);
    assert.ok(row.sourceEvents.includes("event:main-support"));
});

test("force state transition records actor force and full causal provenance", () => {
    const result = run(input([stateOperation()]));
    const row = result.stateTransitions[0];
    assert.deepEqual(row.target, { actor: "ENEMY", forceId: "ENEMY_MAIN" });
    assert.equal(row.before, "UNCONSTRAINED");
    assert.equal(row.after, "CONSTRAINED");
    assert.equal(row.sourceAction, "action:main-deployment");
    assert.equal(row.sourceCause, "dev-force-cause:0");
    assert.equal(row.sourceConsequence, "dev-force-consequence:0");
    assert.deepEqual(row.sourceFacts, ["dev-fact:0:0"]);
    assert.deepEqual(row.sourceEvents, ["event:main-deployment"]);
});

test("unchanged relationship emits no transition", () => {
    const snapshot = initial({ reserveSupport: FORCE_RELATIONSHIP_STATUS.DENIED });
    const operation = supportOperation("DENIED", { relationId: "support:reserve:vanguard" });
    const result = run(input([operation], snapshot));
    assert.equal(result.history[0].status, "EXECUTED");
    assert.equal(result.history[0].transitions.length, 0);
});

test("duplicate action and event IDs are rejected without double application", () => {
    const first = supportOperation();
    const result = run(input([
        first,
        { ...supportOperation("CONFIRMED"), actionId: first.actionId, eventId: "event:second" },
        { ...supportOperation("CONFIRMED"), actionId: "action:third", eventId: first.eventId }
    ]));
    assert.deepEqual(result.history[1].reasons, ["DUPLICATE_ACTION_ID"]);
    assert.deepEqual(result.history[2].reasons, ["DUPLICATE_EVENT_ID"]);
    assert.equal(result.relationTransitions.length, 1);
});

test("missing and future causal references fail closed", () => {
    const result = run(input([supportOperation("DENIED", {
        sourceEventIds: ["future-event"], sourceCauseIds: ["missing-cause"]
    })]));
    assert.equal(result.history[0].status, "REJECTED");
    assert.equal(result.history[0].reasons.some(reason => reason.startsWith("INVALID_CAUSAL_REFERENCE:")), true);
    assert.equal(result.relationTransitions.length, 0);
});

test("unknown force and actor mismatch operations are rejected", () => {
    const result = run(input([
        stateOperation({ forceId: "UNKNOWN", actionId: "a1", eventId: "e1" }),
        stateOperation({ actor: "HUMAN", actionId: "a2", eventId: "e2" })
    ]));
    assert.deepEqual(result.history[0].reasons, ["UNKNOWN_FORCE"]);
    assert.deepEqual(result.history[1].reasons, ["FORCE_ACTOR_MISMATCH"]);
});

test("same input is immutable deterministic and restore detects tampering", () => {
    const value = input([stateOperation(), supportOperation()]);
    const before = JSON.stringify(value);
    const first = run(value);
    assert.deepEqual(first, run(value));
    assert.equal(JSON.stringify(value), before);
    assert.equal(Object.isFrozen(first), true);
    assert.deepEqual(restore(JSON.parse(JSON.stringify(first))), first);
    const changed = JSON.parse(JSON.stringify(first));
    changed.relationTransitions[0].after = "CONFIRMED";
    assert.throws(() => restore(changed), /FORCE_RELATIONSHIP_REPLAY_MISMATCH/);
});

test("finite operation limit stops execution without autonomous chaining", () => {
    const value = input([stateOperation(), supportOperation()]);
    value.maxOperations = 1;
    const result = run(value);
    assert.equal(result.stopped, "MAX_OPERATIONS_REACHED");
    assert.equal(result.history.length, 1);
    assert.equal(result.relationTransitions.length, 0);
});

test("foundation consumes zero gameplay RNG and changes no production outcome", () => {
    const random = Math.random;
    try {
        Math.random = () => { throw new Error("UNEXPECTED_RNG_USE"); };
        const result = run(input([stateOperation(), supportOperation()]));
        assert.deepEqual(result.resolutionBoundary, {
            productionTrialChanged: false,
            actionOutcomeResolved: false,
            damageChanged: false,
            opportunityChanged: false,
            fortuneChanged: false
        });
    } finally {
        Math.random = random;
    }
});

console.log(`Trial Force Relationship Foundation v1: ${cases}/${cases} cases PASS`);
