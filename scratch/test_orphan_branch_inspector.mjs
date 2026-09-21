import assert from 'node:assert/strict';
import {
  ORPHAN_STATUS,
  classifyObservedBranch,
  extractTaskTarget,
  isAoTTargetName,
  summarizeOrphanStatuses,
} from './orphan_branch_inspector_core.mjs';

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}

console.log('\nOrphan Branch Inspector contract tests');

check(isAoTTargetName('AoT260919'), true, 'AoT target format accepted');
check(isAoTTargetName('main'), false, 'non-AoT target rejected');
check(extractTaskTarget('aot-task/AoT260917/presentation/example'), 'AoT260917', 'stale TASK target extracted');
check(extractTaskTarget('noop-temp'), null, 'noncanonical branch has no TASK target');

const protectedBranch = classifyObservedBranch({
  branch: 'main',
  target: 'AoT260919',
  ahead: 3,
  behind: 100,
});
check(protectedBranch.status, ORPHAN_STATUS.PROTECTED, 'main remains protected regardless of history');

const currentTask = classifyObservedBranch({
  branch: 'aot-task/AoT260919/tooling/current-task',
  target: 'AoT260919',
  ahead: 1,
  behind: 0,
});
check(currentTask.status, ORPHAN_STATUS.CURRENT_TASK, 'current canonical TASK is delegated to Task Sweeper');

const staleUnique = classifyObservedBranch({
  branch: 'aot-task/AoT260917/presentation/forgotten-task',
  target: 'AoT260919',
  ahead: 1,
  behind: 100,
});
check(staleUnique.status, ORPHAN_STATUS.REVIEW_REQUIRED, 'old-target TASK with unique commits requires review');
check(staleUnique.actionable, false, 'unique-history branch is never deletion-actionable');
check(staleUnique.staleTaskNamespace, true, 'old-target namespace is recorded');

const noopUnique = classifyObservedBranch({
  branch: 'noop-temp-should-not-create-9',
  target: 'AoT260919',
  ahead: 2,
  behind: 200,
});
check(noopUnique.status, ORPHAN_STATUS.REVIEW_REQUIRED, 'noncanonical unique branch requires review');

const contained = classifyObservedBranch({
  branch: 'TASK-card-design-260917',
  target: 'AoT260919',
  ahead: 0,
  behind: 200,
});
check(contained.status, ORPHAN_STATUS.TARGET_CONTAINED, 'noncanonical target-contained branch is detected');
check(contained.actionable, true, 'target-contained result is cleanup-candidate information only');

const duplicate = classifyObservedBranch({
  branch: 'noop-temp-should-not-create-2',
  target: 'AoT260919',
  ahead: 0,
  behind: 200,
  duplicateHeadBranches: ['noop-temp-should-not-create'],
});
check(duplicate.status, ORPHAN_STATUS.DUPLICATE_HEAD, 'duplicate target-contained head is identified');
check(duplicate.duplicateHeadBranches, ['noop-temp-should-not-create'], 'duplicate peers are preserved');

const mismatch = classifyObservedBranch({
  branch: 'tmp/example',
  target: 'AoT260919',
  ahead: 0,
  behind: 5,
  localSha: 'aaa',
  remoteSha: 'bbb',
});
check(mismatch.status, ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH, 'local/remote mismatch blocks cleanup classification');
check(mismatch.actionable, false, 'local/remote mismatch is not actionable');

const summary = summarizeOrphanStatuses([
  protectedBranch,
  currentTask,
  staleUnique,
  noopUnique,
  contained,
  duplicate,
  mismatch,
]);
check(summary[ORPHAN_STATUS.REVIEW_REQUIRED], 2, 'summary counts review-required branches');
check(summary[ORPHAN_STATUS.TARGET_CONTAINED], 1, 'summary counts target-contained branches');
check(summary[ORPHAN_STATUS.DUPLICATE_HEAD], 1, 'summary counts duplicate heads');

console.log(`Orphan Branch Inspector: ${passed} checks PASS`);
