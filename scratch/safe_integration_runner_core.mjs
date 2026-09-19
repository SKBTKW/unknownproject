export const RUNNER_DECISION = Object.freeze({
  NO_ACTION: 'NO_ACTION',
  READY: 'READY',
  BLOCKED: 'BLOCKED',
});

export function buildMergeDecision(analysis = {}) {
  const summary = analysis.summary || {};
  const blockers = [];

  if ((summary.BLOCKED || 0) > 0) blockers.push(`${summary.BLOCKED} BLOCKED TASK(s)`);
  if ((summary.RECONCILE_REQUIRED || 0) > 0) blockers.push(`${summary.RECONCILE_REQUIRED} RECONCILE_REQUIRED TASK(s)`);
  if ((summary.REVIEW_REQUIRED || 0) > 0) blockers.push(`${summary.REVIEW_REQUIRED} REVIEW_REQUIRED TASK(s)`);

  if (blockers.length > 0) {
    return {
      decision: RUNNER_DECISION.BLOCKED,
      reason: `Automatic merge is disabled while unresolved risk exists: ${blockers.join(', ')}.`,
      candidate: null,
    };
  }

  const candidateOrder = Array.isArray(analysis.integrationOrder) ? analysis.integrationOrder : [];
  const candidate = candidateOrder.find((entry) => entry.status === 'READY') || null;
  if (!candidate) {
    return {
      decision: RUNNER_DECISION.NO_ACTION,
      reason: 'No READY TASK is available for automatic integration.',
      candidate: null,
    };
  }

  const task = (analysis.tasks || []).find((entry) => entry.branch === candidate.branch) || null;
  if (!task) {
    return {
      decision: RUNNER_DECISION.BLOCKED,
      reason: `Candidate ${candidate.branch} is missing from analyzed TASK details.`,
      candidate: null,
    };
  }

  if (task.localRemoteMismatch) {
    return { decision: RUNNER_DECISION.BLOCKED, reason: 'Candidate has local/remote HEAD mismatch.', candidate: null };
  }
  if (task.mergePreview?.status !== 'CLEAN') {
    return { decision: RUNNER_DECISION.BLOCKED, reason: `Candidate merge preview is ${task.mergePreview?.status || 'UNKNOWN'}.`, candidate: null };
  }
  if (candidate.action !== 'INTEGRATE_ONE_AT_A_TIME') {
    return { decision: RUNNER_DECISION.BLOCKED, reason: `Candidate action is ${candidate.action}; automatic merge requires INTEGRATE_ONE_AT_A_TIME.`, candidate: null };
  }

  return {
    decision: RUNNER_DECISION.READY,
    reason: 'Exactly one next candidate may be integrated after PR and CI verification.',
    candidate: {
      branch: task.branch,
      sha: task.sha,
      status: task.status,
      action: candidate.action,
    },
  };
}

export function validatePullRequest(candidate, pr, target) {
  const problems = [];
  if (!candidate?.branch || !candidate?.sha) problems.push('candidate identity is incomplete');
  if (!pr) problems.push('no open PR was found');
  if (pr?.isDraft) problems.push('PR is draft');
  if (pr?.baseRefName !== target) problems.push(`PR base is ${pr?.baseRefName || 'unknown'}, expected ${target}`);
  if (pr?.headRefName !== candidate?.branch) problems.push('PR head branch does not match candidate');
  if (pr?.headRefOid !== candidate?.sha) problems.push('PR head SHA does not match analyzed TASK SHA');
  if (pr?.mergeStateStatus !== 'CLEAN') problems.push(`PR merge state is ${pr?.mergeStateStatus || 'unknown'}, expected CLEAN`);

  const checks = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  const fullInspectionChecks = checks.filter((check) => {
    const name = String(check?.name || check?.context || check?.workflowName || '');
    return /AoT Full Inspection|Full Inspection/i.test(name);
  });
  if (fullInspectionChecks.length === 0) {
    problems.push('AoT Full Inspection check was not found');
  } else if (!fullInspectionChecks.some((check) => String(check?.conclusion || check?.state || '').toUpperCase() === 'SUCCESS')) {
    problems.push('AoT Full Inspection is not SUCCESS');
  }

  return {
    ok: problems.length === 0,
    problems,
  };
}

export function buildOperationPlan({ analysis, candidate, pr, backup }) {
  return Object.freeze({
    schemaVersion: 1,
    operation: 'MERGE_NEXT',
    target: analysis.target,
    targetBeforeSha: analysis.targetSha,
    taskBranch: candidate.branch,
    taskSha: candidate.sha,
    pullRequestNumber: pr.number,
    pullRequestUrl: pr.url || null,
    backupSessionDir: backup.sessionDir,
    backupBundlePath: backup.bundlePath,
    backupVerified: Boolean(analysis.backupVerified),
    branchDeletionAllowed: false,
    maxMergeCount: 1,
    requiresPostMergeFullInspection: true,
    requiresPostMergeGuardRerun: true,
  });
}

export function buildAuditSummary({ plan, targetAfterSha = null, postMergeInspection = null, postGuard = null, executed = false }) {
  return {
    executed,
    operation: plan.operation,
    target: plan.target,
    targetBeforeSha: plan.targetBeforeSha,
    targetAfterSha,
    taskBranch: plan.taskBranch,
    taskSha: plan.taskSha,
    pullRequestNumber: plan.pullRequestNumber,
    backupVerified: plan.backupVerified,
    branchDeleted: false,
    postMergeFullInspection: postMergeInspection,
    postMergeGuardRerun: postGuard,
  };
}
