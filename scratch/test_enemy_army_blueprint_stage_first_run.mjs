import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { attachTrialRuntimeSubsystems } from '../game/src/trial/integration/trial_runtime_bootstrap.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { fixturePolicy } from './enemy_army_blueprint_test_fixture.mjs';
const original=GameEngine.createGame;let engine=null;let expected=null;let initial=null;let applied=0;
GameEngine.createGame=function(options){
    assert.equal(engine,null);
    engine=original.call(this,{...options,enemyArmyBlueprintPolicy:fixturePolicy()});
    expected=engine.enemyArmyBlueprintLifecycleService.getSnapshot();
    initial=structuredClone(engine.historySnapshotService.getRestorePoint(1));
    assert.equal(attachTrialRuntimeSubsystems(engine,{blueprintStageOptions:{policiesByStage:{2:fixturePolicy()},generator:()=>{throw Error('STAGE2_GENERATION_FORBIDDEN');}}}).success,true);
    engine.gameFactHub.subscribe(f=>{if(f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED&&f.payload.appliedNow){
        applied++;assert.equal(engine.state.stage.id,2);assert.equal(engine.state.grid.length,7);
        assert.equal(engine.enemyArmyBlueprintStageAdapter.getLastResult().status,'MODEL_STAGE_UNSUPPORTED');
    }});
    return engine;
};
try{await import('./test_first_run_stage1_completion.mjs');}finally{GameEngine.createGame=original;}
assert.ok(engine);assert.equal(applied,1);assert.equal(engine.state.stage.id,2);
assert.deepEqual(engine.enemyArmyBlueprintLifecycleService.getSnapshot(),expected);
assert.deepEqual(engine.historySnapshotService.getRestorePoint(1),initial);
const saved=JSON.parse(JSON.stringify(serializeGameState(engine.state)));
const masters=[...engine.deckManager.getLandCardMaster(),...(engine.getAdditionalCardMastersForRestore?.()||[])];
hydrateGameState(engine.state,saved,{resolveCardMaster:id=>masters.find(c=>c.id===id)});
const fact=engine.gameFactHub.getFacts().find(f=>f.type===GAME_FACT_TYPES.POST_TRIAL_STAGE_ADVANCED);
engine.gameFactHub.emit(fact.type,{...fact.payload,appliedNow:false});
assert.equal(engine.enemyArmyBlueprintStageAdapter.getLastResult().status,'REPLAY_IGNORED');
assert.deepEqual(engine.enemyArmyBlueprintLifecycleService.getSnapshot(),expected);
assert.equal(engine.enemyArmyBlueprintLifecycleService.getBlueprint(2),null);
console.log('PASS: applied Stage adapter observes canonical FirstRun once, retains Stage1 army and leaves Stage2 ungenerated after save/restore');
