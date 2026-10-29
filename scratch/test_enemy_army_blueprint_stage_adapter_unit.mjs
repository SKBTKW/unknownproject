import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { EnemyArmyBlueprintStageAdapter as Adapter } from '../game/src/trial/integration/enemy_army_blueprint_stage_adapter.js';
import { EnemyArmyBlueprintLifecycleService as Lifecycle } from '../game/src/trial/systems/enemy_army_blueprint_lifecycle_service.js';
import { generateEnemyArmyBlueprint } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const applied = stageId => ({ type: GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED,
    payload: { appliedNow: true, toStageId: stageId, result: { success: true, stageId } } });
function setup(stageId = 1, extra = {}) {
    const gameState = { stage: { id: stageId }, runSeed: 42 }; const gameFactHub = new GameFactHub();
    const lifecycleService = new Lifecycle({ gameState });
    const adapter = new Adapter({ gameState, gameFactHub, lifecycleService, ...extra });
    return { gameState, gameFactHub, lifecycleService, adapter };
}
test('settlement/reservation, unsuccessful or unapplied mismatched notifications do not generate', () => {
    let calls = 0; const h = setup(1, { policiesByStage: { 1: fixturePolicy() }, generator: () => { calls++; throw Error('UNEXPECTED'); } });
    h.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, { trialIndex: 1 });
    assert.equal(h.adapter.getLastResult(), null);
    for (const fact of [applied(2), { ...applied(1), payload: { ...applied(1).payload, appliedNow: false } },
        { ...applied(1), payload: { ...applied(1).payload, result: { success: false, stageId: 1 } } }]) h.adapter.handleFact(fact);
    assert.equal(calls, 0); assert.equal(h.lifecycleService.getBlueprint(1), null);
});
test('missing Stage2/3 policies and unsupported model stages are safe no-ops', () => {
    for (const stage of [2,3]) for (const configured of [false,true]) {
        const h = setup(stage, { policiesByStage: configured ? { [stage]: fixturePolicy() } : {}, generator: () => { throw Error('UNSUPPORTED_GENERATION'); } });
        for (let i=0;i<2;i++) assert.equal(h.adapter.handleFact(applied(stage)).status, configured ? 'MODEL_STAGE_UNSUPPORTED' : 'POLICY_NOT_CONFIGURED');
        assert.deepEqual(h.lifecycleService.getSnapshot().blueprints, []);
    }
});
test('synthetic supported-Stage1 applied fact exercises future registration port exactly once', () => {
    let calls = 0; const policy = fixturePolicy();
    const h = setup(1, { policiesByStage: { 1: policy }, generator: args => { calls++; return generateEnemyArmyBlueprint(args); } });
    policy.slots.A.length = 0;
    assert.equal(h.adapter.handleFact(applied(1)).status, 'REGISTERED');
    const before = h.lifecycleService.getSnapshot();
    assert.equal(h.adapter.handleFact(applied(1)).status, 'EXISTING_BLUEPRINT');
    assert.equal(calls, 1); assert.deepEqual(h.lifecycleService.getSnapshot(), before);
    h.adapter.getLastResult().status = 'MUTATED'; assert.equal(h.adapter.getLastResult().status, 'EXISTING_BLUEPRINT');
});
test('existing Blueprint is SSOT even for a newly attached adapter; conflict stays a lifecycle error', () => {
    const h=setup(); const blueprint=generateEnemyArmyBlueprint({runSeed:42,stageId:1,policy:fixturePolicy()});
    assert.equal(h.lifecycleService.registerBlueprint(1,blueprint).registered,true);
    assert.equal(h.lifecycleService.registerBlueprint(1,blueprint).registered,false);
    assert.equal(h.adapter.handleFact(applied(1)).status,'EXISTING_BLUEPRINT');
    const changed=blueprint.getSnapshot();changed.generationPolicy.version++;
    assert.throws(()=>h.lifecycleService.registerBlueprint(1,changed),/ALREADY_REGISTERED/);
});
test('Restore and reconciled/legacy facts never generate absent data', () => {
    let restoring=true; const h=setup(1,{policiesByStage:{1:fixturePolicy()},isRestoring:()=>restoring,generator:()=>{throw Error('RESTORE_GENERATION');}});
    assert.equal(h.adapter.handleFact(applied(1)).status,'RESTORE_IGNORED'); restoring=false;
    const replay=applied(1); replay.payload.appliedNow=false;
    assert.equal(h.adapter.handleFact(replay).status,'REPLAY_IGNORED'); delete replay.payload.appliedNow;
    assert.equal(h.adapter.handleFact(replay).status,'REPLAY_IGNORED'); assert.equal(h.lifecycleService.getBlueprint(1),null);
});
test('invalid injected policies fail explicitly before subscribing, including unsupported Stage policies', () => {
    for (const policiesByStage of [null,[],{'02':fixturePolicy()},{2:{}},{2:null}]) assert.throws(()=>setup(2,{policiesByStage}),/BLUEPRINT/);
    const bad=fixturePolicy();bad.slots.C[0].weight=-1;
    assert.throws(()=>setup(2,{policiesByStage:{2:bad}}),/WEIGHT_INVALID/);
});
test('event errors are exposed without breaking synchronous Stage listeners; no partial registration', () => {
    const h=setup(1,{policiesByStage:{1:fixturePolicy()},generator:()=>({})}); let observed=false;
    h.gameFactHub.subscribe(()=>{observed=true;});
    h.gameFactHub.emit(applied(1).type,applied(1).payload);
    assert.equal(observed,true);assert.equal(h.adapter.getLastResult().success,false);
    assert.match(h.adapter.getLastResult().message,/ENEMY_BLUEPRINT/);assert.equal(h.lifecycleService.getBlueprint(1),null);
});
test('dispose is idempotent and detaches the observer',()=>{
    const h=setup();h.adapter.dispose();h.adapter.dispose();h.gameFactHub.emit(applied(1).type,applied(1).payload);
    assert.equal(h.adapter.getLastResult(),null);
});
