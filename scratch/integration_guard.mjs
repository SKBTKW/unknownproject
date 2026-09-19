import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyOverlap } from './task_health.mjs';
import { previewMerge, MERGE_PREVIEW_STATUS } from './task_merge_preview.mjs';
import {
  GUARD_STATUS,
  buildClusterOrders,
  buildClusterStrategies,
  buildIntegrationClusters,
  buildIntegrationOrder,
  buildOverlapGraph,
  buildSessionId,
  buildTaskGuidance,
  explainIntegrationOrder,
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

function gitStatus(cwd, args) {
  const result = spawnSync('git', args, { cwd, windowsHide: true, stdio: 'ignore' });
  if (result.error || result.signal || result.status === null) throw new Error(`git ${args.join(' ')} could not be observed safely.`);
  return result.status;
}

function refExists(cwd, ref) {
  const status = gitStatus(cwd, ['show-ref', '--verify', '--quiet', ref]);
  if (status === 0) return true;
  if (status === 1) return false;
  throw new Error(`git show-ref failed with status ${status} for ${ref}.`);
}

function isAncestor(cwd, ancestor, descendant) {
  const status = gitStatus(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]);
  if (status === 0) return true;
  if (status === 1) return false;
  throw new Error(`git merge-base --is-ancestor failed with status ${status}.`);
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
    let previous;
    try { previous = JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
    catch { throw new Error(`Integration Guard lock is unreadable: ${lockPath}. Inspect it manually; it was not modified.`); }
    const validLock = previous
      && Number.isInteger(Number(previous.pid))
      && Number(previous.pid) > 0
      && typeof previous.sessionId === 'string' && previous.sessionId.length > 0
      && typeof previous.target === 'string' && previous.target.length > 0;
    if (!validLock) throw new Error(`Integration Guard lock is malformed: ${lockPath}. Inspect it manually; it was not modified.`);
    if (isProcessAlive(Number(previous.pid))) {
      throw new Error(`Integration Guard is already active (PID ${previous.pid}, session ${previous.sessionId}).`);
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
    const status = runGit(entry.path, ['status', '--porcelain', '--untracked-files=all']);
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
  const remoteRaw = runGit(cwd, ['ls-remote', '--heads', 'origin', `refs/heads/aot-task/${target}/*`]);
  const remote = parseRemoteTasks(remoteRaw, target);
  for (const branch of remote.refs) {
    runGit(cwd, ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  }
  return remote;
}

function snapshotFromObserved(targetSha, remote) {
  return {
    targetSha,
    tasks: Object.fromEntries([...remote.shaByBranch.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

function readRemoteSnapshot(cwd, target) {
  const targetRaw = runGit(cwd, ['ls-remote', '--heads', 'origin', `refs/heads/${target}`]);
  const targetLines = targetRaw.split(/\r?\n/).filter(Boolean);
  if (targetLines.length !== 1) throw new Error(`Remote target observation failed for ${target}; expected exactly one ref.`);
  const [targetSha, targetRef] = targetLines[0].trim().split(/\s+/);
  if (!targetSha || targetRef !== `refs/heads/${target}`) throw new Error(`Remote target observation returned an unexpected ref for ${target}.`);
  const taskRaw = runGit(cwd, ['ls-remote', '--heads', 'origin', `refs/heads/aot-task/${target}/*`]);
  return snapshotFromObserved(targetSha, parseRemoteTasks(taskRaw, target));
}

export function assertRemoteSnapshotUnchanged(expected, actual, phase = 'verification') {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`Remote refs changed during Integration Guard ${phase}; restart from preflight.`);
  }
}

function ensureBackupRootOutsideRepository(cwd, backupRoot) {
  const repoRoot = path.resolve(cwd);
  const resolved = path.resolve(backupRoot);
  const relative = path.relative(repoRoot, resolved);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`Backup root must be outside the repository: ${resolved}`);
  }
}

function localTaskRefs(cwd, target) {
  const prefix = `refs/heads/aot-task/${target}/`;
  const raw = runGit(cwd, ['for-each-ref', '--format=%(refname)', prefix]);
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
      taskIsAncestor: false,
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
      taskIsAncestor: false,
      relationshipKnown: false,
      peerOverlaps: [],
      status: GUARD_STATUS.BLOCKED,
    };
  }

  const taskFiles = splitLines(runGit(cwd, ['diff', '--name-only', `${mergeBase}..${task.sha}`]));
  const targetFiles = splitLines(runGit(cwd, ['diff', '--name-only', `${mergeBase}..${targetSha}`]));
  const overlap = classifyOverlap(targetFiles, taskFiles);
  const mergePreview = previewMerge(cwd, targetSha, task.sha);
  const targetIsAncestor = isAncestor(cwd, targetSha, task.sha);
  const taskIsAncestor = isAncestor(cwd, task.sha, targetSha);
  const status = classifyObservedTask({
    relationshipKnown: true,
    targetIsAncestor,
    taskIsAncestor,
    mergePreviewStatus: mergePreview.status,
    targetOverlapRisk: overlap.risk,
    peerOverlaps: [],
  });
  return { ...task, mergeBase, taskFiles, targetFiles, overlap, mergePreview, targetIsAncestor, taskIsAncestor, relationshipKnown: true, peerOverlaps: [], status };
}

function attachPeerOverlaps(tasks) {
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const left = tasks[i];
      const right = tasks[j];
      if (left.status === GUARD_STATUS.MERGED || right.status === GUARD_STATUS.MERGED) continue;
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
  console.log(' AoT Integration Guard V1.7 - READ ONLY');
  console.log('============================================================');
  console.log(`Target:  ${analysis.target}`);
  console.log(`SHA:     ${analysis.targetSha}`);
  console.log(`Backup:  VERIFIED`);
  console.log(`Location:${backup.sessionDir}`);
  console.log('------------------------------------------------------------');
  console.log(`MERGED:              ${counts.MERGED}`);
  console.log(`READY:               ${counts.READY}`);
  console.log(`REVIEW_REQUIRED:     ${counts.REVIEW_REQUIRED}`);
  console.log(`RECONCILE_REQUIRED:  ${counts.RECONCILE_REQUIRED}`);
  console.log(`BLOCKED:             ${counts.BLOCKED}`);
  console.log('------------------------------------------------------------');
  if (analysis.integrationOrder.length > 0) {
    console.log('Provisional integration order:');
    for (const entry of analysis.integrationOrder) {
      console.log(`  ${entry.position}. [${entry.status}] ${entry.branch} -> ${entry.action}`);
      const explanation = analysis.orderExplanations.find((item) => item.branch === entry.branch);
      if (explanation) console.log(`     why: ${explanation.rationale}`);
    }
    console.log('------------------------------------------------------------');
  }
  if (analysis.integrationClusters.length > 0) {
    console.log('Integration groups:');
    for (const cluster of analysis.integrationClusters) {
      console.log(`  [${cluster.type}] ${cluster.id}: ${cluster.members.join(', ')}`);
      const strategy = analysis.clusterStrategies.find((item) => item.clusterId === cluster.id);
      if (strategy) {
        console.log(`     action: ${strategy.action}`);
        console.log(`     why: ${strategy.reason}`);
      }
      const localOrder = analysis.clusterOrders.find((item) => item.clusterId === cluster.id);
      if (localOrder?.entries?.length) {
        console.log('     local order:');
        for (const entry of localOrder.entries) {
          console.log(`       ${entry.position}. ${entry.branch} -> ${entry.action}`);
          console.log(`          why: ${entry.rationale}`);
        }
      }
    }
    console.log('------------------------------------------------------------');
  }
  if (analysis.overlapGraph.edges.length > 0) {
    console.log('Peer-overlap graph:');
    for (const edge of analysis.overlapGraph.edges) {
      console.log(`  ${edge.from} <-> ${edge.to}: ${edge.risk}${edge.reviewRequired ? ' [REVIEW]' : ''}`);
    }
    console.log('------------------------------------------------------------');
  }
  if (analysis.tasks.length === 0) console.log('TASK branches: none');
  for (const task of analysis.tasks) {
    console.log(`[${task.status}] ${task.branch}`);
    console.log(`  head: ${task.sha}`);
    console.log(`  merge preview: ${task.mergePreview.status}`);
    console.log(`  next action: ${task.guidance.action}`);
    console.log(`  reason: ${task.guidance.reason}`);
    if (task.status !== GUARD_STATUS.MERGED && task.overlap.risk !== 'NONE') console.log(`  target overlap: ${task.overlap.risk} (${task.overlap.evidence.join(', ')})`);
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
    ensureBackupRootOutsideRepository(cwd, backupRoot);
    const expectedRemoteSnapshot = snapshotFromObserved(targetSha, remote);
    const backup = createVerifiedBackup({ cwd, backupRoot, repoName, target, targetSha, tasks, worktrees, sessionId, createdAt: now });
    assertRemoteSnapshotUnchanged(expectedRemoteSnapshot, readRemoteSnapshot(cwd, target), 'after backup');

    const inspected = attachPeerOverlaps(tasks.map((task) => inspectTask(cwd, targetSha, task)))
      .map((task) => ({ ...task, guidance: buildTaskGuidance(task) }));
    assertRemoteSnapshotUnchanged(expectedRemoteSnapshot, readRemoteSnapshot(cwd, target), 'after analysis');
    const integrationOrder = buildIntegrationOrder(inspected);
    const overlapGraph = buildOverlapGraph(inspected);
    const integrationClusters = buildIntegrationClusters(overlapGraph);
    const clusterStrategies = buildClusterStrategies(integrationClusters, inspected);
    const clusterOrders = buildClusterOrders(integrationClusters, inspected, overlapGraph);
    const analysis = {
      schemaVersion: 7,
      sessionId,
      createdAt: now.toISOString(),
      target,
      targetSha,
      backupVerified: true,
      summary: summarizeStatuses(inspected),
      integrationOrder,
      overlapGraph,
      integrationClusters,
      clusterStrategies,
      clusterOrders,
      orderExplanations: explainIntegrationOrder(integrationOrder, overlapGraph),
      tasks: inspected.map((task) => ({
        branch: task.branch,
        sha: task.sha,
        source: task.source,
        status: task.status,
        guidance: task.guidance,
        targetIsAncestor: task.targetIsAncestor,
        taskIsAncestor: task.taskIsAncestor,
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
  console.log('V1.7 is read-only with respect to repository history. It creates a verified external backup and analysis report only.');
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
