import path from 'node:path';

export const GUARD_STATUS = Object.freeze({
  MERGED: 'MERGED',
  READY: 'READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  RECONCILE_REQUIRED: 'RECONCILE_REQUIRED',
  BLOCKED: 'BLOCKED',
});

export const GUARD_ACTION = Object.freeze({
  NONE: 'NONE',
  INTEGRATE_ONE_AT_A_TIME: 'INTEGRATE_ONE_AT_A_TIME',
  REVIEW_OVERLAP: 'REVIEW_OVERLAP',
  RECONCILE_TARGET: 'RECONCILE_TARGET',
  STOP_AND_INSPECT: 'STOP_AND_INSPECT',
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
  taskIsAncestor = false,
  mergePreviewStatus = 'UNKNOWN',
  targetOverlapRisk = 'NONE',
  peerOverlaps = [],
} = {}) {
  if (!relationshipKnown) {
    return GUARD_STATUS.BLOCKED;
  }
  if (taskIsAncestor) {
    return GUARD_STATUS.MERGED;
  }
  if (mergePreviewStatus === 'UNKNOWN') {
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

export function buildTaskGuidance(task = {}) {
  switch (task.status) {
    case GUARD_STATUS.MERGED:
      return {
        action: GUARD_ACTION.NONE,
        reason: 'TASK HEAD is already contained in the target history.',
      };
    case GUARD_STATUS.READY:
      return {
        action: GUARD_ACTION.INTEGRATE_ONE_AT_A_TIME,
        reason: 'TASK contains the latest target, merge preview is clean, and no review-grade overlap was observed.',
      };
    case GUARD_STATUS.REVIEW_REQUIRED: {
      const peer = (task.peerOverlaps || []).find((entry) => shouldPeerOverlapRequireReview(entry.overlap));
      const risk = task.overlap?.risk && task.overlap.risk !== 'NONE'
        ? task.overlap.risk
        : peer?.overlap?.risk || 'overlap';
      return {
        action: GUARD_ACTION.REVIEW_OVERLAP,
        reason: `Review ${risk} before integration; no automatic reconciliation or conflict resolution is permitted.`,
      };
    }
    case GUARD_STATUS.RECONCILE_REQUIRED:
      return {
        action: GUARD_ACTION.RECONCILE_TARGET,
        reason: 'Latest target is not contained in TASK HEAD; reconcile the current target, rerun tests, then reassess.',
      };
    case GUARD_STATUS.BLOCKED:
    default: {
      let reason = 'TASK state is not safe enough to continue automatically.';
      if (task.localRemoteMismatch) reason = 'Local and origin TASK refs disagree.';
      else if (task.remoteExists === false) reason = 'TASK has not been pushed to origin.';
      else if (task.relationshipKnown === false) reason = task.mergePreview?.reason || 'Git history relationship is unknown.';
      else if (task.mergePreview?.status === 'CONFLICT') reason = 'Virtual merge detected content conflicts.';
      else if (task.mergePreview?.status === 'UNKNOWN') reason = task.mergePreview?.reason || 'Merge preview is unavailable.';
      return {
        action: GUARD_ACTION.STOP_AND_INSPECT,
        reason,
      };
    }
  }
}

export const INTEGRATION_ORDER_BUCKET = Object.freeze({
  READY: 0,
  REVIEW_REQUIRED: 1,
  RECONCILE_REQUIRED: 2,
  BLOCKED: 3,
});

export function buildIntegrationOrder(tasks = []) {
  return (tasks || [])
    .filter((task) => task?.status !== GUARD_STATUS.MERGED)
    .map((task) => ({
      branch: task.branch,
      status: task.status,
      action: task.guidance?.action || buildTaskGuidance(task).action,
      reason: task.guidance?.reason || buildTaskGuidance(task).reason,
      peerOverlapCount: (task.peerOverlaps || []).filter((entry) => shouldPeerOverlapRequireReview(entry.overlap)).length,
    }))
    .sort((left, right) => {
      const leftBucket = INTEGRATION_ORDER_BUCKET[left.status] ?? 99;
      const rightBucket = INTEGRATION_ORDER_BUCKET[right.status] ?? 99;
      if (leftBucket !== rightBucket) return leftBucket - rightBucket;
      if (left.peerOverlapCount !== right.peerOverlapCount) return left.peerOverlapCount - right.peerOverlapCount;
      return String(left.branch || '').localeCompare(String(right.branch || ''));
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
      provisional: true,
    }));
}

export function buildOverlapGraph(tasks = []) {
  const active = (tasks || []).filter((task) => task?.status !== GUARD_STATUS.MERGED);
  const byBranch = new Map(active.map((task) => [task.branch, task]));
  const nodes = active
    .map((task) => ({
      branch: task.branch,
      status: task.status,
      action: task.guidance?.action || buildTaskGuidance(task).action,
      reviewGradePeerCount: (task.peerOverlaps || []).filter((entry) => shouldPeerOverlapRequireReview(entry.overlap)).length,
    }))
    .sort((a, b) => String(a.branch).localeCompare(String(b.branch)));

  const edgeByKey = new Map();
  for (const task of active) {
    for (const peer of task.peerOverlaps || []) {
      if (!byBranch.has(peer.branch) || peer.branch === task.branch) continue;
      const pair = [task.branch, peer.branch].sort();
      const key = pair.join('\u0000');
      if (edgeByKey.has(key)) continue;
      edgeByKey.set(key, {
        from: pair[0],
        to: pair[1],
        risk: peer.overlap?.risk || 'NONE',
        risks: [...(peer.overlap?.risks || [])],
        evidence: [...(peer.overlap?.evidence || [])],
        reviewRequired: shouldPeerOverlapRequireReview(peer.overlap),
      });
    }
  }

  const edges = [...edgeByKey.values()].sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to)
  );
  return {
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      reviewEdgeCount: edges.filter((edge) => edge.reviewRequired).length,
    },
  };
}

export function explainIntegrationOrder(order = [], graph = { nodes: [], edges: [] }) {
  const reviewPeers = new Map();
  for (const edge of graph.edges || []) {
    if (!edge.reviewRequired) continue;
    if (!reviewPeers.has(edge.from)) reviewPeers.set(edge.from, []);
    if (!reviewPeers.has(edge.to)) reviewPeers.set(edge.to, []);
    reviewPeers.get(edge.from).push(edge.to);
    reviewPeers.get(edge.to).push(edge.from);
  }
  return (order || []).map((entry) => {
    const peers = [...(reviewPeers.get(entry.branch) || [])].sort();
    let rationale = `Status ${entry.status} determines the primary ordering bucket.`;
    if (peers.length === 0) {
      rationale += ' No review-grade peer overlap was observed.';
    } else {
      rationale += ` Review-grade overlap exists with ${peers.join(', ')}; fewer such overlaps are preferred within the same status.`;
    }
    return {
      position: entry.position,
      branch: entry.branch,
      rationale,
      relatedBranches: peers,
      provisional: true,
    };
  });
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
