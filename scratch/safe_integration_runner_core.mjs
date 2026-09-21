import {
  MERGE_DECISION,
  buildMergeDecisionProof,
  selectMergeCandidate,
  validateCleanupSnapshot,
  validateMergedPullRequest,
  validatePullRequest,
} from './merge_decision_core.mjs';

export const RUNNER_DECISION = MERGE_DECISION;
export const buildMergeDecision = selectMergeCandidate;
export {
  buildMergeDecisionProof,
  validateCleanupSnapshot,
  validateMergedPullRequest,
  validatePullRequest,
};

export function buildOperationPlan({ analysis, candidate, pr, backup, proof = null }) {
  return Object.freeze({
    schemaVersion: 2,
    operation: 'MERGE_NEXT',
    mergeMethod: 'squash',
    target: analysis.target,
    targetBeforeSha: analysis.targetSha,
    taskBranch: candidate.branch,
    taskSha: candidate.sha,
    pullRequestNumber: pr.number,
    pullRequestUrl: pr.url || null,
    mergeDecisionProof: proof,
    backupSessionDir: backup.sessionDir,
    backupBundlePath: backup.bundlePath,
    backupVerified: Boolean(analysis.backupVerified),
    branchDeletionAllowed: true,
    maxMergeCount: 1,
    requiresPostMergeFullInspection: true,
    requiresPostMergeGuardRerun: false,
  });
}

export function buildAuditSummary({
  plan,
  targetAfterSha = null,
  postMergeInspection = null,
  cleanup = null,
  executed = false,
  status = '',
  error = null,
}) {
  return {
    status: status || (executed ? 'COMPLETE' : 'PLAN_ONLY'),
    executed,
    operation: plan.operation,
    mergeMethod: plan.mergeMethod,
    target: plan.target,
    targetBeforeSha: plan.targetBeforeSha,
    targetAfterSha,
    taskBranch: plan.taskBranch,
    taskSha: plan.taskSha,
    pullRequestNumber: plan.pullRequestNumber,
    mergeDecisionProof: plan.mergeDecisionProof,
    backupVerified: plan.backupVerified,
    branchDeleted: cleanup?.status === 'COMPLETE',
    cleanup,
    postMergeFullInspection: postMergeInspection,
    postMergeGuardRerun: null,
    error,
  };
}
