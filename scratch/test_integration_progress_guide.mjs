import assert from 'node:assert/strict';
import {
  PROGRESS_CLASS,
  buildIntegrationProgressGuide,
  classifyProgressTask,
} from './integration_progress_guide.mjs';

const merged = classifyProgressTask({
  branch: 'aot-task/AoT260919/tooling/merged',
  status: 'MERGED',
});
assert.equal(merged.progressClass, PROGRESS_CLASS.NO_INTEGRATION_NEEDED);
assert.equal(merged.nextAction, 'CLEANUP_CANDIDATE');

const ready = classifyProgressTask({
  branch: 'aot-task/AoT260919/tooling/ready',
  status: 'READY',
});
assert.equal(ready.progressClass, PROGRESS_CLASS.INTEGRATE_NOW);
assert.equal(ready.nextAction, 'SAFE_INTEGRATION_RUNNER');

for (const status of ['REVIEW_REQUIRED', 'RECONCILE_REQUIRED', 'BLOCKED']) {
  const entry = classifyProgressTask({
    branch: `aot-task/AoT260919/tooling/${status.toLowerCase()}`,
    status,
    guidance: { action: status, reason: `${status} reason` },
    overlap: { risk: status === 'REVIEW_REQUIRED' ? 'PATH_OVERLAP' : 'NONE' },
    peerOverlaps: [],
    mergePreview: { status: status === 'BLOCKED' ? 'CONFLICT' : 'CLEAN' },
  });
  assert.equal(entry.progressClass, PROGRESS_CLASS.PREPARE_FOR_INTEGRATION);
  assert.ok(entry.steps.length >= 3);
}

const guide = buildIntegrationProgressGuide({
  target: 'AoT260919',
  targetSha: 'target-sha',
  tasks: [
    { branch: 'z-blocked', status: 'BLOCKED', guidance: { action: 'STOP_AND_INSPECT', reason: 'blocked' }, mergePreview: { status: 'CONFLICT' } },
    { branch: 'a-merged', status: 'MERGED' },
    { branch: 'b-ready', status: 'READY' },
    { branch: 'c-review', status: 'REVIEW_REQUIRED', guidance: { action: 'REVIEW_OVERLAP', reason: 'review' }, mergePreview: { status: 'CLEAN' } },
    { branch: 'd-reconcile', status: 'RECONCILE_REQUIRED', guidance: { action: 'RECONCILE_TARGET', reason: 'reconcile' }, mergePreview: { status: 'CLEAN' } },
  ],
});

assert.deepEqual(guide.counts, {
  INTEGRATE_NOW: 1,
  PREPARE_FOR_INTEGRATION: 3,
  NO_INTEGRATION_NEEDED: 1,
});
assert.equal(guide.next.branch, 'b-ready');
assert.deepEqual(
  guide.entries.map((entry) => entry.status),
  ['READY', 'REVIEW_REQUIRED', 'RECONCILE_REQUIRED', 'BLOCKED', 'MERGED'],
);
assert.match(guide.completionRule, /rerun full Integration Guard/i);

const noReadyGuide = buildIntegrationProgressGuide({
  target: 'AoT260919',
  targetSha: 'target-sha',
  tasks: [
    { branch: 'review', status: 'REVIEW_REQUIRED', guidance: { action: 'REVIEW_OVERLAP', reason: 'review' }, mergePreview: { status: 'CLEAN' } },
    { branch: 'merged', status: 'MERGED' },
  ],
});
assert.equal(noReadyGuide.next.branch, 'review');
assert.equal(noReadyGuide.next.progressClass, PROGRESS_CLASS.PREPARE_FOR_INTEGRATION);

const completeGuide = buildIntegrationProgressGuide({
  target: 'AoT260919',
  targetSha: 'target-sha',
  tasks: [{ branch: 'merged', status: 'MERGED' }],
});
assert.equal(completeGuide.next, null);

console.log('Integration Progress Guide contract: PASS');
