import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runIntegrationGuard } from './integration_guard.mjs';
import {
  RUNNER_DECISION,
  buildAuditSummary,
  buildMergeDecision,
  buildOperationPlan,
  validatePullRequest,
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
  console.log('  --plan       inspect and write a merge plan only (default)');
  console.log('  --merge-next merge at most one READY PR after all gates pass');
  console.log('  --target AoTYYMMDD');
  console.log('  --backup-root <outside-repo-path>');
  console.log('  --repo owner/name');
  console.log('  --verbose');
  console.log('');
  console.log('This tool never deletes branches and never merges more than one PR per run.');
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

function fetchRemoteSha(cwd, branch) {
  const raw = run('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd });
  const [sha, ref] = raw.split(/\s+/);
  if (!sha || ref !== `refs/heads/${branch}`) throw new Error(`Could not resolve remote SHA for ${branch}.`);
  return sha;
}

function assertRemoteStillMatches(cwd, plan) {
  const targetNow = fetchRemoteSha(cwd, plan.target);
  const taskNow = fetchRemoteSha(cwd, plan.taskBranch);
  if (targetNow !== plan.targetBeforeSha) {
    throw new Error(`Target changed after planning: expected ${plan.targetBeforeSha}, observed ${targetNow}.`);
  }
  if (taskNow !== plan.taskSha) {
    throw new Error(`TASK changed after planning: expected ${plan.taskSha}, observed ${taskNow}.`);
  }
}

function mergeExactlyOne(cwd, repo, plan) {
  run('gh', [
    'pr', 'merge', String(plan.pullRequestNumber),
    '--repo', repo,
    '--merge',
    '--match-head-commit', plan.taskSha,
  ], { cwd });
}

function waitForTargetFullInspection(cwd, repo, targetSha, { attempts = 60, delayMs = 5000 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const raw = run('gh', [
      'run', 'list',
      '--repo', repo,
      '--workflow', 'AoT Full Inspection',
      '--branch', '',
      '--limit', '50',
      '--json', 'databaseId,headSha,status,conclusion,event,url',
    ].filter((value, index, array) => !(value === '' && array[index - 1] === '--branch')), { cwd, allowFailure: true });

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

async function rerunGuardFromFreshClone({ cwd, repo, target, backupRoot, verbose }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-safe-integration-post-'));
  const cloneDir = path.join(tempRoot, 'repo');
  try {
    run('gh', ['repo', 'clone', repo, cloneDir, '--', '--no-tags'], { cwd });
    run('git', ['checkout', target], { cwd: cloneDir });
    const result = await runIntegrationGuard({ cwd: cloneDir, target, backupRoot, verbose });
    return {
      sessionId: result.analysis.sessionId,
      targetSha: result.analysis.targetSha,
      summary: result.analysis.summary,
      analysisPath: result.analysis.analysisPath,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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
  console.log('Backup:   VERIFIED');
  console.log('Delete:   DISABLED');
  console.log('Max merge count: 1');
  console.log('Post-merge Full Inspection: REQUIRED');
  console.log('Post-merge full Guard rerun: REQUIRED');
}

export async function runSafeIntegration(options = {}) {
  const cwd = run(options.cwd || process.cwd(), ['rev-parse', '--show-toplevel']);
  ensureGh();
  const repo = resolveRepo(cwd, options.repo || '');

  const guard = await runIntegrationGuard({
    cwd,
    target: options.target || '',
    backupRoot: options.backupRoot || '',
    verbose: Boolean(options.verbose),
  });
  const { analysis, backup } = guard;
  const decision = buildMergeDecision(analysis);

  if (decision.decision !== RUNNER_DECISION.READY) {
    printPlan(decision, null, null);
    return { decision, executed: false, analysisPath: analysis.analysisPath };
  }

  const pr = loadOpenPullRequest(cwd, repo, decision.candidate.branch, analysis.target);
  const prValidation = validatePullRequest(decision.candidate, pr, analysis.target);
  if (!prValidation.ok) {
    throw new Error(`PR verification blocked: ${prValidation.problems.join('; ')}`);
  }

  const plan = buildOperationPlan({ analysis, candidate: decision.candidate, pr, backup });
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

  assertRemoteStillMatches(cwd, plan);
  mergeExactlyOne(cwd, repo, plan);

  const targetAfterSha = fetchRemoteSha(cwd, plan.target);
  if (targetAfterSha === plan.targetBeforeSha) {
    throw new Error('Merge command returned but target SHA did not change.');
  }
  const taskAfterSha = fetchRemoteSha(cwd, plan.taskBranch);
  if (taskAfterSha !== plan.taskSha) {
    throw new Error('TASK branch changed during merge execution; post-merge state requires manual inspection.');
  }

  const ancestorCheck = run('git', ['ls-remote', '--exit-code', '--heads', 'origin', plan.target], { cwd, allowFailure: true });
  if (!ancestorCheck) throw new Error('Could not re-observe target after merge.');

  const postInspection = waitForTargetFullInspection(cwd, repo, targetAfterSha);
  const postGuard = await rerunGuardFromFreshClone({
    cwd,
    repo,
    target: plan.target,
    backupRoot: options.backupRoot || backup.sessionDir.replace(/[\\/]integration-guard-[^\\/]+$/, ''),
    verbose: Boolean(options.verbose),
  });
  if (postGuard.targetSha !== targetAfterSha) {
    throw new Error(`Post-merge Guard analyzed ${postGuard.targetSha}, expected ${targetAfterSha}.`);
  }

  const audit = buildAuditSummary({
    plan,
    targetAfterSha,
    postMergeInspection: {
      runId: postInspection.databaseId,
      conclusion: postInspection.conclusion,
      url: postInspection.url || null,
    },
    postGuard,
    executed: true,
  });
  const auditPath = path.join(backup.sessionDir, 'integration-operation-audit.json');
  writeJson(auditPath, audit);

  console.log('\n============================================================');
  console.log(' SAFE INTEGRATION COMPLETE');
  console.log('============================================================');
  console.log(`Merged PR: #${plan.pullRequestNumber}`);
  console.log(`Target before: ${plan.targetBeforeSha}`);
  console.log(`Target after:  ${targetAfterSha}`);
  console.log('Post-merge Full Inspection: SUCCESS');
  console.log('Post-merge Guard rerun: COMPLETE');
  console.log('Branch deletion: NOT PERFORMED');
  console.log(`Audit: ${auditPath}`);

  return { decision, plan, audit, executed: true, planPath, auditPath };
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
