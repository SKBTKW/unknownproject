import assert from 'assert/strict';
import { classifyTaskCandidate, parseGitHubRepo } from './task_sweeper.mjs';
import { extractTargets, isCleanConfirmation } from './task_sweeper_launcher.mjs';
import { expectedTaskBranchPattern, isCanonicalTaskBranch } from './task_branch_contract.mjs';

const base = {
    target: 'AoT260917',
    canonicalName: true,
    currentWorktree: false,
    lockedWorktree: false,
    dirtyWorktree: false,
    localRemoteMismatch: false,
    unpushedCommits: 0,
    uniqueCommits: 0,
    remoteExists: true,
    mergedPrVerified: false,
    mergedPrNumber: undefined,
    prReason: '',
};

const tests = [
    ['empty task is safe', { ...base }, 'SAFE'],
    ['verified squash-merged task is safe', { ...base, uniqueCommits: 3, mergedPrVerified: true, mergedPrNumber: 42 }, 'SAFE'],
    ['non-canonical task name blocks', { ...base, canonicalName: false }, 'BLOCKED'],
    ['dirty worktree blocks', { ...base, dirtyWorktree: true }, 'BLOCKED'],
    ['current task worktree blocks', { ...base, currentWorktree: true }, 'BLOCKED'],
    ['locked worktree blocks', { ...base, lockedWorktree: true }, 'BLOCKED'],
    ['local/remote mismatch blocks', { ...base, localRemoteMismatch: true }, 'BLOCKED'],
    ['unpushed commits block', { ...base, unpushedCommits: 1 }, 'BLOCKED'],
    ['local-only unique commits block', { ...base, remoteExists: false, uniqueCommits: 1 }, 'BLOCKED'],
    ['unverified unique remote commits block', { ...base, uniqueCommits: 1, prReason: 'No merged PR' }, 'BLOCKED'],
];

let passed = 0;
for (const [label, state, expected] of tests) {
    const actual = classifyTaskCandidate(state).status;
    assert.equal(actual, expected, label);
    passed += 1;
}

assert.deepEqual(parseGitHubRepo('git@github.com:SKBTKW/unknownproject.git'), { owner: 'SKBTKW', repo: 'unknownproject' });
assert.deepEqual(parseGitHubRepo('https://github.com/SKBTKW/unknownproject.git'), { owner: 'SKBTKW', repo: 'unknownproject' });
assert.equal(parseGitHubRepo('https://example.com/SKBTKW/unknownproject.git'), null);

assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/tooling/task-sweeper', 'AoT260917'), true);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/trial/route-fix', 'AoT260917'), true);
assert.equal(isCanonicalTaskBranch('TASK/trial-260917', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/tooling/foo/bar', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260916/tooling/task-sweeper', 'AoT260917'), false);
assert.equal(isCanonicalTaskBranch('aot-task/AoT260917/Tooling/task-sweeper', 'AoT260917'), false);
assert.equal(expectedTaskBranchPattern('AoT260917'), 'aot-task/AoT260917/<domain>/<task-id>');

assert.deepEqual(
    extractTargets([
        'aot-task/AoT260916/tutorial/first-run',
        'origin/aot-task/AoT260917/tooling/task-sweeper',
        'origin/aot-task/AoT260916/layout/trial-responsive-clearance',
        'origin/main',
    ]),
    ['AoT260917', 'AoT260916'],
);

for (const value of ['CLEAN', 'clean', 'Clean', 'cLeAn', ' CLEAN ']) {
    assert.equal(isCleanConfirmation(value), true, `${value} should authorize cleanup`);
}
for (const value of ['', 'delete', 'yes', 'clean now']) {
    assert.equal(isCleanConfirmation(value), false, `${value} should not authorize cleanup`);
}

console.log(`✅ AoT Task Sweeper safety contract: ${passed}/10 classifications PASS + naming/launcher contract PASS`);
