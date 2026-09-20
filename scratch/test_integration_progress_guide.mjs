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
    { branch: 'c-review', status: 'REVIEW_REQUIRED', guidance: { action: 'REVIEW_OVERLAP', reason: 'review' }, overlap: { risk: 'PATH_OVERLAP' }, mergePreview: { status: 'CLEAN' } },
    { branch: 'd-reconcile', status: 'RECONCILE_REQUIRED', guidance: { action: 'RECONCILE_TARGET', reason: 'reconcile' }, overlap: { risk: 'PATH_OVERLAP' }, mergePreview: { status: 'CLEAN' }, aheadCount: 2, behindCount: 8 },
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


const preparationGuide = buildIntegrationProgressGuide({
  target: 'AoT260919',
  targetSha: 'target-sha',
  tasks: [
    {
      branch: 'review-heavy',
      status: 'REVIEW_REQUIRED',
      guidance: { action: 'REVIEW_OVERLAP', reason: 'review' },
      overlap: { risk: 'PATH_OVERLAP' },
      peerOverlaps: [],
      mergePreview: { status: 'CLEAN' },
      aheadCount: 1,
      behindCount: 2,
    },
    {
      branch: 'reconcile-peer-overlap',
      status: 'RECONCILE_REQUIRED',
      guidance: { action: 'RECONCILE_TARGET', reason: 'stale' },
      overlap: { risk: 'NONE' },
      peerOverlaps: [{ branch: 'other', overlap: { risk: 'PATH_OVERLAP' } }],
      mergePreview: { status: 'CLEAN' },
      aheadCount: 1,
      behindCount: 1,
    },
    {
      branch: 'reconcile-safe-far',
      status: 'RECONCILE_REQUIRED',
      guidance: { action: 'RECONCILE_TARGET', reason: 'stale' },
      overlap: { risk: 'NONE' },
      peerOverlaps: [],
      mergePreview: { status: 'CLEAN' },
      aheadCount: 2,
      behindCount: 9,
    },
    {
      branch: 'reconcile-safe-near',
      status: 'RECONCILE_REQUIRED',
      guidance: { action: 'RECONCILE_TARGET', reason: 'stale' },
      overlap: { risk: 'NONE' },
      peerOverlaps: [],
      mergePreview: { status: 'CLEAN' },
      aheadCount: 4,
      behindCount: 3,
    },
  ],
});
assert.equal(preparationGuide.next.branch, 'reconcile-safe-near');
assert.equal(preparationGuide.next.preparationPriority, 'LOW_RISK_RECONCILE');
assert.deepEqual(preparationGuide.next.distance, { ahead: 4, behind: 3 });
assert.deepEqual(
  preparationGuide.entries.map((entry) => entry.branch),
  ['reconcile-safe-near', 'reconcile-safe-far', 'review-heavy', 'reconcile-peer-overlap'],
);

const completeGuide = buildIntegrationProgressGuide({
  target: 'AoT260919',
  targetSha: 'target-sha',
  tasks: [{ branch: 'merged', status: 'MERGED' }],
});
assert.equal(completeGuide.next, null);

console.log('Integration Progress Guide contract: PASS');
