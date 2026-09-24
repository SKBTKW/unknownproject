export const MERGE_DECISION = Object.freeze({
  NO_ACTION: 'NO_ACTION',
  READY: 'READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  BLOCKED: 'BLOCKED',
});

function unresolvedSummary(summary = {}) {
  const parts = [];
  if ((summary.BLOCKED || 0) > 0) parts.push(`${summary.BLOCKED} BLOCKED`);
  if ((summary.RECONCILE_REQUIRED || 0) > 0) parts.push(`${summary.RECONCILE_REQUIRED} RECONCILE_REQUIRED`);
  if ((summary.REVIEW_REQUIRED || 0) > 0) parts.push(`${summary.REVIEW_REQUIRED} REVIEW_REQUIRED`);
  return parts;
}

export function selectMergeCandidate(analysis = {}) {
  const order = Array.isArray(analysis.integrationOrder) ? analysis.integrationOrder : [];
  const candidateEntry = order.find((entry) => entry?.status === 'READY') || null;

  if (!candidateEntry) {
    const summary = analysis.summary || {};
    if ((summary.BLOCKED || 0) > 0) {
      return {
        decision: MERGE_DECISION.BLOCKED,
        reason: `No READY TASK exists; unresolved state: ${unresolvedSummary(summary).join(', ')}.`,
        candidate: null,
      };
    }
    if ((summary.RECONCILE_REQUIRED || 0) > 0 || (summary.REVIEW_REQUIRED || 0) > 0) {
      return {
        decision: MERGE_DECISION.REVIEW_REQUIRED,
        reason: `No independent READY TASK exists; unresolved state: ${unresolvedSummary(summary).join(', ')}.`,
        candidate: null,
      };
    }
    return {
      decision: MERGE_DECISION.NO_ACTION,
      reason: 'No READY TASK is available for automatic integration.',
      candidate: null,
    };
  }

  const task = (analysis.tasks || []).find((entry) => entry.branch === candidateEntry.branch) || null;
  if (!task) {
    return {
      decision: MERGE_DECISION.BLOCKED,
      reason: `Candidate ${candidateEntry.branch} is missing from analyzed TASK details.`,
      candidate: null,
    };
  }

  const problems = [];
  if (task.status !== 'READY') problems.push(`TASK status is ${task.status || 'UNKNOWN'}, expected READY`);
  if (task.localRemoteMismatch) problems.push('local/remote TASK heads differ');
  if (task.mergePreview?.status !== 'CLEAN') problems.push(`merge preview is ${task.mergePreview?.status || 'UNKNOWN'}, expected CLEAN`);
  if (candidateEntry.action !== 'INTEGRATE_ONE_AT_A_TIME') {
    problems.push(`candidate action is ${candidateEntry.action || 'UNKNOWN'}, expected INTEGRATE_ONE_AT_A_TIME`);
  }
  if (!task.branch || !task.sha) problems.push('candidate identity is incomplete');

  if (problems.length > 0) {
    return {
      decision: MERGE_DECISION.BLOCKED,
      reason: `Candidate cannot be integrated automatically: ${problems.join('; ')}.`,
      candidate: null,
    };
  }

  return {
    decision: MERGE_DECISION.READY,
    reason: 'An independent READY TASK is eligible for PR and CI proof verification.',
    candidate: {
      branch: task.branch,
      sha: task.sha,
      status: task.status,
      action: candidateEntry.action,
    },
  };
}

function fullInspectionChecks(pr) {
  const checks = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup : [];
  return checks.filter((check) => {
    const name = String(check?.name || check?.context || check?.workflowName || '');
    return /AoT Full Inspection|Full Inspection/i.test(name);
  });
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

  const inspectionChecks = fullInspectionChecks(pr);
  if (inspectionChecks.length === 0) {
    problems.push('AoT Full Inspection check was not found');
  } else if (!inspectionChecks.some((check) => String(check?.conclusion || check?.state || '').toUpperCase() === 'SUCCESS')) {
    problems.push('AoT Full Inspection is not SUCCESS');
  }

  return { ok: problems.length === 0, problems, inspectionChecks };
}

export function buildMergeDecisionProof(analysis = {}, pr = null) {
  const selection = selectMergeCandidate(analysis);
  if (selection.decision !== MERGE_DECISION.READY) return selection;

  const prValidation = validatePullRequest(selection.candidate, pr, analysis.target);
  if (!prValidation.ok) {
    return {
      decision: MERGE_DECISION.BLOCKED,
      reason: `PR verification blocked: ${prValidation.problems.join('; ')}`,
      candidate: selection.candidate,
      proof: null,
    };
  }

  const successfulInspection = prValidation.inspectionChecks.find(
    (check) => String(check?.conclusion || check?.state || '').toUpperCase() === 'SUCCESS',
  );

  const proof = Object.freeze({
    schemaVersion: 1,
    decision: MERGE_DECISION.READY,
    target: analysis.target,
    targetSha: analysis.targetSha,
    taskBranch: selection.candidate.branch,
    taskSha: selection.candidate.sha,
    pullRequestNumber: pr.number,
    pullRequestHeadSha: pr.headRefOid,
    pullRequestBase: pr.baseRefName,
    mergePreview: 'CLEAN',
    fullInspection: 'SUCCESS',
    fullInspectionCheck: String(successfulInspection?.name || successfulInspection?.context || successfulInspection?.workflowName || 'AoT Full Inspection'),
  });

  return {
    decision: MERGE_DECISION.READY,
    reason: 'Merge Decision Proof is complete for the exact target, TASK, PR head, clean merge preview, and successful Full Inspection.',
    candidate: selection.candidate,
    proof,
  };
}

export function validateMergedPullRequest(proof, pr) {
  const problems = [];
  if (!proof || proof.decision !== MERGE_DECISION.READY) problems.push('READY Merge Decision Proof is missing');
  if (!pr) problems.push('merged PR could not be loaded');
  const merged = Boolean(pr?.mergedAt) || String(pr?.state || '').toUpperCase() === 'MERGED';
  if (!merged) problems.push('PR is not merged');
  if (pr?.headRefOid !== proof?.taskSha) problems.push('merged PR head SHA does not match Merge Decision Proof');
  if (pr?.headRefName !== proof?.taskBranch) problems.push('merged PR head branch does not match Merge Decision Proof');
  if (pr?.baseRefName !== proof?.target) problems.push('merged PR base does not match Merge Decision Proof');
  return { ok: problems.length === 0, problems };
}

export function validateCleanupSnapshot(proof, snapshot = {}) {
  const problems = [];
  if (!proof || proof.decision !== MERGE_DECISION.READY) problems.push('READY Merge Decision Proof is missing');
  if (snapshot.currentWorktree) problems.push('TASK worktree is the current integration worktree');
  if (snapshot.worktreeMissing) problems.push('registered TASK worktree path is missing');
  if (snapshot.worktreeLocked) problems.push('TASK worktree is locked');
  if (snapshot.worktreeDirty) problems.push('TASK worktree has uncommitted or untracked files');
  if (snapshot.localSha && snapshot.localSha !== proof?.taskSha) problems.push('local TASK head moved after Merge Decision Proof');
  if (snapshot.remoteSha && snapshot.remoteSha !== proof?.taskSha) problems.push('remote TASK head moved after Merge Decision Proof');
  return { ok: problems.length === 0, problems };
}
