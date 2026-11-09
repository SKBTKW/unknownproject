import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { parseDistributionArgs } from './diagnose_enemy_army_generation_distribution.mjs';
const run=args=>spawnSync(process.execPath,['scratch/diagnose_enemy_army_generation_distribution.mjs',...args],{encoding:'utf8',windowsHide:true,timeout:15000});
test('CLI JSON is deterministic and model selection preserves the same seed set',()=>{
    const args=['--count','8','--start','11','--json'];const a=run(args),b=run(args);
    assert.equal(a.status,0,a.stderr);assert.equal(a.stdout,b.stdout);const data=JSON.parse(a.stdout);
    assert.equal(data.seeds.count,8);assert.deepEqual(Object.keys(data.results),['A','B','C']);
    const selected=run([...args,'--models','C']);assert.equal(selected.status,0,selected.stderr);
    assert.deepEqual(JSON.parse(selected.stdout).results.C,data.results.C);
    const refinements=run(['--count','8','--start','11','--models','D,E','--json']);assert.equal(refinements.status,0,refinements.stderr);
    assert.deepEqual(Object.keys(JSON.parse(refinements.stdout).results),['D','E']);
});
test('CLI markdown names the marginal/co-presence limitation',()=>{
    const result=run(['--count','2','--models','A','--markdown']);assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/NOT|not individual|individual correlation/);assert.match(result.stdout,/Model/);
});
test('numeric/selection options reject malformed, excessive, duplicated or overflowing values',()=>{
    for(const args of [['--count','0'],['--count','-1'],['--count','1.5'],['--count','1e3'],['--count','10001'],['--count','Infinity'],['--count','9999999999999999999999999'],['--count'],['--models','A,A'],['--models','F'],['--models',''],['--start','4294967295','--count','2'],['--count','1','--count','2'],['--json','--markdown'],['--unknown']])assert.throws(()=>parseDistributionArgs(args),/DISTRIBUTION/);
    const invalid=run(['--count','10001']);assert.notEqual(invalid.status,0);assert.equal(invalid.stdout,'');assert.match(invalid.stderr,/SEED_RANGE/);
});
