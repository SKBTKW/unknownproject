import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { refreshRemoteRefs, REMOTE_FRESHNESS } from './task_health.mjs';

let passed = 0;
function check(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
    passed += 1;
    console.log(`  PASS: ${label}`);
}

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

const root = mkdtempSync(path.join(os.tmpdir(), 'aot-task-health-remote-'));
const origin = path.join(root, 'origin.git');
const seed = path.join(root, 'seed');
const work = path.join(root, 'work');
const target = 'AoT260917';
const task = 'aot-task/AoT260917/tooling/task-merge-preview';

try {
    git(root, 'init', '--bare', '-q', origin);
    git(root, 'init', '-q', seed);
    git(seed, 'config', 'user.email', 'aot@example.invalid');
    git(seed, 'config', 'user.name', 'AoT Remote Refresh Test');
    writeFileSync(path.join(seed, 'state.txt'), 'base\n');
    git(seed, 'add', 'state.txt');
    git(seed, 'commit', '-q', '-m', 'base');
    git(seed, 'branch', '-M', target);
    git(seed, 'remote', 'add', 'origin', origin);
    git(seed, 'push', '-q', '-u', 'origin', target);
    const targetSha1 = git(seed, 'rev-parse', 'HEAD');

    git(seed, 'checkout', '-q', '-b', task);
    writeFileSync(path.join(seed, 'task.txt'), 'task one\n');
    git(seed, 'add', 'task.txt');
    git(seed, 'commit', '-q', '-m', 'task one');
    git(seed, 'push', '-q', '-u', 'origin', task);
    const taskSha1 = git(seed, 'rev-parse', 'HEAD');

    git(root, 'init', '-q', work);
    git(work, 'remote', 'add', 'origin', origin);
    // Deliberately configure a fetch mapping that does not include target/task.
    // refreshRemoteRefs must still update their remote-tracking refs explicitly.
    git(work, 'config', 'remote.origin.fetch', '+refs/heads/main:refs/remotes/origin/main');

    const first = refreshRemoteRefs(work, target, task);
    check(first.freshness, REMOTE_FRESHNESS.FRESH, 'explicit ref refresh succeeds with restrictive fetch config');
    check(git(work, 'rev-parse', `refs/remotes/origin/${target}`), targetSha1, 'target remote-tracking ref matches remote SHA');
    check(git(work, 'rev-parse', `refs/remotes/origin/${task}`), taskSha1, 'TASK remote-tracking ref matches remote SHA');

    git(seed, 'checkout', '-q', target);
    writeFileSync(path.join(seed, 'state.txt'), 'target advanced\n');
    git(seed, 'commit', '-q', '-am', 'target advanced');
    git(seed, 'push', '-q', 'origin', target);
    const targetSha2 = git(seed, 'rev-parse', 'HEAD');

    const second = refreshRemoteRefs(work, target, task);
    check(second.freshness, REMOTE_FRESHNESS.FRESH, 'second explicit ref refresh succeeds');
    check(git(work, 'rev-parse', `refs/remotes/origin/${target}`), targetSha2, 'target ref advances even without matching fetch config');

    console.log(`Task health Git integration: ${passed}/5 PASS`);
} finally {
    rmSync(root, { recursive: true, force: true });
}
