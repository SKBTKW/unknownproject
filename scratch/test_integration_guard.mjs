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
import { runIntegrationGuard } from './integration_guard.mjs';

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
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
  check(manifest.targetSha, targetSha, 'manifest records exact target SHA');
  check(fs.existsSync(path.join(repo, '.git', 'aot-integration-guard.lock')), false, 'session lock is released after success');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`Integration Guard V1: ${passed} checks PASS`);
