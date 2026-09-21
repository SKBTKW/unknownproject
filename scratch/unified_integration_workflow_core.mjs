import { ORPHAN_STATUS } from './orphan_branch_inspector_core.mjs';
import { RUNNER_DECISION } from './safe_integration_runner_core.mjs';

export const WORKFLOW_STATUS = Object.freeze({
  READY: 'READY',
  COMPLETE: 'COMPLETE',
  BLOCKED: 'BLOCKED',
});

export function classifyRepositoryAudit(items = [], ignoredBranches = []) {
  const ignored = new Set(ignoredBranches);
  const blockers = [];
  const warnings = [];
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

    if (item.status === ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH) {
      blockers.push({ branch: item.branch, status: item.status, reasons: item.reasons || [] });
      continue;
    }
    if (item.status === ORPHAN_STATUS.REVIEW_REQUIRED) {
      blockers.push({ branch: item.branch, status: item.status, reasons: item.reasons || [] });
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
  return Object.freeze({ ignoredBranches });
}
