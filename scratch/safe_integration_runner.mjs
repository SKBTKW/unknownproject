import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runIntegrationGuard } from './integration_guard.mjs';
import { parseWorktreesPorcelain } from './integration_guard_core.mjs';
import {
  RUNNER_DECISION,
  buildAuditSummary,
  buildMergeDecision,
  buildMergeDecisionProof,
  buildOperationPlan,
  validateCleanupSnapshot,
  validateMergedPullRequest,
} from './safe_integration_runner_core.mjs';

function run(cmd, args, { cwd = process.cwd(), allowFailure = false } = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const detail = error?.stderr?.toString?.().trim() || error?.stdout?.toString?.().trim();
    throw new Error(`${cmd} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
}

function writeJson(filepath, value) {
  fs.writeFileSync(filepath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = { target: '', backupRoot: '', mode: 'plan', repo: '', verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') options.target = argv[++i] || '';
    else if (arg === '--backup-root') options.backupRoot = argv[++i] || '';
    else if (arg === '--repo') options.repo = argv[++i] || '';
    else if (arg === '--merge-next') options.mode = 'merge-next';
    else if (arg === '--plan') options.mode = 'plan';
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log('AoT Safe Integration Runner');
  console.log('  --plan       inspect and write a Merge Decision Proof only (default)');
  console.log('  --merge-next merge at most one READY PR after all gates pass (explicit --target required)');
  console.log('  --target AoTYYMMDD');
  console.log('  --backup-root <outside-repo-path>');
  console.log('  --repo owner/name');
  console.log('  --verbose');
  console.log('');
  console.log('A READY proof is bound to exact target/TASK/PR SHAs. Successful integration uses squash merge,');
  console.log('waits for post-merge Full Inspection, then removes only the proven TASK branch/worktree.');
}

function ensureGh() {
  const version = run('gh', ['--version'], { allowFailure: true });
  if (!version) throw new Error('GitHub CLI (gh) is required for PR verification and merge execution.');
}

function resolveRepo(cwd, explicitRepo) {
  if (explicitRepo) return explicitRepo;
  const value = run('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { cwd });
  if (!/^[^/]+\/[^/]+$/.test(value)) throw new Error(`Could not resolve GitHub repository: ${value}`);
  return value;
}

function loadOpenPullRequest(cwd, repo, branch, target) {
  const raw = run('gh', [
    'pr', 'list',
    '--repo', repo,
    '--head', branch,
    '--base', target,
    '--state', 'open',
    '--json', 'number,url,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,statusCheckRollup',
  ], { cwd });
  const prs = JSON.parse(raw || '[]');
  if (prs.length !== 1) {
    throw new Error(`Expected exactly one open PR for ${branch} -> ${target}; found ${prs.length}.`);
  }
  return prs[0];
}

function loadPullRequest(cwd, repo, number) {
  const raw = run('gh', [
    'pr', 'view', String(number),
    '--repo', repo,
    '--json', 'number,url,state,mergedAt,baseRefName,headRefName,headRefOid,mergeCommit',
  ], { cwd });
  return JSON.parse(raw || '{}');
}

function fetchRemoteSha(cwd, branch, { allowMissing = false } = {}) {
  const raw = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd, allowFailure: allowMissing });
  if (!raw && allowMissing) return '';
  const [sha, ref] = raw.split(/\s+/);
  if (!sha || ref !== `refs/heads/${branch}`) {
    if (allowMissing) return '';
    throw new Error(`Could not resolve remote SHA for ${branch}.`);
  }
  return sha;
}

function localBranchSha(cwd, branch) {
  return run('git', ['rev-parse', '--verify', `refs/heads/${branch}`], { cwd, allowFailure: true });
}

function assertRemoteStillMatches(cwd, plan) {
  const targetNow = fetchRemoteSha(cwd, plan.target);
  const taskNow = fetchRemoteSha(cwd, plan.taskBranch);
  if (targetNow !== plan.targetBeforeSha) {
    throw new Error(`Target changed after Merge Decision Proof: expected ${plan.targetBeforeSha}, observed ${targetNow}.`);
  }
  if (taskNow !== plan.taskSha) {
    throw new Error(`TASK changed after Merge Decision Proof: expected ${plan.taskSha}, observed ${taskNow}.`);
  }
}

function mergeExactlyOne(cwd, repo, plan) {
  run('gh', [
    'pr', 'merge', String(plan.pullRequestNumber),
    '--repo', repo,
    '--squash',
    '--match-head-commit', plan.taskSha,
  ], { cwd });
}

function waitForTargetFullInspection(cwd, repo, targetSha, { attempts = 60, delayMs = 5000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const raw = run('gh', [
      'run', 'list',
      '--repo', repo,
      '--workflow', 'AoT Full Inspection',
      '--limit', '50',
      '--json', 'databaseId,headSha,status,conclusion,event,url',
    ], { cwd, allowFailure: true });

    if (raw) {
      const runs = JSON.parse(raw);
      const match = runs.find((entry) => entry.headSha === targetSha && entry.event === 'push');
      if (match?.status === 'completed') {
        if (match.conclusion !== 'success') {
          throw new Error(`Post-merge Full Inspection failed for target ${targetSha}: ${match.conclusion}.`);
        }
        return match;
      }
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
  }
  throw new Error(`Post-merge Full Inspection did not reach SUCCESS for target ${targetSha} within the synchronous verification window.`);
}

function inspectCleanupSnapshot(cwd, plan) {
  const worktrees = parseWorktreesPorcelain(run('git', ['worktree', 'list', '--porcelain'], { cwd }));
  const worktree = worktrees.find((entry) => entry.branch === plan.taskBranch) || null;
  const currentRoot = fs.realpathSync(cwd);
  let worktreeMissing = false;
  let currentWorktree = false;
  let worktreeDirty = false;

  if (worktree?.path) {
    worktreeMissing = !fs.existsSync(worktree.path);
    if (!worktreeMissing) {
      const worktreeReal = fs.realpathSync(worktree.path);
      currentWorktree = worktreeReal === currentRoot;
      worktreeDirty = Boolean(run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: worktree.path }));
    }
  }

  return {
    worktree,
    worktreeMissing,
    currentWorktree,
    worktreeLocked: Boolean(worktree?.locked),
    worktreeDirty,
    localSha: localBranchSha(cwd, plan.taskBranch),
    remoteSha: fetchRemoteSha(cwd, plan.taskBranch, { allowMissing: true }),
  };
}

function cleanupMergedTask(cwd, plan) {
  const proof = plan.mergeDecisionProof;
  const snapshot = inspectCleanupSnapshot(cwd, plan);
  const validation = validateCleanupSnapshot(proof, snapshot);
  if (!validation.ok) {
    throw new Error(`TASK cleanup blocked: ${validation.problems.join('; ')}`);
  }

  let worktreeRemoved = false;
  let localDeleted = false;
  let remoteDeleted = false;

  if (snapshot.worktree?.path) {
    run('git', ['worktree', 'remove', snapshot.worktree.path], { cwd });
    worktreeRemoved = true;
  }

  const localNow = localBranchSha(cwd, plan.taskBranch);
  if (localNow && localNow !== plan.taskSha) {
    throw new Error(`Local TASK changed immediately before cleanup: expected ${plan.taskSha}, observed ${localNow}.`);
  }
  if (localNow) {
    run('git', ['branch', '-D', plan.taskBranch], { cwd });
    localDeleted = true;
  }

  const remoteNow = fetchRemoteSha(cwd, plan.taskBranch, { allowMissing: true });
  if (remoteNow && remoteNow !== plan.taskSha) {
    throw new Error(`Remote TASK changed immediately before cleanup: expected ${plan.taskSha}, observed ${remoteNow}.`);
  }
  if (remoteNow) {
    run('git', ['push', 'origin', '--delete', plan.taskBranch], { cwd });
    remoteDeleted = true;
  }

  run('git', ['fetch', 'origin', '--prune'], { cwd });
  return {
    status: 'COMPLETE',
    worktreeRemoved,
    localDeleted,
    remoteDeleted,
    remoteAlreadyAbsent: !remoteNow,
  };
}

function printPlan(decision, plan, pr) {
  console.log('\n============================================================');
  console.log(' AoT Safe Integration Runner - ONE MERGE MAX');
  console.log('============================================================');
  console.log(`Decision: ${decision.decision}`);
  console.log(`Reason:   ${decision.reason}`);
  if (!plan) return;
  console.log(`Target:   ${plan.target} @ ${plan.targetBeforeSha}`);
  console.log(`TASK:     ${plan.taskBranch} @ ${plan.taskSha}`);
  console.log(`PR:       #${plan.pullRequestNumber} ${pr.url || ''}`);
  console.log('Merge Decision Proof: READY');
  console.log('Backup:   VERIFIED');
  console.log('Merge:    SQUASH');
  console.log('Post-merge Full Inspection: REQUIRED');
  console.log('Successful TASK cleanup: REQUIRED');
  console.log('Next full Guard: next integration iteration');
}

export async function runSafeIntegration(options = {}) {
  const cwd = run('git', ['rev-parse', '--show-toplevel'], { cwd: options.cwd || process.cwd() });
  if ((options.mode || 'plan') === 'merge-next' && !options.target) {
    throw new Error('--merge-next requires an explicit --target AoTYYMMDD.');
  }
  ensureGh();
  const repo = resolveRepo(cwd, options.repo || '');

  const guard = await runIntegrationGuard({
    cwd,
    target: options.target || '',
    backupRoot: options.backupRoot || '',
    verbose: Boolean(options.verbose),
  });
  const { analysis, backup } = guard;
  const selection = buildMergeDecision(analysis);

  if (selection.decision !== RUNNER_DECISION.READY) {
    printPlan(selection, null, null);
    return { decision: selection, executed: false, analysisPath: analysis.analysisPath };
  }

  const pr = loadOpenPullRequest(cwd, repo, selection.candidate.branch, analysis.target);
  const decision = buildMergeDecisionProof(analysis, pr);
  if (decision.decision !== RUNNER_DECISION.READY) {
    printPlan(decision, null, pr);
    return { decision, executed: false, analysisPath: analysis.analysisPath };
  }

  const plan = buildOperationPlan({
    analysis,
    candidate: decision.candidate,
    pr,
    backup,
    proof: decision.proof,
  });
  const planPath = path.join(backup.sessionDir, 'integration-operation-plan.json');
  writeJson(planPath, plan);
  printPlan(decision, plan, pr);

  if ((options.mode || 'plan') !== 'merge-next') {
    const audit = buildAuditSummary({ plan, executed: false });
    const auditPath = path.join(backup.sessionDir, 'integration-operation-audit.json');
    writeJson(auditPath, audit);
    console.log(`\nPLAN ONLY: no merge was performed.\nPlan: ${planPath}\nAudit: ${auditPath}`);
    return { decision, plan, audit, executed: false, planPath, auditPath };
  }

  const auditPath = path.join(backup.sessionDir, 'integration-operation-audit.json');
  writeJson(auditPath, buildAuditSummary({ plan, executed: false, status: 'EXECUTION_PENDING' }));

  let mergeAttempted = false;
  try {
    assertRemoteStillMatches(cwd, plan);
    mergeAttempted = true;
    mergeExactlyOne(cwd, repo, plan);

    const mergedPr = loadPullRequest(cwd, repo, plan.pullRequestNumber);
    const mergedValidation = validateMergedPullRequest(plan.mergeDecisionProof, mergedPr);
    if (!mergedValidation.ok) {
      throw new Error(`Merged PR verification blocked: ${mergedValidation.problems.join('; ')}`);
    }

    const targetAfterSha = fetchRemoteSha(cwd, plan.target);
    if (targetAfterSha === plan.targetBeforeSha) {
      throw new Error('Merge command returned but target SHA did not change.');
    }

    const postInspection = waitForTargetFullInspection(cwd, repo, targetAfterSha);
    const cleanup = cleanupMergedTask(cwd, plan);

    const audit = buildAuditSummary({
      plan,
      targetAfterSha,
      postMergeInspection: {
        runId: postInspection.databaseId,
        conclusion: postInspection.conclusion,
        url: postInspection.url || null,
      },
      cleanup,
      executed: true,
      status: 'COMPLETE',
    });
    writeJson(auditPath, audit);

    console.log('\n============================================================');
    console.log(' SAFE INTEGRATION COMPLETE');
    console.log('============================================================');
    console.log(`Merged PR: #${plan.pullRequestNumber} (squash)`);
    console.log(`Target before: ${plan.targetBeforeSha}`);
    console.log(`Target after:  ${targetAfterSha}`);
    console.log('Post-merge Full Inspection: SUCCESS');
    console.log('TASK cleanup: COMPLETE');
    console.log('Full Guard rerun: deferred to the next integration iteration');
    console.log(`Audit: ${auditPath}`);

    return { decision, plan, audit, executed: true, planPath, auditPath };
  } catch (error) {
    let observedTargetSha = null;
    try { observedTargetSha = fetchRemoteSha(cwd, plan.target); } catch {}
    const failureAudit = buildAuditSummary({
      plan,
      targetAfterSha: observedTargetSha,
      executed: mergeAttempted,
      status: mergeAttempted ? 'BLOCKED_AFTER_MERGE_ATTEMPT' : 'BLOCKED_BEFORE_MERGE',
      error: error?.message || String(error),
    });
    writeJson(auditPath, failureAudit);
    throw new Error(`${error.message} Audit preserved at ${auditPath}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  await runSafeIntegration(options);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(`\nSAFE INTEGRATION BLOCKED: ${error.message}`);
    process.exit(2);
  });
}
