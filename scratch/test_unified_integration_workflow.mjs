import assert from 'node:assert/strict';
import { ORPHAN_STATUS } from './orphan_branch_inspector_core.mjs';
import { RUNNER_DECISION } from './safe_integration_runner_core.mjs';
import {
  WORKFLOW_STATUS,
  classifyRepositoryAudit,
  classifyRunnerResult,
  validateWorkflowConfig,
} from './unified_integration_workflow_core.mjs';

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}

console.log('\nUnified Integration Workflow contract tests');

const unreviewedAudit = classifyRepositoryAudit([
  { branch: 'main', status: ORPHAN_STATUS.PROTECTED, reasons: [] },
  { branch: 'aot-task/AoT260920/tooling/current', status: ORPHAN_STATUS.CURRENT_TASK, reasons: [] },
  { branch: 'old-safe', status: ORPHAN_STATUS.TARGET_CONTAINED, reasons: ['contained'] },
  {
    branch: 'old-review',
    status: ORPHAN_STATUS.REVIEW_REQUIRED,
    reasons: ['1 unique commit'],
    remoteSha: '1111111111111111111111111111111111111111',
  },
], [], []);
check(unreviewedAudit.ok, false, 'unreviewed REVIEW_REQUIRED history blocks active integration');
check(unreviewedAudit.blockers.map(item => item.branch), ['old-review'], 'unreviewed history is surfaced as a blocker');
check(unreviewedAudit.reviewFindings.map(item => item.branch), [], 'unreviewed history is never presented as acknowledged');
check(unreviewedAudit.warnings.map(item => item.branch), ['old-safe'], 'target-contained branch remains cleanup warning');

const reviewedAudit = classifyRepositoryAudit([
  {
    branch: 'AoT260919',
    status: ORPHAN_STATUS.REVIEW_REQUIRED,
    reasons: ['15 unique commits'],
    remoteSha: '2222222222222222222222222222222222222222',
  },
], [], [{
  branch: 'AoT260919',
  sha: '2222222222222222222222222222222222222222',
  disposition: 'SUPERSEDED',
  reason: 'audited',
}]);
check(reviewedAudit.ok, true, 'reviewed unique history may pass only at the pinned HEAD');
check(reviewedAudit.blockers.map(item => item.branch), [], 'matching pinned review removes only that reviewed blocker');
check(reviewedAudit.reviewFindings.map(item => ({
  branch: item.branch,
  reviewedSha: item.reviewedSha,
  disposition: item.disposition,
})), [{
  branch: 'AoT260919',
  reviewedSha: '2222222222222222222222222222222222222222',
  disposition: 'SUPERSEDED',
}], 'matching pinned review remains visible in audit output');

const movedReviewedAudit = classifyRepositoryAudit([
  {
    branch: 'AoT260919',
    status: ORPHAN_STATUS.REVIEW_REQUIRED,
    reasons: ['16 unique commits'],
    remoteSha: '3333333333333333333333333333333333333333',
  },
], [], [{
  branch: 'AoT260919',
  sha: '2222222222222222222222222222222222222222',
  disposition: 'SUPERSEDED',
  reason: 'audited before branch moved',
}]);
check(movedReviewedAudit.ok, false, 'review acknowledgement fails closed when the branch HEAD moves');
check(movedReviewedAudit.blockers[0].reasons.some(reason => reason.includes('observed 3333333333333333333333333333333333333333')), true,
  'moved reviewed branch reports the observed unreviewed HEAD');

const ignoredAudit = classifyRepositoryAudit([
  { branch: 'AGtest260915', status: ORPHAN_STATUS.REVIEW_REQUIRED, reasons: ['archive history'] },
  { branch: 'Legacy260911', status: ORPHAN_STATUS.REVIEW_REQUIRED, reasons: ['archive history'] },
  { branch: 'noop-contained', status: ORPHAN_STATUS.DUPLICATE_HEAD, reasons: ['duplicate'] },
], ['AGtest260915', 'Legacy260911'], []);
check(ignoredAudit.ok, true, 'explicit archive exclusions do not block integration');
check(ignoredAudit.ignoredFindings.map(item => item.branch), ['AGtest260915', 'Legacy260911'], 'ignored findings remain visible');
check(ignoredAudit.warnings.map(item => item.branch), ['noop-contained'], 'duplicate head is reported as cleanup warning');

const mismatchAudit = classifyRepositoryAudit([
  {
    branch: 'tmp/local-remote',
    status: ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH,
    reasons: ['heads differ'],
    localSha: '4444444444444444444444444444444444444444',
    remoteSha: '5555555555555555555555555555555555555555',
  },
], [], [{
  branch: 'tmp/local-remote',
  sha: '5555555555555555555555555555555555555555',
  disposition: 'REVIEWED',
  reason: 'must not bypass observation integrity',
}]);
check(mismatchAudit.ok, false, 'local/remote mismatch blocks even when a remote HEAD was previously reviewed');

check(classifyRunnerResult({
  executed: true,
  decision: { decision: RUNNER_DECISION.READY },
}), {
  status: WORKFLOW_STATUS.READY,
  continueLoop: true,
  reason: 'one merge completed safely',
}, 'successful merge requests another full audit iteration');

check(classifyRunnerResult({
  executed: false,
  decision: { decision: RUNNER_DECISION.NO_ACTION, reason: 'none' },
}), {
  status: WORKFLOW_STATUS.COMPLETE,
  continueLoop: false,
  reason: 'none',
}, 'NO_ACTION completes the unified workflow');

check(classifyRunnerResult({
  executed: false,
  decision: { decision: RUNNER_DECISION.BLOCKED, reason: 'risk' },
}), {
  status: WORKFLOW_STATUS.BLOCKED,
  continueLoop: false,
  reason: 'risk',
}, 'Safe Runner BLOCKED stops the unified workflow');

check(classifyRunnerResult({
  executed: false,
  decision: { decision: RUNNER_DECISION.READY, reason: 'candidate' },
}), {
  status: WORKFLOW_STATUS.READY,
  continueLoop: false,
  reason: 'READY candidate available in plan mode',
}, 'plan mode reports READY without merging');

check(validateWorkflowConfig({
  ignoredBranches: [' AGtest260915 ', 'AGtest260915', '', 42, 'Legacy260911'],
  reviewedBranches: [
    {
      branch: ' AoT260919 ',
      sha: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      disposition: ' SUPERSEDED ',
      reason: ' audited ',
    },
    {
      branch: '',
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    {
      branch: 'invalid-sha',
      sha: '1234',
    },
  ],
}), {
  ignoredBranches: ['AGtest260915', 'Legacy260911'],
  reviewedBranches: [{
    branch: 'AoT260919',
    sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    disposition: 'SUPERSEDED',
    reason: 'audited',
  }],
}, 'workflow config normalizes archive exclusions and SHA-pinned review acknowledgements');

console.log(`Unified Integration Workflow: ${passed} checks PASS`);
