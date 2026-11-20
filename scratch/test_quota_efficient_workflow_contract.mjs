import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const quietRunner = readFileSync(new URL('./run_full_inspection_quiet.mjs', import.meta.url), 'utf8');
const reuseVerifier = readFileSync(new URL('./verify_full_inspection_reuse.mjs', import.meta.url), 'utf8');

assert.match(agents, /条件付き一括承認/);
assert.match(agents, /承認失効条件/);
assert.match(agents, /run_full_inspection_quiet\.mjs/);
assert.match(agents, /verify_full_inspection_reuse\.mjs/);
assert.match(agents, /詳細ログはリポジトリ外/);
assert.match(agents, /target-push CI|統合先push後CI/);
assert.match(quietRunner, /AOT_FULL_INSPECTION_RECEIPT/);
assert.match(reuseVerifier, /INTEGRATION_TREE_DIFFERS/);

console.log('Quota-efficient workflow policy contract: 8/8 PASS');
