import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeArmyDistribution, createDistributionHypotheses, createDistributionPolicies } from './enemy_army_generation_distribution.mjs';

test('D shares one candidate set without slot-fixed species while E selects one deterministic army trait',()=>{
    const policies=createDistributionPolicies();
    assert.deepEqual(policies.D.slots.A,policies.D.slots.B);assert.deepEqual(policies.D.slots.B,policies.D.slots.C);
    const hypotheses=createDistributionHypotheses();
    const first=analyzeArmyDistribution({count:512,models:['B','C','D','E'],hypotheses});
    assert.deepEqual(analyzeArmyDistribution({count:512,models:['B','C','D','E'],hypotheses}),first);
    assert.deepEqual(Object.keys(first.results.E.armyTraits).sort(),['large-leaning','medium-core','small-leaning']);
    assert.equal(Object.values(first.results.E.armyTraits).reduce((sum,value)=>sum+value,0),512);
    assert.ok(first.results.D.diversity.speciesProfiles[3]>first.results.B.diversity.speciesProfiles[3]);
    assert.ok(first.results.C.relations.slotDominantPredictability.C.accuracy>first.results.D.relations.slotDominantPredictability.C.accuracy);
});

test('refinement metrics have exact denominators and Development generation does not call Math.random',()=>{
    const original=Math.random;Math.random=()=>{throw Error('NONDETERMINISTIC_RANDOM_FORBIDDEN');};
    let report;try{report=analyzeArmyDistribution({count:300,models:['D','E']});}finally{Math.random=original;}
    for(const result of Object.values(report.results)){
        assert.equal(result.generationFailures,0);assert.equal(result.replayMatches,300);assert.equal(result.overall.samples,900);
        assert.equal(result.relations.withinArmySpeciesDistance.comparisons,300);
        assert.equal(result.relations.betweenAdjacentArmiesSpeciesDistance.comparisons,299);
        assert.equal(Object.values(result.relations.withinArmySpeciesDistance.histogram).reduce((a,b)=>a+b),300);
        assert.equal(Object.values(result.relations.betweenAdjacentArmiesSpeciesDistance.histogram).reduce((a,b)=>a+b),299);
        assert.ok(result.relations.atLeastTwoDominantSpeciesMatch<=300);
        assert.ok(result.relations.exactCombinedAllForces<=result.relations.exactSpeciesAllForces);
        for(const slot of ['A','B','C']) assert.ok(result.relations.slotDominantPredictability[slot].accuracy>=0&&result.relations.slotDominantPredictability[slot].accuracy<=1);
    }
});
