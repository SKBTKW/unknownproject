import { isCanonicalTaskBranch } from './task_branch_contract.mjs';

export const ORPHAN_STATUS = Object.freeze({
  TARGET_CONTAINED: 'TARGET_CONTAINED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  DUPLICATE_HEAD: 'DUPLICATE_HEAD',
  LOCAL_REMOTE_MISMATCH: 'LOCAL_REMOTE_MISMATCH',
  CURRENT_TASK: 'CURRENT_TASK',
  PROTECTED: 'PROTECTED',
});

export function isAoTTargetName(name) {
  return /^AoT\d{6}$/.test(name || '');
}

export function extractTaskTarget(branch) {
  const match = String(branch || '').match(/^aot-task\/(AoT\d{6})\//);
  return match?.[1] || null;
}

export function isProtectedBranch(branch, target, protectedBranches = []) {
  return branch === target || protectedBranches.includes(branch);
}

export function classifyObservedBranch({
  branch,
  target,
  ahead = 0,
  behind = 0,
  localSha = '',
  remoteSha = '',
  duplicateHeadBranches = [],
  protectedBranches = ['main'],
} = {}) {
  if (!branch || !isAoTTargetName(target)) {
    throw new TypeError('ORPHAN_BRANCH_CLASSIFICATION_INPUT_INVALID');
  }

  const taskTarget = extractTaskTarget(branch);
  const canonicalCurrentTask = isCanonicalTaskBranch(branch, target);
  const localRemoteMismatch = Boolean(localSha && remoteSha && localSha !== remoteSha);
  const noncanonical = !canonicalCurrentTask;
  const staleTaskNamespace = Boolean(taskTarget && taskTarget !== target);
  const duplicateHead = duplicateHeadBranches.filter(name => name && name !== branch);

  if (isProtectedBranch(branch, target, protectedBranches)) {
    return {
      status: ORPHAN_STATUS.PROTECTED,
      actionable: false,
      reasons: ['protected branch'],
      canonicalCurrentTask,
      staleTaskNamespace,
      noncanonical,
      duplicateHeadBranches: duplicateHead,
    };
  }

  if (canonicalCurrentTask) {
    return {
      status: ORPHAN_STATUS.CURRENT_TASK,
      actionable: false,
      reasons: ['current target canonical TASK; Task Sweeper owns this branch'],
      canonicalCurrentTask,
      staleTaskNamespace,
      noncanonical: false,
      duplicateHeadBranches: duplicateHead,
    };
  }

  if (localRemoteMismatch) {
    return {
      status: ORPHAN_STATUS.LOCAL_REMOTE_MISMATCH,
      actionable: false,
      reasons: ['local and remote heads differ'],
      canonicalCurrentTask,
      staleTaskNamespace,
      noncanonical,
      duplicateHeadBranches: duplicateHead,
    };
  }

  if (ahead > 0) {
    return {
      status: ORPHAN_STATUS.REVIEW_REQUIRED,
      actionable: false,
      reasons: [
        `${ahead} unique commit(s) exist against ${target}`,
        staleTaskNamespace ? `stale TASK namespace ${taskTarget}` : 'noncanonical branch with unique history',
      ],
      canonicalCurrentTask,
      staleTaskNamespace,
      noncanonical,
      duplicateHeadBranches: duplicateHead,
    };
  }

  if (duplicateHead.length > 0) {
    return {
      status: ORPHAN_STATUS.DUPLICATE_HEAD,
      actionable: true,
      reasons: ['no unique commits against target', `duplicate head with: ${duplicateHead.join(', ')}`],
      canonicalCurrentTask,
      staleTaskNamespace,
      noncanonical,
      duplicateHeadBranches: duplicateHead,
    };
  }

  return {
    status: ORPHAN_STATUS.TARGET_CONTAINED,
    actionable: true,
    reasons: ['no unique commits against target'],
    canonicalCurrentTask,
    staleTaskNamespace,
    noncanonical,
    duplicateHeadBranches: duplicateHead,
  };
}

export function summarizeOrphanStatuses(items = []) {
  const summary = Object.fromEntries(Object.values(ORPHAN_STATUS).map(status => [status, 0]));
  for (const item of items) {
    if (summary[item.status] === undefined) summary[item.status] = 0;
    summary[item.status] += 1;
  }
  return summary;
}
