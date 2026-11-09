import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { MERGE_PREVIEW_STATUS, previewMerge } from './task_merge_preview.mjs';
import { classifyObservedTask } from './integration_guard_core.mjs';
import { buildMergeDecisionProof } from './merge_decision_core.mjs';

let passed = 0;
function check(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
    passed += 1;
    console.log(`  PASS: ${label}`);
}

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

function initRepo() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'aot-merge-preview-'));
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'aot@example.invalid');
    git(root, 'config', 'user.name', 'AoT Merge Preview Test');
    return root;
}

function commitAll(root, message) {
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
}

function branchFrom(root, branch, sha) {
    git(root, 'checkout', '-q', '-B', branch, sha);
}

function withRepo(testFn) {
    const root = initRepo();
    try {
        testFn(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

withRepo((root) => {
    writeFileSync(path.join(root, 'base.txt'), 'base\n');
    const base = commitAll(root, 'base');
    branchFrom(root, 'task', base);
    writeFileSync(path.join(root, 'task.txt'), 'task\n');
    const task = commitAll(root, 'task');
    const result = previewMerge(root, base, task);
    check(result.status, MERGE_PREVIEW_STATUS.NOT_REQUIRED, 'contained target does not require preview merge');

    writeFileSync(path.join(root, 'base.txt'), 'staged change\n');
    git(root, 'add', 'base.txt');
    writeFileSync(path.join(root, 'base.txt'), 'working change\n');
    writeFileSync(path.join(root, 'untracked.txt'), 'user asset\n');
    const beforeHead = git(root, 'rev-parse', 'HEAD');
    const beforeIndex = git(root, 'write-tree');
    const beforeStatus = git(root, 'status', '--porcelain=v1');
    const measured = previewMerge(root, base, task, { requireMergeTree: true });
    check(measured.status, MERGE_PREVIEW_STATUS.CLEAN, 'integration requests measured CLEAN for contained target');
    check(measured.mergeTreeSha, git(root, 'rev-parse', `${task}^{tree}`), 'contained merge has the committed TASK tree, not dirty index');
    check(git(root, 'rev-parse', 'HEAD'), beforeHead, 'contained preview preserves HEAD');
    check(git(root, 'write-tree'), beforeIndex, 'contained preview preserves staged user changes');
    check(git(root, 'status', '--porcelain=v1'), beforeStatus, 'contained preview preserves working and untracked changes');

    const branch = 'aot-task/AoT261029/tooling/preview-contract';
    const status = classifyObservedTask({ targetIsAncestor: true, mergePreviewStatus: measured.status });
    check(status, 'READY', 'real contained preview satisfies Guard contract');
    const analysis = {
        target: 'AoT261029', targetSha: base,
        tasks: [{ branch, sha: task, status, localRemoteMismatch: false, mergePreview: measured }],
        integrationOrder: [{ branch, status, action: 'INTEGRATE_ONE_AT_A_TIME' }],
    };
    const pr = {
        number: 473, headRefName: branch, headRefOid: task,
        baseRefName: 'AoT261029', mergeStateStatus: 'CLEAN',
        statusCheckRollup: [{ name: 'Full Inspection', conclusion: 'SUCCESS' }],
    };
    check(buildMergeDecisionProof(analysis, pr).decision, 'READY', 'measured Guard output reaches Runner proof without status rewriting');
    check(buildMergeDecisionProof(analysis, pr).proof.mergePreview, 'CLEAN', 'proof records actual CLEAN evidence');
    check(buildMergeDecisionProof(analysis, { ...pr, statusCheckRollup: [] }).decision, 'BLOCKED', 'measured preview does not bypass required CI');
    check(buildMergeDecisionProof(analysis, { ...pr, headRefOid: base }).decision, 'BLOCKED', 'measured preview does not bypass exact PR head');

});

withRepo((root) => {
    writeFileSync(path.join(root, 'base.txt'), 'base\n');
    const base = commitAll(root, 'base');

    branchFrom(root, 'target', base);
    writeFileSync(path.join(root, 'target.txt'), 'target\n');
    const target = commitAll(root, 'target');

    branchFrom(root, 'task', base);
    writeFileSync(path.join(root, 'task.txt'), 'task\n');
    const task = commitAll(root, 'task');

    const beforeHead = git(root, 'rev-parse', 'HEAD');
    const beforeIndex = git(root, 'write-tree');
    const beforeStatus = git(root, 'status', '--porcelain=v1');
    const result = previewMerge(root, target, task);
    check(result.status, MERGE_PREVIEW_STATUS.CLEAN, 'different files preview cleanly');
    check(git(root, 'rev-parse', 'HEAD'), beforeHead, 'preview does not move HEAD');
    check(git(root, 'write-tree'), beforeIndex, 'preview does not change index');
    check(git(root, 'status', '--porcelain=v1'), beforeStatus, 'preview does not change worktree status');
});

withRepo((root) => {
    writeFileSync(path.join(root, 'shared.txt'), 'one\ntwo\nthree\n');
    const base = commitAll(root, 'base');

    branchFrom(root, 'target', base);
    writeFileSync(path.join(root, 'shared.txt'), 'TARGET\ntwo\nthree\n');
    const target = commitAll(root, 'target');

    branchFrom(root, 'task', base);
    writeFileSync(path.join(root, 'shared.txt'), 'one\ntwo\nTASK\n');
    const task = commitAll(root, 'task');

    check(previewMerge(root, target, task).status, MERGE_PREVIEW_STATUS.CLEAN, 'same file different lines preview cleanly');
});

withRepo((root) => {
    writeFileSync(path.join(root, 'shared.txt'), 'base\n');
    const base = commitAll(root, 'base');

    branchFrom(root, 'target', base);
    writeFileSync(path.join(root, 'shared.txt'), 'target\n');
    const target = commitAll(root, 'target');

    branchFrom(root, 'task', base);
    writeFileSync(path.join(root, 'shared.txt'), 'task\n');
    const task = commitAll(root, 'task');

    const result = previewMerge(root, target, task);
    check(result.status, MERGE_PREVIEW_STATUS.CONFLICT, 'same-line edits are confirmed conflicts');
    check(result.conflictPaths.includes('shared.txt'), true, 'same-line conflict reports its path');
});

withRepo((root) => {
    writeFileSync(path.join(root, 'victim.txt'), 'base\n');
    const base = commitAll(root, 'base');

    branchFrom(root, 'target', base);
    git(root, 'rm', '-q', 'victim.txt');
    const target = commitAll(root, 'target delete');

    branchFrom(root, 'task', base);
    writeFileSync(path.join(root, 'victim.txt'), 'task changed\n');
    const task = commitAll(root, 'task modify');

    const result = previewMerge(root, target, task);
    check(result.status, MERGE_PREVIEW_STATUS.CONFLICT, 'modify/delete is confirmed as conflict');
    check(result.conflictPaths.includes('victim.txt'), true, 'modify/delete conflict reports its path');
});

withRepo((root) => {
    writeFileSync(path.join(root, 'old.txt'), 'base\n');
    const base = commitAll(root, 'base');

    branchFrom(root, 'target', base);
    git(root, 'mv', 'old.txt', 'left.txt');
    const target = commitAll(root, 'target rename');

    branchFrom(root, 'task', base);
    git(root, 'mv', 'old.txt', 'right.txt');
    const task = commitAll(root, 'task rename');

    const result = previewMerge(root, target, task);
    check(result.status, MERGE_PREVIEW_STATUS.CONFLICT, 'rename/rename is confirmed as conflict');
    check(result.conflictPaths.length > 0, true, 'rename/rename conflict reports affected paths');
});

const unknown = previewMerge('/definitely/not/a/repository', 'deadbeef', 'HEAD');
check(unknown.status, MERGE_PREVIEW_STATUS.UNKNOWN, 'Git execution failure is UNKNOWN rather than CLEAN');

check(previewMerge('/definitely/not/a/repository', 'deadbeef', 'HEAD', { requireMergeTree: true }).status, MERGE_PREVIEW_STATUS.UNKNOWN, 'required preview keeps Git failures UNKNOWN');

console.log(`Task merge preview contract: ${passed}/24 PASS`);
