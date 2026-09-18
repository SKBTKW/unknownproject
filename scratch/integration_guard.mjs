import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyOverlap } from './task_health.mjs';
import { previewMerge, MERGE_PREVIEW_STATUS } from './task_merge_preview.mjs';
import {
  GUARD_STATUS,
  buildSessionId,
  classifyObservedTask,
  defaultBackupRoot,
  discoverTaskNames,
  isAoTTarget,
  parseWorktreesPorcelain,
  shouldPeerOverlapRequireReview,
  summarizeStatuses,
  targetFromTaskBranch,
  unique,
} from './integration_guard_core.mjs';
import { createVerifiedBackup } from './integration_guard_backup.mjs';

function runGit(cwd, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const detail = error?.stderr?.toString?.().trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function gitSuccess(cwd, args) {
  const result = spawnSync('git', args, { cwd, windowsHide: true, stdio: 'ignore' });
  return result.status === 0;
}

function refExists(cwd, ref) {
  return gitSuccess(cwd, ['show-ref', '--verify', '--quiet', ref]);
}

function resolveGitPath(cwd, name) {
  const value = runGit(cwd, ['rev-parse', '--git-path', name]);
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function ensureNoGitOperationInProgress(cwd) {
  const markers = [
    'MERGE_HEAD',
    'CHERRY_PICK_HEAD',
    'REVERT_HEAD',
    'rebase-apply',
    'rebase-merge',
  ];
  const active = markers.filter((marker) => fs.existsSync(resolveGitPath(cwd, marker)));
  if (active.length > 0) throw new Error(`Git operation in progress: ${active.join(', ')}`);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function acquireSessionLock(cwd, sessionId, target) {
  const commonDirRaw = runGit(cwd, ['rev-parse', '--git-common-dir']);
  const commonDir = path.isAbsolute(commonDirRaw) ? commonDirRaw : path.resolve(cwd, commonDirRaw);
  const lockPath = path.join(commonDir, 'aot-integration-guard.lock');
  if (fs.existsSync(lockPath)) {
    let previous = null;
    try { previous = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { previous = null; }
    if (previous?.pid && isProcessAlive(Number(previous.pid))) {
      throw new Error(`Integration Guard is already active (PID ${previous.pid}, session ${previous.sessionId || 'unknown'}).`);
    }
    const stalePath = `${lockPath}.stale-${sessionId}`;
    fs.renameSync(lockPath, stalePath);
  }
  const payload = { pid: process.pid, sessionId, target, startedAt: new Date().toISOString() };
  fs.writeFileSync(lockPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return () => {
    try { fs.unlinkSync(lockPath); } catch { /* already removed */ }
  };
}

function ensureWorktreesClean(cwd) {
  const worktrees = parseWorktreesPorcelain(runGit(cwd, ['worktree', 'list', '--porcelain']));
  const problems = [];
  for (const entry of worktrees) {
    if (!entry.path || !fs.existsSync(entry.path)) {
      problems.push(`${entry.branch || '(detached)'}: missing worktree path ${entry.path || '(unknown)'}`);
      continue;
    }
    if (entry.locked) problems.push(`${entry.branch || '(detached)'}: worktree is locked`);
    const status = runGit(entry.path, ['status', '--porcelain', '--untracked-files=all'], { allowFailure: true });
    if (status) problems.push(`${entry.branch || '(detached)'}: dirty worktree at ${entry.path}`);
  }
  if (problems.length > 0) throw new Error(`Preflight blocked:\n- ${problems.join('\n- ')}`);
  return worktrees;
}

function resolveTarget(cwd, explicitTarget) {
  if (explicitTarget) {
    if (!isAoTTarget(explicitTarget)) throw new Error(`Invalid AoT target: ${explicitTarget}`);
    return explicitTarget;
  }
  const configured = runGit(cwd, ['config', '--get', 'aot.authorizedBranch'], { allowFailure: true });
  if (isAoTTarget(configured)) return configured;
  const current = runGit(cwd, ['branch', '--show-current'], { allowFailure: true });
  if (isAoTTarget(current)) return current;
  const fromTask = targetFromTaskBranch(current);
  if (fromTask) return fromTask;
  throw new Error('Target is ambiguous. Use --target AoTYYMMDD or configure aot.authorizedBranch.');
}

function parseRemoteTasks(raw, target) {
  const refs = [];
  const shaByBranch = new Map();
  for (const line of String(raw || '').split(/\r?\n/).filter(Boolean)) {
    const [sha, fullRef] = line.trim().split(/\s+/);
    if (!fullRef?.startsWith(`refs/heads/aot-task/${target}/`)) continue;
    const branch = fullRef.replace(/^refs\/heads\//, '');
    refs.push(branch);
    shaByBranch.set(branch, sha);
  }
  return { refs, shaByBranch };
}

function refreshObservedRefs(cwd, target) {
  runGit(cwd, ['fetch', '--no-tags', 'origin', `+refs/heads/${target}:refs/remotes/origin/${target}`]);
  const remoteRaw = runGit(cwd, ['ls-remote', '--heads', 'origin', `refs/heads/aot-task/${target}/*`], { allowFailure: true });
  const remote = parseRemoteTasks(remoteRaw, target);
  for (const branch of remote.refs) {
    runGit(cwd, ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  }
  return remote;
}

function localTaskRefs(cwd, target) {
  const prefix = `refs/heads/aot-task/${target}/`;
  const raw = runGit(cwd, ['for-each-ref', '--format=%(refname)', prefix], { allowFailure: true });
  return raw ? raw.split(/\r?\n/).filter(Boolean) : [];
}

function observedTasks(cwd, target, remote) {
  const localRefs = localTaskRefs(cwd, target);
  const names = discoverTaskNames([...localRefs, ...remote.refs], target);
  return names.map((branch) => {
    const localRef = `refs/heads/${branch}`;
    const remoteRef = `refs/remotes/origin/${branch}`;
    const localExists = refExists(cwd, localRef);
    const remoteExists = refExists(cwd, remoteRef);
    const localSha = localExists ? runGit(cwd, ['rev-parse', localRef]) : '';
    const remoteSha = remoteExists ? runGit(cwd, ['rev-parse', remoteRef]) : '';
    return {
      branch,
      localExists,
      remoteExists,
      localSha,
      remoteSha,
      sha: remoteSha || localSha,
      source: remoteSha ? 'origin' : 'local',
      localRemoteMismatch: Boolean(localSha && remoteSha && localSha !== remoteSha),
    };
  });
}

function verifyTargetState(cwd, target) {
  const remoteRef = `refs/remotes/origin/${target}`;
  if (!refExists(cwd, remoteRef)) throw new Error(`Missing origin/${target} after fetch.`);
  const remoteSha = runGit(cwd, ['rev-parse', remoteRef]);
  const localRef = `refs/heads/${target}`;
  if (refExists(cwd, localRef)) {
    const localSha = runGit(cwd, ['rev-parse', localRef]);
    if (localSha !== remoteSha) {
      throw new Error(`Local ${target} (${localSha}) does not match origin/${target} (${remoteSha}).`);
    }
  }
  return remoteSha;
}

function splitLines(value) {
  return String(value || '').split(/\r?\n/).filter(Boolean);
}

function inspectTask(cwd, targetSha, task) {
  if (!task.remoteExists || task.localRemoteMismatch || !task.sha) {
    return {
      ...task,
      taskFiles: [],
      targetFiles: [],
      overlap: { risk: 'NONE', risks: [], evidence: [] },
      mergePreview: { status: MERGE_PREVIEW_STATUS.UNKNOWN, conflictPaths: [], reason: task.remoteExists ? 'Local/remote TASK mismatch.' : 'TASK is not pushed to origin.' },
      targetIsAncestor: false,
      relationshipKnown: false,
      peerOverlaps: [],
      status: GUARD_STATUS.BLOCKED,
    };
  }

  const mergeBase = runGit(cwd, ['merge-base', targetSha, task.sha], { allowFailure: true });
  if (!mergeBase) {
    return {
      ...task,
      taskFiles: [], targetFiles: [],
      overlap: { risk: 'NONE', risks: [], evidence: [] },
      mergePreview: { status: MERGE_PREVIEW_STATUS.UNKNOWN, conflictPaths: [], reason: 'No merge base.' },
      targetIsAncestor: false,
      relationshipKnown: false,
      peerOverlaps: [],
      status: GUARD_STATUS.BLOCKED,
    };
  }

  const taskFiles = splitLines(runGit(cwd, ['diff', '--name-only', `${mergeBase}..${task.sha}`], { allowFailure: true }));
  const targetFiles = splitLines(runGit(cwd, ['diff', '--name-only', `${mergeBase}..${targetSha}`], { allowFailure: true }));
  const overlap = classifyOverlap(targetFiles, taskFiles);
  const mergePreview = previewMerge(cwd, targetSha, task.sha);
  const targetIsAncestor = gitSuccess(cwd, ['merge-base', '--is-ancestor', targetSha, task.sha]);
  const status = classifyObservedTask({
    relationshipKnown: true,
    targetIsAncestor,
    mergePreviewStatus: mergePreview.status,
    targetOverlapRisk: overlap.risk,
    peerOverlaps: [],
  });
  return { ...task, mergeBase, taskFiles, targetFiles, overlap, mergePreview, targetIsAncestor, relationshipKnown: true, peerOverlaps: [], status };
}

function attachPeerOverlaps(tasks) {
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const left = tasks[i];
      const right = tasks[j];
      const overlap = classifyOverlap(left.taskFiles, right.taskFiles);
      if (overlap.risk === 'NONE') continue;
      left.peerOverlaps.push({ branch: right.branch, overlap });
      right.peerOverlaps.push({ branch: left.branch, overlap });
    }
  }
  for (const task of tasks) {
    if (task.status === GUARD_STATUS.READY && task.peerOverlaps.some((entry) => shouldPeerOverlapRequireReview(entry.overlap))) {
      task.status = GUARD_STATUS.REVIEW_REQUIRED;
    }
  }
  return tasks;
}

function writeAnalysis(backup, analysis) {
  const filepath = path.join(backup.sessionDir, 'integration-analysis.json');
  fs.writeFileSync(filepath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  return filepath;
}

function printDashboard(analysis, backup) {
  const counts = analysis.summary;
  console.log('\n============================================================');
  console.log(' AoT Integration Guard V1 - READ ONLY');
  console.log('============================================================');
  console.log(`Target:  ${analysis.target}`);
  console.log(`SHA:     ${analysis.targetSha}`);
  console.log(`Backup:  VERIFIED`);
  console.log(`Location:${backup.sessionDir}`);
  console.log('------------------------------------------------------------');
  console.log(`READY:               ${counts.READY}`);
  console.log(`REVIEW_REQUIRED:     ${counts.REVIEW_REQUIRED}`);
  console.log(`RECONCILE_REQUIRED:  ${counts.RECONCILE_REQUIRED}`);
  console.log(`BLOCKED:             ${counts.BLOCKED}`);
  console.log('------------------------------------------------------------');
  if (analysis.tasks.length === 0) console.log('TASK branches: none');
  for (const task of analysis.tasks) {
    console.log(`[${task.status}] ${task.branch}`);
    console.log(`  head: ${task.sha}`);
    console.log(`  merge preview: ${task.mergePreview.status}`);
    if (task.overlap.risk !== 'NONE') console.log(`  target overlap: ${task.overlap.risk} (${task.overlap.evidence.join(', ')})`);
    for (const peer of task.peerOverlaps) {
      console.log(`  peer overlap: ${peer.branch} -> ${peer.overlap.risk} (${peer.overlap.evidence.join(', ')})`);
    }
    if (task.mergePreview.conflictPaths?.length) console.log(`  conflicts: ${task.mergePreview.conflictPaths.join(', ')}`);
  }
  console.log('\nNo merge, reset, rebase, push, branch deletion, or conflict resolution was performed.');
}

export async function runIntegrationGuard({ cwd: requestedCwd, target: explicitTarget = '', backupRoot: explicitBackupRoot = '', now = new Date() } = {}) {
  const cwd = runGit(requestedCwd || process.cwd(), ['rev-parse', '--show-toplevel']);
  ensureNoGitOperationInProgress(cwd);
  const target = resolveTarget(cwd, explicitTarget);
  const sessionId = buildSessionId(now);
  const releaseLock = acquireSessionLock(cwd, sessionId, target);
  try {
    const worktrees = ensureWorktreesClean(cwd);
    const remote = refreshObservedRefs(cwd, target);
    const targetSha = verifyTargetState(cwd, target);
    const tasks = observedTasks(cwd, target, remote);
    const repoName = path.basename(cwd);
    const backupRoot = explicitBackupRoot || defaultBackupRoot(cwd);
    const backup = createVerifiedBackup({ cwd, backupRoot, repoName, target, targetSha, tasks, worktrees, sessionId, createdAt: now });

    const inspected = attachPeerOverlaps(tasks.map((task) => inspectTask(cwd, targetSha, task)));
    const analysis = {
      schemaVersion: 1,
      sessionId,
      createdAt: now.toISOString(),
      target,
      targetSha,
      backupVerified: true,
      summary: summarizeStatuses(inspected),
      tasks: inspected.map((task) => ({
        branch: task.branch,
        sha: task.sha,
        source: task.source,
        status: task.status,
        targetIsAncestor: task.targetIsAncestor,
        localRemoteMismatch: task.localRemoteMismatch,
        taskFiles: task.taskFiles,
        targetFiles: task.targetFiles,
        overlap: task.overlap,
        mergePreview: task.mergePreview,
        peerOverlaps: task.peerOverlaps,
      })),
    };
    analysis.analysisPath = writeAnalysis(backup, analysis);
    printDashboard(analysis, backup);
    return { analysis, backup };
  } finally {
    releaseLock();
  }
}

function parseArgs(argv) {
  const options = { target: '', backupRoot: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') options.target = argv[++i] || '';
    else if (arg === '--backup-root') options.backupRoot = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log('Usage: node scratch/integration_guard.mjs [--target AoTYYMMDD] [--backup-root <path>]');
  console.log('V1 is read-only with respect to repository history. It creates a verified external backup and analysis report only.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  await runIntegrationGuard({ target: options.target, backupRoot: options.backupRoot });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`\nIntegration Guard BLOCKED: ${error.message}`);
    process.exit(2);
  });
}
