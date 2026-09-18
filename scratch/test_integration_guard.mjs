import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  GUARD_STATUS,
  buildSessionId,
  classifyObservedTask,
  discoverTaskNames,
  isAoTTarget,
  parseWorktreesPorcelain,
  targetFromTaskBranch,
} from './integration_guard_core.mjs';
import { runIntegrationGuard, assertRemoteSnapshotUnchanged } from './integration_guard.mjs';
import { verifyBundleRestorable } from './integration_guard_backup.mjs';

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}
async function rejects(fn, pattern, label) {
  await assert.rejects(fn, pattern, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

check(isAoTTarget('AoT260917'), true, 'AoT target name accepted');
check(isAoTTarget('main'), false, 'non-AoT target rejected');
check(targetFromTaskBranch('aot-task/AoT260917/tooling/guard'), 'AoT260917', 'target extracted from TASK branch');
check(targetFromTaskBranch('TASK/foo'), '', 'legacy TASK name does not infer target');
check(discoverTaskNames(['refs/heads/aot-task/AoT260917/a/x', 'origin/aot-task/AoT260917/b/y', 'origin/main'], 'AoT260917'), ['aot-task/AoT260917/a/x', 'aot-task/AoT260917/b/y'], 'TASK refs normalize and dedupe');
const parsed = parseWorktreesPorcelain('worktree C:/repo\nHEAD abc\nbranch refs/heads/AoT260917\n\nworktree C:/task\nHEAD def\nbranch refs/heads/aot-task/AoT260917/x/y\nlocked\n\n');
check(parsed.length, 2, 'worktree parser finds entries');
check(parsed[1].locked, true, 'worktree parser preserves lock state');
check(classifyObservedTask({ relationshipKnown:false, mergePreviewStatus:'UNKNOWN' }), GUARD_STATUS.BLOCKED, 'unknown relationship fails closed');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:false, mergePreviewStatus:'CONFLICT' }), GUARD_STATUS.BLOCKED, 'confirmed conflict blocks');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:false, mergePreviewStatus:'CLEAN' }), GUARD_STATUS.RECONCILE_REQUIRED, 'target drift requires reconcile');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:true, mergePreviewStatus:'NOT_REQUIRED' }), GUARD_STATUS.READY, 'contained clean TASK is ready');
check(buildSessionId(new Date(2026, 8, 18, 22, 30, 40, 123)), '20260918-223040-123', 'session id is deterministic and millisecond precise');

const stableSnapshot = { targetSha: 'a', tasks: { one: 'b' } };
assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'a', tasks: { one: 'b' } }, 'test');
passed += 1;
console.log('  PASS: identical remote snapshots accepted');
await rejects(async () => assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'c', tasks: { one: 'b' } }, 'test'), /Remote refs changed/, 'remote target drift blocks');
await rejects(async () => assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'a', tasks: { one: 'c' } }, 'test'), /Remote refs changed/, 'remote TASK drift blocks');
const fullInspectionSource = fs.readFileSync(path.join(process.cwd(), 'scratch', 'run_full_inspection.mjs'), 'utf8');
check(fullInspectionSource.includes('scratch/test_integration_guard.mjs'), true, 'Full Inspection invokes Integration Guard contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-integration-guard-test-'));
const origin = path.join(root, 'origin.git');
const repo = path.join(root, 'unknownproject');
const backupRoot = path.join(root, 'backups');
const target = 'AoT260917';
const taskA = 'aot-task/AoT260917/tooling/guard-a';
const taskB = 'aot-task/AoT260917/tooling/guard-b';
try {
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'init', '-q', repo);
  git(repo, 'config', 'user.email', 'aot@example.invalid');
  git(repo, 'config', 'user.name', 'AoT Integration Guard Test');
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'base\n');
  fs.writeFileSync(path.join(repo, 'base.txt'), 'base\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'branch', '-M', target);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '-u', 'origin', target);
  const baseSha = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '-q', '-b', taskA, baseSha);
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'task-a\n');
  git(repo, 'commit', '-q', '-am', 'task a');
  git(repo, 'push', '-q', '-u', 'origin', taskA);

  git(repo, 'checkout', '-q', '-b', taskB, baseSha);
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'task-b\n');
  git(repo, 'commit', '-q', '-am', 'task b');
  git(repo, 'push', '-q', '-u', 'origin', taskB);

  git(repo, 'checkout', '-q', target);
  fs.writeFileSync(path.join(repo, 'target.txt'), 'target advanced\n');
  git(repo, 'add', 'target.txt');
  git(repo, 'commit', '-q', '-m', 'target advanced');
  git(repo, 'push', '-q', 'origin', target);
  const targetSha = git(repo, 'rev-parse', 'HEAD');
  const beforeHead = git(repo, 'rev-parse', 'HEAD');
  const beforeStatus = git(repo, 'status', '--porcelain', '--untracked-files=all');

  const now = new Date(2026, 8, 18, 23, 0, 0, 0);
  const result = await runIntegrationGuard({ cwd: repo, target, backupRoot, now });
  check(result.analysis.targetSha, targetSha, 'E2E analysis pins current target SHA');
  check(result.analysis.backupVerified, true, 'E2E backup is verified before analysis result');
  check(result.analysis.tasks.length, 2, 'E2E discovers both TASK branches');
  check(result.analysis.summary.RECONCILE_REQUIRED, 2, 'E2E marks both stale TASKs for reconciliation');
  check(result.analysis.tasks.every((task) => task.peerOverlaps.some((peer) => peer.overlap.risk === 'SHARED_SURFACE')), true, 'E2E detects shared-surface peer overlap');
  check(fs.existsSync(result.backup.bundlePath), true, 'E2E writes bundle outside repository');
  check(fs.existsSync(result.backup.manifestPath), true, 'E2E writes backup manifest');
  check(fs.existsSync(path.join(result.backup.sessionDir, 'SHA256SUM.txt')), true, 'E2E writes bundle checksum');
  check(fs.existsSync(path.join(result.backup.sessionDir, 'integration-analysis.json')), true, 'E2E persists analysis beside backup');
  const manifest = JSON.parse(fs.readFileSync(result.backup.manifestPath, 'utf8'));
  check(manifest.bundle.verified, true, 'manifest records verified backup');
  check(manifest.bundle.restoreVerified, true, 'manifest records restore verification');
  check(manifest.targetSha, targetSha, 'manifest records exact target SHA');
  const lockPath = path.join(repo, '.git', 'aot-integration-guard.lock');
  check(fs.existsSync(lockPath), false, 'session lock is released after success');
  check(git(repo, 'rev-parse', 'HEAD'), beforeHead, 'Guard does not move HEAD');
  check(git(repo, 'status', '--porcelain', '--untracked-files=all'), beforeStatus, 'Guard leaves worktree unchanged');
  check(path.relative(repo, result.backup.sessionDir).startsWith('..'), true, 'backup is outside repository');
  check(result.backup.bundleSha256.length, 64, 'backup checksum is SHA-256 length');
  check(verifyBundleRestorable(result.backup.bundlePath, [targetSha]), true, 'bundle can be mirror-cloned and target commit restored');

  const corruptBundle = path.join(root, 'corrupt.bundle');
  fs.copyFileSync(result.backup.bundlePath, corruptBundle);
  const corruptBytes = fs.readFileSync(corruptBundle);
  fs.writeFileSync(corruptBundle, corruptBytes.subarray(0, Math.max(32, Math.floor(corruptBytes.length / 3))));
  await rejects(async () => verifyBundleRestorable(corruptBundle, [targetSha]), /Command failed|fatal|error/i, 'corrupt bundle fails restore verification');

  fs.writeFileSync(path.join(repo, 'dirty.tmp'), 'dirty\n');
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 1, 0) }), /dirty worktree/, 'dirty worktree blocks preflight');
  fs.unlinkSync(path.join(repo, 'dirty.tmp'));

  fs.writeFileSync(lockPath, '{not-json');
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 2, 0) }), /lock is unreadable/, 'unreadable lock blocks');
  check(fs.existsSync(lockPath), true, 'unreadable lock is preserved for inspection');
  fs.unlinkSync(lockPath);

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, sessionId: 'live', target }));
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 3, 0) }), /already active/, 'live lock blocks double start');
  fs.unlinkSync(lockPath);

  fs.writeFileSync(lockPath, JSON.stringify({ pid: 2147483647, sessionId: 'dead', target }));
  const recovered = await runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 4, 0) });
  check(recovered.analysis.backupVerified, true, 'valid dead lock is recoverable');
  const staleLocks = fs.readdirSync(path.join(repo, '.git')).filter((name) => name.startsWith('aot-integration-guard.lock.stale-'));
  check(staleLocks.length > 0, true, 'dead lock is archived rather than discarded');

  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot: path.join(repo, 'backups'), now: new Date(2026, 8, 18, 23, 0, 5, 0) }), /Backup root must be outside/, 'backup root inside repository blocks');

  const movedOrigin = `${origin}.offline`;
  fs.renameSync(origin, movedOrigin);
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 6, 0) }), /git fetch|failed/i, 'remote observation failure blocks');
  fs.renameSync(movedOrigin, origin);

  check(fs.existsSync(lockPath), false, 'lock is released after blocked remote run');
  check(git(repo, 'rev-parse', 'HEAD'), beforeHead, 'blocked runs still do not move HEAD');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`Integration Guard V1: ${passed} checks PASS`);
