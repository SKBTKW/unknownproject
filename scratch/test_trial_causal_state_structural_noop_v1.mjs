import assert from "node:assert/strict";
import {
    applyActorScopedBattleTransition,
    applyForceScopedBattleTransition,
    createActorScopedBattleState,
    createForceScopedBattleState
} from "../game/src/trial/domain/battle_causality_execution.js";

let cases = 0;
function test(name, fn) {
    fn();
    cases += 1;
    console.log(`PASS ${name}`);
}

const provenance = Object.freeze({
    actionId: "action:structural-noop",
    causeId: "cause:structural-noop",
    consequenceId: "consequence:structural-noop",
    eventId: "event:structural-noop",
    sourceFactIds: ["fact:structural-noop"],
    sourceEventIds: ["event:evidence"],
    order: 7,
    step: 2
});

function forceState(state = {}) {
    return createForceScopedBattleState([{
        forceId: "ENEMY_MAIN",
        actor: "ENEMY",
        state
    }]);
}

function applyForce(state, resultingState) {
    return applyForceScopedBattleTransition({
        state,
        update: { actor: "ENEMY", forceId: "ENEMY_MAIN", resultingState },
        ...provenance
    });
}

function actorState(human = {}) {
    return createActorScopedBattleState({ human, enemy: {} });
}

function applyActor(state, resultingState) {
    return applyActorScopedBattleTransition({
        state,
        update: { target: "human", forceId: "HUMAN_MAIN", resultingState },
        ...provenance
    });
}

test("equal force coordinates are a no-op", () => {
    const initial = forceState({ position: { r: 2, c: 2 } });
    const before = structuredClone(initial);
    const result = applyForce(initial, { position: { r: 2, c: 2 } });
    assert.equal(result.transitions.length, 0);
    assert.deepEqual(result.state, before);
    assert.deepEqual(initial, before);
});

test("object key order does not create a force transition", () => {
    const result = applyForce(
        forceState({ position: { r: 2, c: 2 } }),
        { position: { c: 2, r: 2 } }
    );
    assert.equal(result.transitions.length, 0);
});

test("actual force movement preserves before after and provenance", () => {
    const initial = forceState({ position: { r: 2, c: 2 } });
    const result = applyForce(initial, { position: { r: 1, c: 2 } });
    assert.equal(result.transitions.length, 1);
    assert.deepEqual(result.state.ENEMY_MAIN.state.position, { r: 1, c: 2 });
    assert.deepEqual(initial.ENEMY_MAIN.state.position, { r: 2, c: 2 });
    assert.deepEqual(result.transitions[0], {
        transitionId: "dev-force-transition:7:2:position",
        eventId: provenance.eventId,
        target: { actor: "ENEMY", forceId: "ENEMY_MAIN" },
        state: "position",
        before: { r: 2, c: 2 },
        after: { r: 1, c: 2 },
        sourceAction: provenance.actionId,
        sourceCause: provenance.causeId,
        sourceConsequence: provenance.consequenceId,
        sourceFacts: provenance.sourceFactIds,
        sourceEvents: provenance.sourceEventIds,
        order: 7
    });
});

test("equal arrays are a no-op", () => {
    const result = applyForce(forceState({ formation: ["A", "B"] }), {
        formation: ["A", "B"]
    });
    assert.equal(result.transitions.length, 0);
});

test("array order changes create a transition", () => {
    const result = applyForce(forceState({ formation: ["A", "B"] }), {
        formation: ["B", "A"]
    });
    assert.equal(result.transitions.length, 1);
    assert.deepEqual(result.transitions[0].before, ["A", "B"]);
    assert.deepEqual(result.transitions[0].after, ["B", "A"]);
});

test("equal actor-scoped objects are a no-op", () => {
    const initial = actorState({ position: { r: 2, c: 2 } });
    const before = structuredClone(initial);
    const result = applyActor(initial, { position: { c: 2, r: 2 } });
    assert.equal(result.transitions.length, 0);
    assert.deepEqual(result.state, before);
    assert.deepEqual(initial, before);
});

test("actual actor-scoped changes preserve causal provenance", () => {
    const result = applyActor(actorState({ stance: { mode: "READY" } }), {
        stance: { mode: "ENGAGED" }
    });
    assert.equal(result.transitions.length, 1);
    assert.deepEqual(result.transitions[0].before, { mode: "READY" });
    assert.deepEqual(result.transitions[0].after, { mode: "ENGAGED" });
    assert.deepEqual(result.transitions[0].target, { actor: "HUMAN", forceId: "HUMAN_MAIN" });
    assert.equal(result.transitions[0].sourceAction, provenance.actionId);
    assert.equal(result.transitions[0].sourceCause, provenance.causeId);
    assert.equal(result.transitions[0].sourceConsequence, provenance.consequenceId);
    assert.deepEqual(result.transitions[0].sourceFacts, provenance.sourceFactIds);
    assert.deepEqual(result.transitions[0].sourceEvents, provenance.sourceEventIds);
});

test("nested object key order remains structurally equal", () => {
    const result = applyForce(forceState({
        plan: { route: [{ r: 2, c: 2 }, { r: 1, c: 2 }], timing: { turn: 3, phase: "A" } }
    }), {
        plan: { timing: { phase: "A", turn: 3 }, route: [{ c: 2, r: 2 }, { c: 2, r: 1 }] }
    });
    assert.equal(result.transitions.length, 0);
});

test("null and undefined keep primitive Object.is no-op semantics", () => {
    const state = forceState({ marker: null });
    const result = applyForce(state, { marker: null, optional: undefined });
    assert.equal(result.transitions.length, 0);
    assert.deepEqual(result.state, state);
});

test("same input produces deterministic output without snapshot mutation", () => {
    const initial = forceState({ position: { r: 2, c: 2 }, formation: ["A", "B"] });
    const before = structuredClone(initial);
    const update = { position: { r: 1, c: 2 }, formation: ["A", "B"] };
    const first = applyForce(initial, update);
    const second = applyForce(initial, update);
    assert.deepEqual(first, second);
    assert.deepEqual(initial, before);
    assert.equal(first.transitions.length, 1);
});

console.log(`Causal State Structural No-op v1: ${cases}/${cases} cases PASS`);
