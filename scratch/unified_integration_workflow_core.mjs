import { ORPHAN_STATUS } from './orphan_branch_inspector_core.mjs';
import { RUNNER_DECISION } from './safe_integration_runner_core.mjs';

export const WORKFLOW_STATUS = Object.freeze({
  READY: 'READY',
  COMPLETE: 'COMPLETE',
  BLOCKED: 'BLOCKED',
});

function normalizeReviewedBranches(value) {
  if (!Array.isArray(value)) return [];
  const byBranch = new Map();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const branch = typeof entry.branch === 'string' ? entry.branch.trim() : '';
    const sha = typeof entry.sha === 'string' ? entry.sha.trim().toLowerCase() : '';
    if (!branch || !/^[0-9a-f]{40}$/.test(sha)) continue;

    const disposition = typeof entry.disposition === 'string' && entry.disposition.trim()
      ? entry.disposition.trim()
      : 'REVIEWED';
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';

    byBranch.set(branch, Object.freeze({ branch, sha, disposition, reason }));
  }

  return [...byBranch.values()];
}

export function classifyRepositoryAudit(items = [], ignoredBranches = [], reviewedBranches = []) {
  const ignored = new Set(ignoredBranches);
  const reviewed = new Map(normalizeReviewedBranches(reviewedBranches).map(entry => [entry.branch, entry]));
  const blockers = [];
  const warnings = [];
  const reviewFindings = [];
  const ignoredFindings = [];

  for (const item of items) {
    if (ignored.has(item.branch)) {
      if ([ORPHAN_STATUS.REVIEW_REQUIRED, ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH].includes(item.status)) {
        ignoredFindings.push({
          branch: item.branch,
          status: item.status,
          reasons: item.reasons || [],
        });
      }
      continue;
    }

    // Observation integrity failures are never bypassed by a stale-history review.
    if (item.status === ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH) {
      blockers.push({ branch: item.branch, status: item.status, reasons: item.reasons || [] });
      continue;
    }

    if (item.status === ORPHAN_STATUS.REVIEW_REQUIRED) {
      const acknowledgement = reviewed.get(item.branch);
      const observedSha = String(item.remoteSha || item.localSha || '').toLowerCase();

      if (acknowledgement && observedSha && acknowledgement.sha === observedSha) {
        reviewFindings.push({
          branch: item.branch,
          status: item.status,
          reasons: item.reasons || [],
          reviewedSha: acknowledgement.sha,
          disposition: acknowledgement.disposition,
          reviewReason: acknowledgement.reason,
        });
        continue;
      }

      const reasons = [...(item.reasons || [])];
      if (!acknowledgement) {
        reasons.push('unique history has no pinned review acknowledgement');
      } else if (!observedSha) {
        reasons.push(`review acknowledgement is pinned to ${acknowledgement.sha}, but no branch HEAD SHA was observed`);
      } else {
        reasons.push(`review acknowledgement is pinned to ${acknowledgement.sha}, observed ${observedSha}`);
      }
      blockers.push({ branch: item.branch, status: item.status, reasons });
      continue;
    }

    if ([ORPHAN_STATUS.TARGET_CONTAINED, ORPHAN_STATUS.DUPLICATE_HEAD].includes(item.status)) {
      warnings.push({ branch: item.branch, status: item.status, reasons: item.reasons || [] });
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    reviewFindings,
    ignoredFindings,
  };
}

export function classifyRunnerResult(result = {}) {
  if (result?.executed === true) {
    return { status: WORKFLOW_STATUS.READY, continueLoop: true, reason: 'one merge completed safely' };
  }
  const decision = result?.decision?.decision;
  if (decision === RUNNER_DECISION.NO_ACTION) {
    return { status: WORKFLOW_STATUS.COMPLETE, continueLoop: false, reason: result?.decision?.reason || 'no READY TASK remains' };
  }
  if (decision === RUNNER_DECISION.BLOCKED) {
    return { status: WORKFLOW_STATUS.BLOCKED, continueLoop: false, reason: result?.decision?.reason || 'Safe Integration Runner blocked' };
  }
  if (decision === RUNNER_DECISION.READY) {
    return { status: WORKFLOW_STATUS.READY, continueLoop: false, reason: 'READY candidate available in plan mode' };
  }
  return { status: WORKFLOW_STATUS.BLOCKED, continueLoop: false, reason: 'unknown Safe Integration Runner result' };
}

export function validateWorkflowConfig(config = {}) {
  const ignoredBranches = Array.isArray(config.ignoredBranches)
    ? [...new Set(config.ignoredBranches.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))]
    : [];
  const reviewedBranches = normalizeReviewedBranches(config.reviewedBranches);
  return Object.freeze({ ignoredBranches, reviewedBranches });
}
