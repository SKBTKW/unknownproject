import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RUNNER_DECISION,
  buildAuditSummary,
  buildMergeDecision,
  buildOperationPlan,
  validatePullRequest,
} from './safe_integration_runner_core.mjs';

function readyAnalysis(overrides = {}) {
  return {
    target: 'AoT260919',
    targetSha: 'target-sha',
    backupVerified: true,
    summary: {
      MERGED: 0,
      READY: 1,
      REVIEW_REQUIRED: 0,
      RECONCILE_REQUIRED: 0,
      BLOCKED: 0,
      ...(overrides.summary || {}),
    },
    integrationOrder: overrides.integrationOrder || [{
      branch: 'aot-task/AoT260919/tooling/example',
      status: 'READY',
      action: 'INTEGRATE_ONE_AT_A_TIME',
    }],
    tasks: overrides.tasks || [{
      branch: 'aot-task/AoT260919/tooling/example',
      sha: 'task-sha',
      status: 'READY',
      localRemoteMismatch: false,
      mergePreview: { status: 'CLEAN' },
    }],
  };
}

{
  const decision = buildMergeDecision(readyAnalysis());
  assert.equal(decision.decision, RUNNER_DECISION.READY);
  assert.equal(decision.candidate.branch, 'aot-task/AoT260919/tooling/example');
}

for (const [field, value] of [
  ['BLOCKED', 1],
  ['RECONCILE_REQUIRED', 1],
  ['REVIEW_REQUIRED', 1],
]) {
  const decision = buildMergeDecision(readyAnalysis({ summary: { [field]: value } }));
  assert.equal(decision.decision, RUNNER_DECISION.BLOCKED, `${field} must block automatic merge`);
  assert.equal(decision.candidate, null);
}

{
  const analysis = readyAnalysis({ integrationOrder: [], summary: { READY: 0 } });
  const decision = buildMergeDecision(analysis);
  assert.equal(decision.decision, RUNNER_DECISION.NO_ACTION);
}

{
  const analysis = readyAnalysis({
    tasks: [{
      branch: 'aot-task/AoT260919/tooling/example',
      sha: 'task-sha',
      status: 'READY',
      localRemoteMismatch: true,
      mergePreview: { status: 'CLEAN' },
    }],
  });
  assert.equal(buildMergeDecision(analysis).decision, RUNNER_DECISION.BLOCKED);
}

{
  const analysis = readyAnalysis({
    tasks: [{
      branch: 'aot-task/AoT260919/tooling/example',
      sha: 'task-sha',
      status: 'READY',
      localRemoteMismatch: false,
      mergePreview: { status: 'CONFLICT' },
    }],
  });
  assert.equal(buildMergeDecision(analysis).decision, RUNNER_DECISION.BLOCKED);
}

const candidate = {
  branch: 'aot-task/AoT260919/tooling/example',
  sha: 'task-sha',
};

const goodPr = {
  number: 123,
  url: 'https://example.invalid/pr/123',
  isDraft: false,
  baseRefName: 'AoT260919',
  headRefName: candidate.branch,
  headRefOid: candidate.sha,
  mergeStateStatus: 'CLEAN',
  statusCheckRollup: [{
    name: 'AoT Full Inspection',
    conclusion: 'SUCCESS',
  }],
};

{
  const result = validatePullRequest(candidate, goodPr, 'AoT260919');
  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
}

for (const mutate of [
  (pr) => { pr.isDraft = true; },
  (pr) => { pr.baseRefName = 'AoT260917'; },
  (pr) => { pr.headRefOid = 'changed'; },
  (pr) => { pr.mergeStateStatus = 'DIRTY'; },
  (pr) => { pr.statusCheckRollup = []; },
  (pr) => { pr.statusCheckRollup = [{ name: 'AoT Full Inspection', conclusion: 'FAILURE' }]; },
]) {
  const pr = structuredClone(goodPr);
  mutate(pr);
  assert.equal(validatePullRequest(candidate, pr, 'AoT260919').ok, false);
}

{
  const plan = buildOperationPlan({
    analysis: readyAnalysis(),
    candidate,
    pr: goodPr,
    backup: {
      sessionDir: 'backup/session',
      bundlePath: 'backup/session/repo.bundle',
    },
  });
  assert.equal(plan.maxMergeCount, 1);
  assert.equal(plan.branchDeletionAllowed, false);
  assert.equal(plan.requiresPostMergeFullInspection, true);
  assert.equal(plan.requiresPostMergeGuardRerun, true);

  const audit = buildAuditSummary({ plan, executed: false });
  assert.equal(audit.branchDeleted, false);
  assert.equal(audit.status, 'PLAN_ONLY');
}

{
  const runnerSource = fs.readFileSync(path.join(process.cwd(), 'scratch', 'safe_integration_runner.mjs'), 'utf8');
  assert.match(runnerSource, /run\('git', \['rev-parse', '--show-toplevel'\], \{ cwd: options\.cwd \|\| process\.cwd\(\) \}\)/);
  assert.doesNotMatch(runnerSource, /run\(options\.cwd \|\| process\.cwd\(\), \['rev-parse', '--show-toplevel'\]\)/);
  assert.match(runnerSource, /--match-head-commit/);
  assert.match(runnerSource, /--merge-next requires an explicit --target/);
  assert.match(runnerSource, /Post-merge Full Inspection/);
  assert.match(runnerSource, /Post-merge Guard rerun/);
  assert.doesNotMatch(runnerSource, /--delete-branch/);
  assert.doesNotMatch(runnerSource, /git\s+branch\s+-D/);
  assert.doesNotMatch(runnerSource, /push[^\n]*--delete/);
}


{
  const syntax = spawnSync(process.execPath, ['--check', 'scratch/safe_integration_runner.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'runner syntax check failed');

  const help = spawnSync(process.execPath, ['scratch/safe_integration_runner.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(help.status, 0, help.stderr || help.stdout || 'runner help invocation failed');
  assert.match(help.stdout, /ONE MERGE MAX|Safe Integration Runner/i);
}

console.log('Safe Integration Runner contract: PASS');
