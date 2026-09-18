import path from 'node:path';

export const GUARD_STATUS = Object.freeze({
  READY: 'READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  RECONCILE_REQUIRED: 'RECONCILE_REQUIRED',
  BLOCKED: 'BLOCKED',
});

export const PEER_REVIEW_RISKS = new Set([
  'PATH_OVERLAP',
  'SHARED_SURFACE',
  'CONTRACT_OVERLAP',
]);

export function isAoTTarget(value) {
  return /^AoT\d{6}$/.test(String(value || ''));
}

export function targetFromTaskBranch(branch) {
  const match = String(branch || '').match(/^aot-task\/(AoT\d{6})\//);
  return match ? match[1] : '';
}

export function parseWorktreesPorcelain(raw) {
  const entries = [];
  let current = null;
  for (const line of `${raw || ''}\n`.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) entries.push(current);
      current = { path: line.slice('worktree '.length), branch: '', locked: false, prunable: false };
    } else if (!line && current) {
      entries.push(current);
      current = null;
    } else if (current && line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length);
    } else if (current && line.startsWith('locked')) {
      current.locked = true;
    } else if (current && line.startsWith('prunable')) {
      current.prunable = true;
    }
  }
  return entries;
}

export function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

export function normalizeTaskRefName(refName) {
  return String(refName || '')
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\/origin\//, '')
    .replace(/^origin\//, '');
}

export function discoverTaskNames(refNames, target) {
  const prefix = `aot-task/${target}/`;
  return unique((refNames || []).map(normalizeTaskRefName).filter((name) => name.startsWith(prefix))).sort();
}

export function shouldPeerOverlapRequireReview(overlap) {
  const risks = overlap?.risks || (overlap?.risk ? [overlap.risk] : []);
  return risks.some((risk) => PEER_REVIEW_RISKS.has(risk));
}

export function classifyObservedTask({
  relationshipKnown = true,
  targetIsAncestor = false,
  mergePreviewStatus = 'UNKNOWN',
  targetOverlapRisk = 'NONE',
  peerOverlaps = [],
} = {}) {
  if (!relationshipKnown || mergePreviewStatus === 'UNKNOWN') {
    return GUARD_STATUS.BLOCKED;
  }
  if (mergePreviewStatus === 'CONFLICT') {
    return GUARD_STATUS.BLOCKED;
  }
  if (!targetIsAncestor) {
    return GUARD_STATUS.RECONCILE_REQUIRED;
  }
  if (targetOverlapRisk === 'CONTRACT_OVERLAP' || targetOverlapRisk === 'SHARED_SURFACE' || targetOverlapRisk === 'PATH_OVERLAP') {
    return GUARD_STATUS.REVIEW_REQUIRED;
  }
  if (peerOverlaps.some((entry) => shouldPeerOverlapRequireReview(entry.overlap))) {
    return GUARD_STATUS.REVIEW_REQUIRED;
  }
  return GUARD_STATUS.READY;
}

export function summarizeStatuses(tasks = []) {
  const counts = Object.fromEntries(Object.values(GUARD_STATUS).map((status) => [status, 0]));
  for (const task of tasks) {
    if (counts[task.status] !== undefined) counts[task.status] += 1;
  }
  return counts;
}

export function buildSessionId(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    String(date.getMilliseconds()).padStart(3, '0'),
  ].join('');
}

export function defaultBackupRoot(repoRoot) {
  return path.resolve(repoRoot, '..', 'AoT_Backups');
}
