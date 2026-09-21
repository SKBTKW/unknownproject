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

const audit = classifyRepositoryAudit([
  { branch: 'main', status: ORPHAN_STATUS.PROTECTED, reasons: [] },
  { branch: 'aot-task/AoT260919/tooling/current', status: ORPHAN_STATUS.CURRENT_TASK, reasons: [] },
  { branch: 'old-safe', status: ORPHAN_STATUS.TARGET_CONTAINED, reasons: ['contained'] },
  { branch: 'old-review', status: ORPHAN_STATUS.REVIEW_REQUIRED, reasons: ['1 unique commit'] },
], []);
check(audit.ok, false, 'unignored REVIEW_REQUIRED branch blocks unified workflow');
check(audit.blockers.map(item => item.branch), ['old-review'], 'review blocker is surfaced');
check(audit.warnings.map(item => item.branch), ['old-safe'], 'target-contained branch remains cleanup warning');

const ignoredAudit = classifyRepositoryAudit([
  { branch: 'AGtest260915', status: ORPHAN_STATUS.REVIEW_REQUIRED, reasons: ['archive history'] },
  { branch: 'Legacy260911', status: ORPHAN_STATUS.REVIEW_REQUIRED, reasons: ['archive history'] },
  { branch: 'noop-contained', status: ORPHAN_STATUS.DUPLICATE_HEAD, reasons: ['duplicate'] },
], ['AGtest260915', 'Legacy260911']);
check(ignoredAudit.ok, true, 'explicit archive exclusions do not block integration');
check(ignoredAudit.ignoredFindings.map(item => item.branch), ['AGtest260915', 'Legacy260911'], 'ignored findings remain visible');
check(ignoredAudit.warnings.map(item => item.branch), ['noop-contained'], 'duplicate head is reported as cleanup warning');

const mismatchAudit = classifyRepositoryAudit([
  { branch: 'tmp/local-remote', status: ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH, reasons: ['heads differ'] },
], []);
check(mismatchAudit.ok, false, 'local/remote mismatch blocks unified workflow');

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
}), {
  ignoredBranches: ['AGtest260915', 'Legacy260911'],
}, 'workflow config normalizes explicit archive exclusions');

console.log(`Unified Integration Workflow: ${passed} checks PASS`);
