import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RUNNER_DECISION,
  buildAuditSummary,
  buildMergeDecision,
  buildMergeDecisionProof,
  buildOperationPlan,
  validateCleanupSnapshot,
  validateMergedPullRequest,
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

for (const field of ['BLOCKED', 'RECONCILE_REQUIRED', 'REVIEW_REQUIRED']) {
  const decision = buildMergeDecision(readyAnalysis({ summary: { [field]: 1 } }));
  assert.equal(decision.decision, RUNNER_DECISION.READY, `independent READY candidate survives unrelated ${field}`);
  assert.equal(decision.candidate.branch, 'aot-task/AoT260919/tooling/example');
}

{
  const blocked = buildMergeDecision(readyAnalysis({
    integrationOrder: [],
    summary: { READY: 0, BLOCKED: 1 },
  }));
  assert.equal(blocked.decision, RUNNER_DECISION.BLOCKED);
}
{
  const review = buildMergeDecision(readyAnalysis({
    integrationOrder: [],
    summary: { READY: 0, REVIEW_REQUIRED: 1 },
  }));
  assert.equal(review.decision, RUNNER_DECISION.REVIEW_REQUIRED);
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
  const decision = buildMergeDecisionProof(readyAnalysis(), goodPr);
  assert.equal(decision.decision, RUNNER_DECISION.READY);
  assert.equal(decision.proof.targetSha, 'target-sha');
  assert.equal(decision.proof.taskSha, 'task-sha');
  assert.equal(decision.proof.pullRequestNumber, 123);
  assert.equal(decision.proof.fullInspection, 'SUCCESS');
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
  assert.equal(plan.mergeMethod, 'squash');
  assert.equal(plan.branchDeletionAllowed, true);
  assert.equal(plan.requiresPostMergeFullInspection, true);
  assert.equal(plan.requiresPostMergeGuardRerun, false);

  const audit = buildAuditSummary({ plan, executed: false });
  assert.equal(audit.branchDeleted, false);
  assert.equal(audit.status, 'PLAN_ONLY');
}

{
  const runnerSource = fs.readFileSync(path.join(process.cwd(), 'scratch', 'safe_integration_runner.mjs'), 'utf8');
  assert.match(runnerSource, /run\('git', \['rev-parse', '--show-toplevel'\], \{ cwd: options\.cwd \|\| process\.cwd\(\) \}\)/);
  assert.doesNotMatch(runnerSource, /run\(options\.cwd \|\| process\.cwd\(\), \['rev-parse', '--show-toplevel'\]\)/);
  assert.match(runnerSource, /--match-head-commit/);
  assert.match(runnerSource, /--squash/);
  assert.match(runnerSource, /--merge-next requires an explicit --target/);
  assert.match(runnerSource, /Post-merge Full Inspection/);
  assert.match(runnerSource, /cleanupMergedTask/);
  assert.doesNotMatch(runnerSource, /rerunGuardFromFreshClone/);
  assert.doesNotMatch(runnerSource, /--delete-branch/);
  assert.match(runnerSource, /\['branch', '-D', plan\.taskBranch\]/);
  assert.match(runnerSource, /\['push', 'origin', '--delete', plan\.taskBranch\]/);
}


{
  const proof = buildMergeDecisionProof(readyAnalysis(), goodPr).proof;
  assert.equal(validateMergedPullRequest(proof, {
    state: 'MERGED',
    mergedAt: '2026-09-22T00:00:00Z',
    baseRefName: 'AoT260919',
    headRefName: candidate.branch,
    headRefOid: candidate.sha,
  }).ok, true);
  assert.equal(validateCleanupSnapshot(proof, {
    localSha: candidate.sha,
    remoteSha: candidate.sha,
    worktreeDirty: false,
    worktreeLocked: false,
    currentWorktree: false,
    worktreeMissing: false,
  }).ok, true);
  assert.equal(validateCleanupSnapshot(proof, {
    localSha: candidate.sha,
    remoteSha: 'moved',
  }).ok, false);
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