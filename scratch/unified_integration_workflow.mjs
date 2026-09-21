import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectBranches } from './orphan_branch_inspector.mjs';
import { runSafeIntegration } from './safe_integration_runner.mjs';
import {
  WORKFLOW_STATUS,
  classifyRepositoryAudit,
  classifyRunnerResult,
  validateWorkflowConfig,
} from './unified_integration_workflow_core.mjs';

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

function parseArgs(argv) {
  const options = {
    target: '',
    mode: 'plan',
    confirm: '',
    repo: '',
    backupRoot: '',
    configPath: '',
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') options.target = argv[++i] || '';
    else if (arg === '--plan') options.mode = 'plan';
    else if (arg === '--execute-all') options.mode = 'execute-all';
    else if (arg === '--confirm') options.confirm = argv[++i] || '';
    else if (arg === '--repo') options.repo = argv[++i] || '';
    else if (arg === '--backup-root') options.backupRoot = argv[++i] || '';
    else if (arg === '--config') options.configPath = argv[++i] || '';
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function resolveTarget(explicit, cwd) {
  if (explicit) return explicit;

  const authorized = run('git', ['config', '--get', 'aot.authorizedBranch'], { cwd, allowFailure: true });
  if (/^AoT\d{6}$/.test(authorized)) return authorized;

  const current = run('git', ['branch', '--show-current'], { cwd, allowFailure: true });
  if (/^AoT\d{6}$/.test(current)) return current;
  const taskMatch = current.match(/^aot-task\/(AoT\d{6})\//);
  if (taskMatch) return taskMatch[1];

  throw new Error('Target is ambiguous. Use --target AoTYYMMDD or set git config aot.authorizedBranch AoTYYMMDD.');
}

function loadConfig(cwd, explicitPath) {
  const filepath = explicitPath
    ? path.resolve(cwd, explicitPath)
    : path.join(cwd, '.aot-integration-workflow.json');
  if (!fs.existsSync(filepath)) return validateWorkflowConfig({});
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    throw new Error(`Integration workflow config is unreadable: ${filepath}: ${error.message}`);
  }
  return validateWorkflowConfig(parsed);
}

function refreshRefs(cwd) {
  run('git', ['fetch', 'origin', '--prune'], { cwd });
}

function inspectRepository(cwd, target, config) {
  refreshRefs(cwd);
  const items = inspectBranches({ cwd, target });
  const audit = classifyRepositoryAudit(items, config.ignoredBranches);

  console.log('\n============================================================');
  console.log(' AoT Unified Integration Workflow - REPOSITORY AUDIT');
  console.log('============================================================');
  console.log(`Target: ${target}`);
  console.log(`Ignored archival branches: ${config.ignoredBranches.length ? config.ignoredBranches.join(', ') : '(none)'}`);

  for (const item of audit.blockers) {
    console.log(`[BLOCK] ${item.branch} - ${item.status}`);
    for (const reason of item.reasons) console.log(`        ${reason}`);
  }
  for (const item of audit.reviewFindings) {
    console.log(`[STALE/REVIEW] ${item.branch} - ${item.status}`);
    for (const reason of item.reasons) console.log(`        ${reason}`);
  }
  for (const item of audit.warnings) {
    console.log(`[CLEANUP] ${item.branch} - ${item.status}`);
  }
  for (const item of audit.ignoredFindings) {
    console.log(`[IGNORED/ARCHIVE] ${item.branch} - ${item.status}`);
  }

  return { items, audit };
}

function printHelp() {
  console.log('AoT Unified Integration Workflow');
  console.log('');
  console.log('Plan only:');
  console.log('  node scratch/unified_integration_workflow.mjs --target AoTYYMMDD --plan');
  console.log('');
  console.log('Integrate all currently mergeable TASK PRs, one at a time:');
  console.log('  node scratch/unified_integration_workflow.mjs --target AoTYYMMDD --execute-all --confirm INTEGRATE');
  console.log('');
  console.log('Each merge still uses Safe Integration Runner: one PR max per iteration, verified backup, PR Full Inspection,');
  console.log('target drift check, post-merge Full Inspection, and post-merge Guard rerun. Any ambiguity stops the workflow.');
  console.log('Branch deletion is never performed.');
}

export async function runUnifiedIntegrationWorkflow(options = {}) {
  const cwd = run('git', ['rev-parse', '--show-toplevel'], { cwd: options.cwd || process.cwd() });
  const target = resolveTarget(options.target || '', cwd);
  if (!/^AoT\d{6}$/.test(target)) throw new Error(`Refusing non-AoT target: ${target}`);

  if ((options.mode || 'plan') === 'execute-all' && options.confirm !== 'INTEGRATE') {
    throw new Error('execute-all requires --confirm INTEGRATE.');
  }

  const config = loadConfig(cwd, options.configPath || '');
  let iteration = 0;
  const merged = [];

  while (true) {
    iteration += 1;
    console.log(`\n=== Unified integration iteration ${iteration} ===`);

    const repository = inspectRepository(cwd, target, config);
    if (!repository.audit.ok) {
      console.log('\nUNIFIED INTEGRATION BLOCKED by repository-wide orphan/noncanonical audit.');
      return {
        status: WORKFLOW_STATUS.BLOCKED,
        target,
        iteration,
        merged,
        repositoryAudit: repository.audit,
      };
    }

    const mode = (options.mode || 'plan') === 'execute-all' ? 'merge-next' : 'plan';
    const runnerResult = await runSafeIntegration({
      cwd,
      target,
      mode,
      repo: options.repo || '',
      backupRoot: options.backupRoot || '',
      verbose: Boolean(options.verbose),
    });
    const state = classifyRunnerResult(runnerResult);

    if (runnerResult.executed && runnerResult.plan) {
      merged.push({
        branch: runnerResult.plan.taskBranch,
        pullRequestNumber: runnerResult.plan.pullRequestNumber,
        targetAfterSha: runnerResult.audit?.targetAfterSha || null,
      });
    }

    if ((options.mode || 'plan') !== 'execute-all') {
      return {
        status: state.status,
        target,
        iteration,
        merged,
        repositoryAudit: repository.audit,
        runnerResult,
      };
    }

    if (!state.continueLoop) {
      console.log('\n============================================================');
      console.log(` Unified Integration Workflow: ${state.status}`);
      console.log('============================================================');
      console.log(`Reason: ${state.reason}`);
      console.log(`Merged in this session: ${merged.length}`);
      for (const item of merged) {
        console.log(`  PR #${item.pullRequestNumber} ${item.branch}`);
      }
      console.log('Branch deletion: NOT PERFORMED');
      return {
        status: state.status,
        target,
        iteration,
        merged,
        repositoryAudit: repository.audit,
        runnerResult,
      };
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const result = await runUnifiedIntegrationWorkflow(options);
  if (result.status === WORKFLOW_STATUS.BLOCKED) process.exitCode = 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch(error => {
    console.error(`\nUNIFIED INTEGRATION BLOCKED: ${error.message}`);
    process.exit(2);
  });
}
