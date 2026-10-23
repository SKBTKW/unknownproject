import assert from "node:assert/strict";
import { BattleResolutionSnapshotFactory } from "../game/src/trial/systems/battle_resolution_snapshot_factory.js";
import { createTacticRequirement } from "../game/src/trial/domain/tactic_requirement.js";
import { evolveBattleResolutionSnapshot } from "../game/src/trial/domain/battle_resolution_snapshot.js";
import { validateTacticalCausality as run, restoreTacticalCausality as restore } from "../game/src/trial/dev/tactical_causality_validation_model.js";

// Explicit validation fixture, not production balance, AI or tactic policy.
const tactic = (tacticId, actor, states) => ({ tacticId, actor,
    actionTypes: tacticId === "RESPONSE" ? ["PURSUE", "IGNORE", "CAPTURE", "BLOCK_ESCAPE"]
        : [tacticId === "CHARGE" ? "COLLECTIVE_CHARGE" : tacticId],
    requirement: createTacticRequirement({ requiredStates: states }) });
// The dev adapter consumes the existing TacticRequirement states axis.
const tactics = [
    tactic("SKIRMISH", "HUMAN", ["FREE_MOVEMENT", "ESCAPE_ROUTE"]),
    tactic("INTERCEPT", "HUMAN", ["FREE_MOVEMENT"]),
    tactic("HOLD", "HUMAN", ["FREE_MOVEMENT"]),
    tactic("CHARGE", "ENEMY", ["LARGE_BODY", "DEPLOYMENT_SPACE", "ORDERED_FORMATION"]),
    tactic("RESPONSE", "ENEMY", [])
];
function input(terrainId = "GL1_PLAINS", actions = []) {
    return {
        baseSnapshot: new BattleResolutionSnapshotFactory().create({
            battleContext: { interceptCell: { terrainId, r: 1, c: 1 }, enemy: {
                deployment: { profile: { bodySize: "LARGE" } }
            } }, combatResult: { human: { finalPower: 50 }, enemy: { finalPower: 80 },
                prediction: { outcome: "BREAKTHROUGH", margin: -30 } }
        }),
        initialState: { human: { freedom: "FREE", escapeRoute: "AVAILABLE" },
            enemy: { formation: "ORDERED", pursuit: "NONE" } },
        initialStateReason: "Fixture assumes an ordered force and a scouted available escape route; not pathfinding evidence",
        tactics, actions
    };
}
const skirmish = { actionId: "h1", type: "SKIRMISH", actor: "HUMAN", tacticId: "SKIRMISH", reason: "Player selected a lure" };
const pursue = { actionId: "e1", type: "PURSUE", actor: "ENEMY", tacticId: "RESPONSE", sourceActionId: "h1",
    reason: "External reckless commander decision", overextended: true, evidence: { overextended: "External resolver reports vanguard separated from support" } };
const ignore = { actionId: "e1", type: "IGNORE", actor: "ENEMY", tacticId: "RESPONSE", sourceActionId: "h1",
    reason: "External cautious commander maintains advance" };
const capture = { actionId: "c1", type: "CAPTURE", actor: "ENEMY", tacticId: "RESPONSE", success: true,
    reason: "External capture decision", evidence: { success: "External adjudicator reports capture" } };
const charge = { actionId: "charge", type: "COLLECTIVE_CHARGE", actor: "ENEMY", tacticId: "CHARGE", reason: "Explicit charge order" };
const eligibility = (result, id) => result.finalEligibility.find(row => row.tacticId === id);
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }

test("A: skirmish, pursuit, disruption makes charge ineligible", () => {
    const result = run(input("GL1_PLAINS", [skirmish, pursue, charge]));
    assert.equal(result.initialEligibility.find(row => row.tacticId === "CHARGE").eligible, true);
    assert.equal(result.finalState.enemy.formation, "DISRUPTED");
    assert.equal(eligibility(result, "CHARGE").eligible, false);
    assert.deepEqual(eligibility(result, "CHARGE").reasons, [{ axis: "STATE", value: "ORDERED_FORMATION" }]);
    assert.equal(result.history[2].status, "REJECTED");
    assert.equal(result.history[1].transitions.length, 2);
});
test("B: ignore preserves charge, skirmish alone has no cancellation", () => {
    for (const actions of [[skirmish], [skirmish, ignore, charge]]) {
        const result = run(input("GL1_PLAINS", actions));
        assert.equal(eligibility(result, "CHARGE").eligible, true);
        assert.equal(result.finalState.enemy.formation, "ORDERED");
    }
});
test("pursuit without overextension preserves formation", () => {
    const result = run(input("GL1_PLAINS", [skirmish, { ...pursue, overextended: false }]));
    assert.equal(eligibility(result, "CHARGE").eligible, true);
    assert.equal(result.finalState.enemy.pursuit, "PURSUING");
});
test("same charge requirement differs across plains, forest and hill", () => {
    for (const terrain of ["GL1_PLAINS", "GL2_FOREST", "E2_HILL"]) {
        const result = run(input(terrain, [charge]));
        assert.equal(eligibility(result, "CHARGE").eligible, terrain === "GL1_PLAINS");
    }
});
test("capture invalidates human skirmish, interception and hold requirements", () => {
    const result = run(input("GL1_PLAINS", [capture, skirmish, pursue]));
    for (const id of ["SKIRMISH", "INTERCEPT", "HOLD"]) assert.equal(eligibility(result, id).eligible, false);
    assert.equal(result.history[1].status, "REJECTED");
    assert.equal(result.history[2].status, "REJECTED");
    assert.equal(result.finalState.enemy.formation, "ORDERED");
});
test("failed capture does not impede human tactics", () => {
    const result = run(input("GL1_PLAINS", [{ ...capture, success: false }, skirmish]));
    assert.equal(eligibility(result, "SKIRMISH").eligible, true);
    assert.equal(result.history[0].consequences.length, 0);
    assert.equal(result.history[1].status, "EXECUTED");
});
test("route blocking impedes skirmish via state, not tactic matchup", () => {
    const result = run(input("GL1_PLAINS", [{ ...capture, type: "BLOCK_ESCAPE" }, skirmish]));
    assert.equal(eligibility(result, "SKIRMISH").eligible, false);
    assert.equal(eligibility(result, "INTERCEPT").eligible, true);
    assert.equal(result.history[1].reasons.includes("NO_ESCAPE_ROUTE"), true);
});
test("externally ordered sequence controls causality; no fixed first side", () => {
    const first = run(input("GL1_PLAINS", [capture, skirmish, pursue]));
    const last = run(input("GL1_PLAINS", [skirmish, pursue, capture]));
    assert.equal(first.finalState.enemy.formation, "ORDERED");
    assert.equal(last.finalState.enemy.formation, "DISRUPTED");
});
test("both sides are reevaluated after every consequence and nothing auto executes", () => {
    const result = run(input("GL1_PLAINS", [skirmish, pursue]));
    assert.equal(result.history.length, 2);
    for (const transition of result.history[1].transitions) {
        assert.equal(transition.beforeEligibility.length, tactics.length);
        assert.equal(transition.afterEligibility.length, tactics.length);
    }
    assert.equal(result.history.some(row => row.type === "COLLECTIVE_CHARGE"), false);
});
test("duplicate IDs are recorded as rejected and never applied twice", () => {
    const result = run(input("GL1_PLAINS", [skirmish, pursue, pursue, { ...capture, actionId: "e1" }]));
    assert.deepEqual(result.processedActionIds, ["h1", "e1"]);
    assert.deepEqual(result.history[2].reasons, ["DUPLICATE_ACTION_ID"]);
    assert.equal(result.history[3].consequences.length, 0);
    assert.equal(result.finalState.human.freedom, "FREE");
    assert.equal(result.stopped, "END_OF_INPUT");
});
test("causal provenance, requirements, before/after state and evidence survive serialization", () => {
    const result = run(input("GL1_PLAINS", [skirmish, pursue]));
    const row = result.history[1];
    assert.equal(row.causes[1].sourceAction, "e1");
    assert.deepEqual(row.causes[1].sourceCauses, [row.causes[0].causeId]);
    assert.equal(row.causes[1].derivedFrom.includes("h1"), true);
    assert.equal(row.consequences[1].sourceCauses[0], row.causes[1].causeId);
    assert.equal(row.unverifiedExternalFacts[0].status, "UNVERIFIED_EXTERNAL_FACT");
    assert.equal(row.beforeState.enemy.formation, "ORDERED");
    assert.equal(row.afterState.enemy.formation, "DISRUPTED");
    assert.deepEqual(restore(JSON.parse(JSON.stringify(result))), result);
});
test("same input gives same output, frozen history and base snapshot unchanged", () => {
    const source = input("GL1_PLAINS", [skirmish, pursue]);
    const before = JSON.stringify(source);
    const a = run(source);
    assert.deepEqual(a, run(source));
    assert.equal(JSON.stringify(source), before);
    assert.equal(Object.isFrozen(a.history[1].consequences[0].resultingState), true);
    assert.deepEqual(a.baseSnapshot, source.baseSnapshot);
    assert.equal("history" in a.baseSnapshot, false);
    assert.deepEqual(a.baseSnapshot.normalOutcome, source.baseSnapshot.normalOutcome);
});
test("production snapshot still evolves Opportunity/Fortune independently", () => {
    const source = input();
    source.baseSnapshot = evolveBattleResolutionSnapshot(source.baseSnapshot, {
        opportunity: { available: true }, fortuneRoll: { dice: [2, 5] }, emberCommit: { amount: 1 }
    });
    assert.deepEqual(run(source).baseSnapshot, source.baseSnapshot);
});
test("restore rejects modified history and invalid schema", () => {
    const saved = JSON.parse(JSON.stringify(run(input("GL1_PLAINS", [skirmish, pursue]))));
    saved.finalState.enemy.formation = "ORDERED";
    assert.throws(() => restore(saved), /REPLAY_MISMATCH/);
    assert.throws(() => restore({}), /INVALID_VALIDATION_SCHEMA/);
});
test("unknown or blocked escape cannot support a normal disengagement", () => {
    for (const route of ["BLOCKED", "UNKNOWN"]) {
        const source = input("GL1_PLAINS", [skirmish, pursue]);
        source.initialState.human.escapeRoute = route;
        const result = run(source);
        assert.equal(result.history[0].status, "REJECTED");
        assert.equal(result.history[1].status, "REJECTED");
        assert.equal(result.finalState.enemy.formation, "ORDERED");
    }
});
test("external success needs evidence and typed decision outcome", () => {
    for (const action of [{ ...capture, evidence: {} }, { ...capture, success: "yes" }, { ...capture, reason: "" }]) {
        const result = run(input("GL1_PLAINS", [action]));
        assert.equal(result.history[0].status, "REJECTED");
        assert.equal(result.finalState.human.freedom, "FREE");
    }
});
test("pursuit requires a preceding executed skirmish and overextension evidence", () => {
    for (const actions of [[pursue], [pursue, skirmish], [skirmish, { ...pursue, evidence: {} }]]) {
        const result = run(input("GL1_PLAINS", actions));
        assert.equal(result.finalState.enemy.formation, "ORDERED");
    }
});
test("known inaccessible destination rejects movement despite external success", () => {
    for (const movement of [
        { canEnter: false, reason: "Known blocked destination" },
        { canEnter: true, reason: "Claimed success", destinationCell: { terrainId: "E3_MOUNTAIN" } }
    ]) {
        const result = run(input("GL1_PLAINS", [{ ...capture, movement }]));
        assert.equal(result.history[0].status, "REJECTED");
        assert.equal(result.finalState.human.freedom, "FREE");
    }
});
test("unverifiable movement stays explicitly external instead of inventing physics", () => {
    const result = run(input("GL1_PLAINS", [{ ...capture, movement: { canEnter: true, reason: "External route adjudication" } }]));
    assert.equal(result.history[0].unverifiedExternalFacts.some(row => row.fact === "DESTINATION_ACCESS"), true);
});
test("malformed actors, tactics, state injection and unsupported actions fail closed", () => {
    const bad = input(); bad.initialState.human.externalTokens = ["FREE_MOVEMENT"];
    assert.throws(() => run(bad), /EXTERNAL_STATE_TOKENS_FORBIDDEN/);
    assert.throws(() => run(input("GL1_PLAINS", [{ ...skirmish, actor: "OTHER" }])), /INVALID_DECLARED_ACTION/);
    assert.equal(run(input("GL1_PLAINS", [{ ...skirmish, type: "UNKNOWN" }])).history[0].status, "REJECTED");
    assert.equal(run(input("GL1_PLAINS", [{ ...capture, type: "SKIRMISH" }])).history[0].status, "REJECTED");
});
test("finite long schedule never produces an autonomous chain", () => {
    const source = input("GL1_PLAINS", Array.from({ length: 300 }, (_, i) => ({ ...ignore, actionId: `i${i}` })));
    const result = run(source);
    assert.equal(result.history.length, 300);
    assert.equal(result.stopped, "END_OF_INPUT");
    assert.equal(result.history.every(row => row.consequences.length === 0), true);
});
test("action cannot borrow an unrelated tactic's empty requirements", () => {
    const result = run(input("GL2_FOREST", [{ ...charge, tacticId: "RESPONSE" }]));
    assert.equal(result.history[0].status, "REJECTED");
    assert.equal(result.history[0].reasons.includes("ACTION_TACTIC_MISMATCH"), true);
});
test("unchanged state does not emit duplicate causal changes", () => {
    const result = run(input("GL1_PLAINS", [capture, { ...capture, actionId: "c2" }]));
    assert.equal(result.history[1].causes.length, 0);
    assert.equal(result.history[1].transitions.length, 0);
});
test("later overextension after an unchanged pursuit remains valid and uses existing causal event", () => {
    const result = run(input("GL1_PLAINS", [skirmish, { ...pursue, overextended: false },
        { ...pursue, actionId: "e2" }]));
    assert.equal(result.finalState.enemy.formation, "DISRUPTED");
    assert.equal(result.history[2].causalEvents.some(row => row.type === "ENEMY_VANGUARD_ISOLATED"), true);
});
test("large body is a separate charge requirement and no RNG is consumed", () => {
    const source = JSON.parse(JSON.stringify(input("GL1_PLAINS", [skirmish, pursue])));
    source.baseSnapshot.battlefieldContext.enemy.bodySize = "SMALL";
    const random = Math.random;
    try {
        Math.random = () => { throw new Error("UNEXPECTED_RNG_USE"); };
        const result = run(source);
        assert.equal(result.initialEligibility.find(row => row.tacticId === "CHARGE").eligible, false);
        assert.deepEqual(restore(JSON.parse(JSON.stringify(result))), result);
    } finally { Math.random = random; }
});
console.log(`Bidirectional tactical causality validation: ${count}/${count} cases PASS`);
