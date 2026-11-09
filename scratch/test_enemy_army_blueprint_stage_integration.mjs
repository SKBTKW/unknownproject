import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../game/src/core/game_engine.js';
import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { attachTrialRuntimeSubsystems } from '../game/src/trial/integration/trial_runtime_bootstrap.js';
import { attachTrialLaunchSubsystem } from '../game/src/trial/integration/trial_launch_bootstrap.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
function setup({ configured = false, blueprint = true } = {}) {
    const engine=GameEngine.createGame({runSeed:42,enemyArmyBlueprintPolicy:blueprint?fixturePolicy():null});
    const options={blueprintStageOptions:{policiesByStage:configured?{2:fixturePolicy(),3:fixturePolicy()}:{},generator:()=>{throw Error('STAGE_GENERATION_FORBIDDEN');}}};
    assert.equal(attachTrialRuntimeSubsystems(engine,options).success,true);
    return engine;
}
function advance(engine,trialIndex) {
    engine.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,{trialIndex,scenarioId:`TEST_${trialIndex}`,settlement:{runTerminated:false}});
    return engine.postTrialProgressionService.completeAfterPresentationCleanup();
}
const cardOptions=engine=>({resolveCardMaster:id=>[...engine.deckManager.getLandCardMaster(),...(engine.getAdditionalCardMastersForRestore?.()||[])].find(c=>c.id===id)});
test('real settlement only reserves; actual cleanup applies Stage2/3 and synchronous adapter no-ops',()=>{
    for(const configured of [false,true]) {
        const e=setup({configured});const ledger=e.enemyArmyBlueprintLifecycleService.getSnapshot();
        e.gameFactHub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,{trialIndex:1,scenarioId:'RESERVATION',settlement:{runTerminated:false}});
        assert.equal(e.state.stage.id,1);assert.equal(e.enemyArmyBlueprintStageAdapter.getLastResult(),null);
        assert.equal(e.postTrialProgressionService.completeAfterPresentationCleanup().success,true);
        assert.equal(e.state.stage.id,2);assert.equal(e.state.grid.length,7);
        assert.equal(e.enemyArmyBlueprintStageAdapter.getLastResult().status,configured?'MODEL_STAGE_UNSUPPORTED':'POLICY_NOT_CONFIGURED');
        const fact=e.gameFactHub.getFacts().find(f=>f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED);
        assert.equal(fact.payload.appliedNow,true);
        e.gameFactHub.emit(fact.type,fact.payload);
        assert.deepEqual(e.enemyArmyBlueprintLifecycleService.getSnapshot(),ledger);
        assert.equal(advance(e,2).success,true);assert.equal(e.state.stage.id,3);assert.equal(e.state.grid.length,9);
        assert.deepEqual(e.enemyArmyBlueprintLifecycleService.getSnapshot(),ledger);
        assert.equal(e.enemyArmyBlueprintLifecycleService.getBlueprint(2),null);
        assert.equal(e.enemyArmyBlueprintLifecycleService.getBlueprint(3),null);
    }
});
test('adapter is attached once and does not change existing Grid RNG, Truth or Trial scenarios',()=>{
    const a=setup(),b=setup();b.enemyArmyBlueprintStageAdapter.dispose();
    const original=a.enemyArmyBlueprintStageAdapter;assert.equal(attachTrialRuntimeSubsystems(a).success,true);assert.equal(a.enemyArmyBlueprintStageAdapter,original);
    for(const e of [a,b]) assert.equal(attachTrialLaunchSubsystem(e,{startTrialSession(){}}).success,true);
    const scenario=e=>e.trialLaunchScenarioFactory.build({trialIndex:1,gameState:e.state});
    assert.deepEqual(scenario(a),scenario(b));
    assert.equal(advance(a,1).success,true);assert.equal(advance(b,1).success,true);
    assert.deepEqual(a.gameplayRandom.getState(),b.gameplayRandom.getState());
    assert.deepEqual(a.checkSystem.getState(),b.checkSystem.getState());
    assert.deepEqual(a.trueEnemyStateService.getRestoreState(),b.trueEnemyStateService.getRestoreState());
    assert.deepEqual(serializeGameState(a.state),serializeGameState(b.state));
    assert.deepEqual(scenario(a),scenario(b));
});
test('before/after snapshots, JSON and History restore preserve army and old saves remain empty',()=>{
    for(const blueprint of [false,true]) {
        const e=setup({blueprint});const ledger=e.enemyArmyBlueprintLifecycleService.getSnapshot();
        const before=e.historySnapshotService.getRestorePoint(1);const immutableBefore=structuredClone(before);
        assert.equal(advance(e,1).success,true);
        e.state.turn=2;const after=e.historySnapshotService.captureRestorePoint({verse:2});const immutableAfter=structuredClone(after);
        const saved=JSON.parse(JSON.stringify(serializeGameState(e.state)));
        hydrateGameState(e.state,saved,cardOptions(e));assert.equal(e.state.stage.id,2);
        const stageFact=e.gameFactHub.getFacts().find(f=>f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED);
        e.gameFactHub.emit(stageFact.type,{...stageFact.payload,appliedNow:false});
        assert.equal(e.enemyArmyBlueprintStageAdapter.getLastResult().status,'REPLAY_IGNORED');
        assert.equal(e.historyRestoreService.restoreVerse(2).success,true);assert.equal(e.state.stage.id,2);
        assert.deepEqual(e.enemyArmyBlueprintLifecycleService.getSnapshot(),ledger);
        assert.equal(e.historyRestoreService.restoreVerse(1).success,true);assert.equal(e.state.stage.id,1);
        e.gameFactHub.emit(stageFact.type,stageFact.payload);
        assert.equal(e.enemyArmyBlueprintStageAdapter.getLastResult().status,'NOT_APPLIED');
        assert.deepEqual(e.enemyArmyBlueprintLifecycleService.getSnapshot(),ledger);
        assert.deepEqual(before,immutableBefore);assert.deepEqual(after,immutableAfter);
    }
});
test('reconcile notification is explicitly non-live and no snapshot occurs between actual apply and adapter',()=>{
    const e=setup();advance(e,1);
    const transition=e.state.postTrialTransition;
    transition.status='PENDING_STEPS';const step=transition.steps.find(s=>s.type==='STAGE_ADVANCE');step.status='PENDING';
    const result=e.postTrialProgressionService.completeAfterPresentationCleanup();assert.equal(result.success,true);
    const fact=e.gameFactHub.getFacts().filter(f=>f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED).at(-1);
    assert.equal(fact.payload.appliedNow,false);assert.equal(e.enemyArmyBlueprintStageAdapter.getLastResult().status,'REPLAY_IGNORED');
    // Existing application contains no History capture inside the stage-apply/event gap.
    const live=setup();let captures=0;const original=live.historySnapshotService.captureRestorePoint.bind(live.historySnapshotService);
    live.historySnapshotService.captureRestorePoint=(...args)=>{captures++;return original(...args);};
    let observed=false;
    live.gameFactHub.subscribe(f=>{if(f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED){observed=true;assert.equal(live.state.stage.id,2);assert.ok(live.enemyArmyBlueprintStageAdapter.getLastResult());}});
    advance(live,1);assert.equal(observed,true);assert.equal(captures,0);
});
