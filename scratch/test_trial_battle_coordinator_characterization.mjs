import assert from 'node:assert/strict';
import { TrialController } from '../game/src/trial/flow/trial_controller_base.js';
import { TrialBattleSequenceService } from '../game/src/trial/systems/trial_battle_sequence_service.js';
import { BattleOpportunityFortuneRuntimeBridge } from '../game/src/trial/systems/battle_opportunity_fortune_runtime_bridge.js';
import { BattleOpportunityFortuneLifecycleService } from '../game/src/trial/systems/battle_opportunity_fortune_lifecycle_service.js';
import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { TRIAL_BATTLE_STATUSES } from '../game/src/trial/domain/trial_types.js';

const traces = [];
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function harness(mode = 'pending') {
    let completions = 0, payments = 0, draws = 0;
    const sequence = new TrialBattleSequenceService();
    const complete = sequence.completeCurrentBattle.bind(sequence);
    sequence.completeCurrentBattle = (...args) => { completions++; return complete(...args); };
    const ember = { current: 8, consume(cost) { payments++; this.current -= cost; return true; } };
    const rng = {
        cursor: 0,
        nextInt() { draws++; return [4, 5][this.cursor++]; },
        getState() { return { cursor: this.cursor, draws }; },
        setState(s) { this.cursor = s.cursor; draws = s.draws; }
    };
    const lifecycle = new BattleOpportunityFortuneLifecycleService({
        opportunityPolicy: { evaluate(s) { return mode === 'none' ? { available: false } : {
            available: true, opportunity: { opportunityId: `opp:${s.battleId}`, state: 'AVAILABLE' }
        }; } },
        emberCostPolicy: { resolve() { return 2; } },
        emberSystem: ember, gameplayRandom: rng,
        fortuneResultPolicy: { resolve() { return { result: 'DECISIVE_SUCCESS' }; } },
        decisiveEventPolicy: { select() { return { eventId: 'test-event', type: 'TEST_ONLY' }; } },
        finalResultPolicy: {
            projectDeclined({ snapshot }) { return { ...snapshot.normalOutcome, marker: 'declined' }; },
            projectFortune({ snapshot }) { return { ...snapshot.normalOutcome, marker: 'fortune' }; }
        }
    });
    const bridge = mode === 'legacy' ? null : new BattleOpportunityFortuneRuntimeBridge({
        lifecycleService: lifecycle, sequenceService: sequence
    });
    const controller = new TrialController({ sequenceService: sequence, battleOpportunityFortuneRuntimeBridge: bridge });
    const scenario = { id: 'characterization', trialIndex: 1, availableDefense: 20, enemySuppression: 5,
        routes: [0, 1].map(i => ({ id: `R${i}`, cells: [{ r: i, c: 0 }, { r: i, c: 1 }] })) };
    controller.startScenario(scenario, { cellResolver: (r, c) => ({ r, c, placed: true, terrainId: 'E1_PLAINS', e: 1, gl: 1 }) });
    const drafts = new Map();
    for (const route of scenario.routes) controller.setRouteInterceptPlan(drafts, route.id, { r: Number(route.id[1]), c: 0 }, 5);
    assert.equal(controller.confirmInterceptionPlan(drafts, { allowWarnings: true }).success, true);
    assert.equal(controller.activateInterceptionPlan().success, true);
    assert.equal(controller.startNextBattle().success, true);
    const resolvedFacts = () => controller.gameFactHub.getFacts().filter(f => f.type === GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED);
    return { controller, bridge, sequence, ember, rng, scenario, resolvedFacts,
        counts: () => ({ completions, payments, draws }),
        record(label, response) { traces.push({ label, response, state: controller.state,
            facts: controller.gameFactHub.getFacts(), counts: this.counts() });
            traces[traces.length - 1] = JSON.parse(JSON.stringify(traces[traces.length - 1])); }
    };
}
function assertFrozen(snapshot) {
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.normalOutcome), true);
    assert.throws(() => { snapshot.normalOutcome.outcome = 'changed'; }, TypeError);
}
for (const mode of ['legacy', 'none']) check(`${mode}: completion and next battle`, () => {
    const h = harness(mode), c = h.controller;
    const response = c.resolveCurrentBattle();
    assert.equal(response.success, true);
    assertFrozen(response.battleResolutionSnapshot);
    assert.deepEqual(h.counts(), { completions: 1, payments: 0, draws: 0 });
    assert.equal(h.resolvedFacts().length, 1);
    assert.equal(c.resolveCurrentBattle().success, false);
    assert.deepEqual(h.counts(), { completions: 1, payments: 0, draws: 0 });
    h.record(mode, response);
    assert.equal(c.advanceAfterCurrentBattle().success, true);
    assert.equal(c.advanceAfterCurrentBattle().success, false);
    assert.equal(c.transitionAfterCurrentBattle().success, true);
    assert.equal(c.startNextBattle().battleIndex, 1);
    h.record(`${mode}:next`, c.getCurrentBattle());
});
check('pending and decline stop/resume exactly once', () => {
    const h = harness(), c = h.controller;
    const response = c.resolveCurrentBattle();
    assert.equal(response.pendingOpportunity, true);
    assert.equal(c.getCurrentBattle().status, TRIAL_BATTLE_STATUSES.ACTIVE);
    assert.equal(c.getCurrentBattleResult(), null);
    assert.deepEqual(h.counts(), { completions: 0, payments: 0, draws: 0 });
    assert.equal(h.resolvedFacts().length, 0);
    assert.equal(c.advanceAfterCurrentBattle().success, false);
    assert.equal(c.transitionAfterCurrentBattle().success, false);
    assertFrozen(response.battleResolutionSnapshot);
    h.record('pending', response);
    const declined = c.declineCurrentBattleOpportunity();
    assert.equal(declined.combatResult.finalCombatResult.marker, 'declined');
    assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), null);
    assert.equal(h.resolvedFacts().length, 1);
    assert.throws(() => c.declineCurrentBattleOpportunity(), /NOT_PENDING/);
    assert.deepEqual(h.counts(), { completions: 1, payments: 0, draws: 0 });
    h.record('declined', declined);
});
check('Fortune payment, dice, finalize and reference restoration', () => {
    const h = harness(), c = h.controller;
    const opened = c.resolveCurrentBattle().battleResolutionSnapshot;
    const committed = c.commitCurrentBattleOpportunity().battleResolutionSnapshot;
    assert.equal(opened.emberCommit, null);
    assert.throws(() => c.commitCurrentBattleOpportunity(), /ALREADY_COMMITTED/);
    const rolled = c.resolveCurrentBattleFortune().battleResolutionSnapshot;
    assert.deepEqual(rolled.fortuneRoll.dice, [4, 5]);
    assert.equal(committed.fortuneRoll, null);
    assert.equal(h.resolvedFacts().length, 0);
    assert.deepEqual(h.counts(), { completions: 0, payments: 1, draws: 2 });
    assert.throws(() => c.resolveCurrentBattleFortune(), /BATTLE_OPPORTUNITY_NOT_PENDING/);
    h.record('rolled', rolled);
    // Existing writable properties remain a compatible runtime reference handoff.
    // This does not invent or certify a durable save/load schema.
    const resumed = new TrialController({ sequenceService: h.sequence, battleOpportunityFortuneRuntimeBridge: h.bridge });
    resumed.state = c.state;
    resumed.gameFactHub = c.gameFactHub;
    resumed.battleResolutionSnapshots = c.battleResolutionSnapshots;
    resumed.battleOpportunityFortuneRuntime = c.battleOpportunityFortuneRuntime;
    assert.equal(Object.keys(resumed).includes('battleResolutionSnapshots'), true);
    assert.equal(resumed.getCurrentBattleResolutionSnapshot(), rolled);
    assert.throws(() => resumed.commitCurrentBattleOpportunity(), /BATTLE_OPPORTUNITY_NOT_PENDING/);
    assert.throws(() => resumed.resolveCurrentBattleFortune(), /BATTLE_OPPORTUNITY_NOT_PENDING/);
    const finalized = resumed.finalizeCurrentBattleFortune();
    assert.equal(finalized.combatResult.finalCombatResult.marker, 'fortune');
    assert.equal(finalized.battleResolutionSnapshot.finalized, true);
    assertFrozen(finalized.battleResolutionSnapshot);
    assert.equal(rolled.finalized, false);
    assert.equal(resumed.getCurrentBattleOpportunityFortuneRuntime(), null);
    assert.throws(() => resumed.finalizeCurrentBattleFortune(), /NOT_PENDING/);
    assert.deepEqual(h.counts(), { completions: 1, payments: 1, draws: 2 });
    assert.equal(h.resolvedFacts().length, 1);
    assert.equal(h.ember.current, 6);
    h.record('finalized', finalized);
});
check('snapshot failure leaves battle active and fact absent', () => {
    const h = harness('legacy'), c = h.controller;
    c.battleResolutionSnapshotFactory = { create() { throw new Error('SNAPSHOT_TEST_FAILURE'); } };
    assert.throws(() => c.resolveCurrentBattle(), /SNAPSHOT_TEST_FAILURE/);
    assert.equal(c.getCurrentBattle().status, TRIAL_BATTLE_STATUSES.ACTIVE);
    assert.equal(h.resolvedFacts().length, 0);
    assert.equal(h.counts().completions, 0);
});
check('sequence failure propagates without a resolved fact', () => {
    const h = harness('legacy'), c = h.controller;
    c.sequenceService = { completeCurrentBattle() { return { success: false, marker: 'completion-failed' }; } };
    assert.deepEqual(c.resolveCurrentBattle(), { success: false, marker: 'completion-failed' });
    assert.equal(h.resolvedFacts().length, 0);
});
// Count orchestration calls separately from payment/RNG/completion effects.
function instrument(h) {
    const calls = { combat: 0, snapshot: 0, open: 0, roll: 0 };
    for (const [service, method, counter] of [
        [h.controller.combatResolver, 'resolve', 'combat'],
        [h.controller.battleResolutionSnapshotFactory, 'create', 'snapshot'],
        [h.bridge, 'open', 'open'], [h.bridge, 'resolveFortune', 'roll']
    ]) {
        const original = service[method].bind(service);
        service[method] = (...args) => { calls[counter]++; return original(...args); };
    }
    return calls;
}
for (const phase of ['opened', 'committed', 'rolled']) check(`${phase}: resolve reentry fails before all effects`, () => {
    const h = harness(), c = h.controller, calls = instrument(h);
    c.resolveCurrentBattle();
    if (phase !== 'opened') c.commitCurrentBattleOpportunity();
    if (phase === 'rolled') c.resolveCurrentBattleFortune();
    const runtime = c.getCurrentBattleOpportunityFortuneRuntime();
    const snapshot = c.getCurrentBattleResolutionSnapshot();
    const before = JSON.stringify({ state: c.state, facts: c.gameFactHub.getFacts(),
        runtime, counts: h.counts(), calls, ember: h.ember.current, rng: h.rng.getState() });
    for (let i = 0; i < 2; i++) {
        assert.deepEqual(c.resolveCurrentBattle(), {
            success: false, errors: ['BATTLE_OPPORTUNITY_FORTUNE_RUNTIME_PENDING']
        });
        assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), runtime);
        assert.equal(c.getCurrentBattleResolutionSnapshot(), snapshot);
    }
    assert.equal(JSON.stringify({ state: c.state, facts: c.gameFactHub.getFacts(),
        runtime, counts: h.counts(), calls, ember: h.ember.current, rng: h.rng.getState() }), before);
    if (phase === 'opened') c.declineCurrentBattleOpportunity();
    else {
        if (phase === 'committed') c.resolveCurrentBattleFortune();
        c.finalizeCurrentBattleFortune();
    }
    assert.deepEqual(calls, { combat: 1, snapshot: 1, open: 1, roll: phase === 'opened' ? 0 : 1 });
    assert.deepEqual(h.counts(), { completions: 1, payments: phase === 'opened' ? 0 : 1,
        draws: phase === 'opened' ? 0 : 2 });
    assert.equal(h.resolvedFacts().length, 1);
    assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), null);
});
for (const phase of ['opened', 'committed', 'rolled']) check(`${phase}: scenario end discards references without domain effects`, () => {
    const h = harness(), c = h.controller, calls = instrument(h);
    assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), null);
    c.resolveCurrentBattle();
    if (phase !== 'opened') c.commitCurrentBattleOpportunity();
    if (phase === 'rolled') c.resolveCurrentBattleFortune();
    const runtime = c.getCurrentBattleOpportunityFortuneRuntime();
    const snapshot = runtime.snapshot;
    const retainedState = c.state;
    const before = JSON.stringify({ runtime, state: retainedState, facts: c.gameFactHub.getFacts(),
        counts: h.counts(), calls, ember: h.ember.current, rng: h.rng.getState() });
    c.endScenario();
    c.endScenario();
    assert.equal(c.state, null);
    assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), null);
    assert.deepEqual(c.battleResolutionSnapshots, []);
    assert.equal(c.getCurrentBattleResolutionSnapshot(), null);
    assert.equal(runtime.snapshot, snapshot);
    assert.equal(JSON.stringify({ runtime, state: retainedState, facts: c.gameFactHub.getFacts(),
        counts: h.counts(), calls, ember: h.ember.current, rng: h.rng.getState() }), before);
    c.startScenario({ ...h.scenario, id: 'next-scenario' });
    assert.equal(c.getCurrentBattleOpportunityFortuneRuntime(), null);
    assert.deepEqual(c.battleResolutionSnapshots, []);
    assert.equal(c.getBattleResolutionSnapshot(0), null);
    assert.throws(() => c.finalizeCurrentBattleFortune(), /RUNTIME_NOT_PENDING/);
    assert.deepEqual(h.counts(), { completions: 0, payments: phase === 'opened' ? 0 : 1,
        draws: phase === 'rolled' ? 2 : 0 });
    assert.equal(h.resolvedFacts().length, 0);
});
console.log(`Controller characterization: ${passed}/${passed} PASS`);
if (process.env.AOT_CHARACTERIZATION_TRACE) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.AOT_CHARACTERIZATION_TRACE, JSON.stringify(traces, null, 2));
}
