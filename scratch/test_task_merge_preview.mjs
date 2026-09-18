import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { MERGE_PREVIEW_STATUS, previewMerge } from './task_merge_preview.mjs';

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

console.log(`Task merge preview contract: ${passed}/13 PASS`);
