import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeNumstat } from './quota_efficient_git_preflight.mjs';

assert.deepEqual(summarizeNumstat(''), { files: 0, insertions: 0, deletions: 0, binaryFiles: 0 });
assert.deepEqual(
    summarizeNumstat('10\t2\talpha.js\n-\t-\timage.png\n3\t0\tbeta.js\n'),
    { files: 3, insertions: 13, deletions: 2, binaryFiles: 1 }
);

const source = readFileSync(new URL('./quota_efficient_git_preflight.mjs', import.meta.url), 'utf8');
assert.equal(/git\(\['(?:fetch|push|merge|reset|switch|checkout|pull|rebase)'/.test(source), false);
assert.match(source, /mutation:\s*'NONE'/);

console.log('Quota-efficient Git preflight contract: 4/4 PASS');
