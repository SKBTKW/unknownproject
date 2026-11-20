import assert from 'node:assert/strict';
import { assessInspectionReuse } from './verify_full_inspection_reuse.mjs';

const now = Date.parse('2026-11-13T12:00:00.000Z');
const receipt = {
    schemaVersion: 1,
    kind: 'AOT_FULL_INSPECTION_RECEIPT',
    outcome: 'PASS',
    createdAt: '2026-11-13T11:00:00.000Z',
    headSha: 'task-head',
    treeSha: 'shared-tree',
    gitClean: true,
    targetSha: 'target-base',
    environment: { node: 'v22.0.0', platform: 'win32', arch: 'x64' },
    inputs: { runnerSha256: 'runner', registrySha256: 'registry', packageLockSha256: null },
};
const observed = {
    now,
    sourceSha: 'task-head',
    sourceTree: 'shared-tree',
    integrationTree: 'shared-tree',
    remoteTargetSha: 'target-base',
    node: 'v22.0.0',
    platform: 'win32',
    arch: 'x64',
    runnerSha256: 'runner',
    registrySha256: 'registry',
    packageLockSha256: null,
    gitClean: true,
};

assert.deepEqual(assessInspectionReuse({ receipt, observed }), { ready: true, reasons: [] });
assert.deepEqual(
    assessInspectionReuse({ receipt, observed: { ...observed, integrationTree: 'different' } }),
    { ready: false, reasons: ['INTEGRATION_TREE_DIFFERS'] }
);
assert.deepEqual(
    assessInspectionReuse({ receipt, observed: { ...observed, remoteTargetSha: 'advanced' } }),
    { ready: false, reasons: ['TARGET_DRIFT'] }
);
assert.deepEqual(
    assessInspectionReuse({ receipt, observed: { ...observed, runnerSha256: 'changed' } }),
    { ready: false, reasons: ['RUNNER_CHANGED'] }
);
assert.deepEqual(
    assessInspectionReuse({ receipt, observed: { ...observed, gitClean: false } }),
    { ready: false, reasons: ['INTEGRATION_WORKTREE_DIRTY'] }
);
assert.deepEqual(
    assessInspectionReuse({ receipt, observed: { ...observed, now: now + 25 * 3600_000 } }),
    { ready: false, reasons: ['RECEIPT_EXPIRED'] }
);

console.log('Full Inspection reuse contract: 6/6 PASS');
