import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { analyzeArmyDistribution as analyze, createDistributionPolicies as policies, distributionMarkdown, validateSeedRange } from './enemy_army_generation_distribution.mjs';
import { generateEnemyArmyBlueprint as generate } from '../game/src/trial/systems/enemy_army_blueprint_generator.js';
import { GameEngine } from '../game/src/core/game_engine.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('same seeds/policies replay, selection and model order cannot consume another model stream',()=>{
    const first=analyze({count:24});assert.deepEqual(analyze({count:24}),first);
    const reverse=analyze({count:24,models:['C','B','A']});
    for(const name of ['A','B','C'])assert.deepEqual(first.results[name],reverse.results[name]);
    assert.deepEqual(analyze({count:24,models:['B']}).results.B,first.results.B);
    const p=policies().A;assert.deepEqual(generate({runSeed:42,stageId:1,policy:p}).getSnapshot(),generate({runSeed:42,stageId:1,policy:p}).getSnapshot());
});
test('actual Generator receives the identical explicit seed set in each model and stable slots',()=>{
    const visits={};const report=analyze({count:5,startSeed:7,generator:args=>{
        (visits[args.policy.id]??=[]).push(args.runSeed);
        const blueprint=generate(args);assert.deepEqual(blueprint.getSnapshot().forces.map(f=>f.slot),['A','B','C']);return blueprint;
    }});
    for(const seeds of Object.values(visits))assert.deepEqual(seeds,[7,7,8,8,9,9,10,10,11,11]);
    for(const r of Object.values(report.results))assert.equal(r.seedSetDigest,report.seeds.digest);
});
test('known mixed marginals tally exactly; co-presence is not a fabricated individual cross-tab',()=>{
    const p=policies();const candidate=p.A.slots.A[0];for(const slot of ['A','B','C'])p.A.slots[slot]=[structuredClone(candidate)];
    const r=analyze({count:10,models:['A'],policies:p}).results.A;
    assert.equal(r.overall.samples,30);near(r.overall.speciesMeanShare.LARGE,.6);near(r.overall.speciesMeanShare.MEDIUM,.25);near(r.overall.speciesMeanShare.SMALL,.15);
    near(r.overall.equipmentMeanShare.LIGHT,.7);near(r.overall.equipmentMeanShare.STANDARD,.3);near(r.overall.equipmentMeanShare.HEAVY,0);
    assert.deepEqual(r.overall.speciesPresence,{LARGE:30,MEDIUM:30,SMALL:30});
    assert.equal(r.overall.forceCoPresence.SMALL.LIGHT,30);assert.equal(r.overall.forceCoPresence.SMALL.HEAVY,0);
    assert.equal(r.overall.dominantSpecies.LARGE,30);assert.equal(r.diversity.speciesProfiles[1],10);
});
test('1000-seed hypothesis comparison has consistent denominators, shares, distinct profiles and replay',()=>{
    const report=analyze({count:1000});
    for(const r of Object.values(report.results)){
        assert.equal(r.successfulArmies,1000);assert.equal(r.generationFailures,0);assert.equal(r.replayMatches,1000);
        assert.equal(r.replayMismatches+r.replayErrors,0);assert.equal(r.overall.samples,3000);
        for(const tally of [r.overall,...Object.values(r.slots)]){
            near(Object.values(tally.speciesMeanShare).reduce((a,b)=>a+b),1);near(Object.values(tally.equipmentMeanShare).reduce((a,b)=>a+b),1);
            assert.equal(Object.values(tally.dominantSpecies).reduce((a,b)=>a+b),tally.samples);
            assert.equal(Object.values(tally.dominantEquipment).reduce((a,b)=>a+b),tally.samples);
            assert.ok(tally.singleSpeciesForces<=tally.extremeSpeciesForces);
            for(const s of ['LARGE','MEDIUM','SMALL'])for(const e of ['LIGHT','STANDARD','HEAVY'])assert.ok(tally.forceCoPresence[s][e]<=Math.min(tally.speciesPresence[s],tally.equipmentPresence[e]));
        }
        for(const histogram of Object.values(r.diversity))assert.equal(Object.values(histogram).reduce((a,b)=>a+b),1000);
    }
    for(const share of Object.values(report.results.A.overall.speciesMeanShare))assert.ok(Math.abs(share-1/3)<.04);
    assert.ok(report.results.B.overall.speciesMeanShare.MEDIUM>.64);
    assert.ok(report.results.C.slots.C.speciesMeanShare.SMALL>.5);
    assert.ok(report.results.C.slots.A.speciesMeanShare.LARGE>report.results.C.slots.B.speciesMeanShare.LARGE);
});
test('invalid policy is rejected before generation, invalid seed bounds are rejected',()=>{
    const p=policies();p.A.slots.C[0].weight=-1;let calls=0;
    assert.throws(()=>analyze({count:1,policies:p,generator:()=>{calls++;}}),/WEIGHT_INVALID/);assert.equal(calls,0);
    for(const [count,start]of[[0,0],[-1,0],[1.5,0],[10001,0],[Infinity,0],[NaN,0],[1,-1],[2,0xffffffff],[1,'0'],['5',0]])assert.throws(()=>validateSeedRange(count,start),/SEED_RANGE/);
    validateSeedRange(1,0xffffffff);assert.throws(()=>analyze({count:1,models:['A','A']}),/MODELS_INVALID/);
});
test('failure and replay anomalies are explicit, bounded and never converted to fake success',()=>{
    const failed=analyze({count:24,models:['A'],generator:()=>{throw Error('INJECTED');}}).results.A;
    assert.equal(failed.generationFailures,24);assert.equal(failed.failureExamples.length,20);assert.equal(failed.successfulArmies,0);
    const text=distributionMarkdown({seeds:{start:0,count:24},results:{A:failed}});assert.ok(!text.includes('NaN'));assert.ok(text.includes('N/A'));
    let calls=0;const replay=analyze({count:2,models:['A'],generator:args=>{calls++;return generate({...args,runSeed:calls%2?args.runSeed:args.runSeed+10});}}).results.A;
    assert.equal(replay.replayMismatches,2);assert.equal(replay.successfulArmies,2);
    const invalid=analyze({count:1,models:['A'],generator:()=>({getSnapshot:()=>({})})}).results.A;
    assert.equal(invalid.generationFailures,1);
});
test('input policies and held snapshots remain unchanged across bulk generation; production RNG/Trial unaffected',()=>{
    const p=policies();const before=structuredClone(p);const held=generate({runSeed:42,stageId:1,policy:p.A});const snapshot=held.getSnapshot();
    const source=new URL('../game/src/trial/domain/enemy_army_blueprint.js',import.meta.url);const sourceBefore=fs.readFileSync(source,'utf8');
    const engine=GameEngine.createGame({runSeed:42,firstRun:true});const gameplay=engine.gameplayRandom.getState(),checks=engine.checkSystem.getState(),truth=engine.trueEnemyStateService.getRestoreState();
    const original=Math.random;Math.random=()=>{throw Error('NONDETERMINISTIC_RANDOM_FORBIDDEN');};
    try{analyze({count:1000,policies:p});}finally{Math.random=original;}
    assert.deepEqual(p,before);assert.deepEqual(held.getSnapshot(),snapshot);assert.equal(fs.readFileSync(source,'utf8'),sourceBefore);
    assert.deepEqual(engine.gameplayRandom.getState(),gameplay);assert.deepEqual(engine.checkSystem.getState(),checks);assert.deepEqual(engine.trueEnemyStateService.getRestoreState(),truth);
    assert.equal(engine.enemyTruthReadModel.getSnapshot().strategicSuppression,20);assert.equal(engine.enemyTruthReadModel.getSnapshot().forces.length,1);
    assert.equal(engine.enemyArmyBlueprintBootstrap.status,'POLICY_NOT_CONFIGURED');assert.equal(Object.hasOwn(engine.state,'enemyArmyBlueprintState'),false);
});
