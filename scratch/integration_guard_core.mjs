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

function resolvedGuidance(task = {}) {
  return task.guidance || buildTaskGuidance(task);
}

function reviewGradePeerCount(task = {}) {
  return (task.peerOverlaps || []).filter((entry) => shouldPeerOverlapRequireReview(entry.overlap)).length;
}

function comparePriority(left, right, {
  peerCountKey = 'peerOverlapCount',
  fileCountKey = '',
} = {}) {
  const leftBucket = INTEGRATION_ORDER_BUCKET[left.status] ?? 99;
  const rightBucket = INTEGRATION_ORDER_BUCKET[right.status] ?? 99;
  if (leftBucket !== rightBucket) return leftBucket - rightBucket;
  if (peerCountKey && left[peerCountKey] !== right[peerCountKey]) return left[peerCountKey] - right[peerCountKey];
  if (fileCountKey && left[fileCountKey] !== right[fileCountKey]) return left[fileCountKey] - right[fileCountKey];
  return String(left.branch || '').localeCompare(String(right.branch || ''));
}

export function buildIntegrationOrder(tasks = []) {
  return (tasks || [])
    .filter((task) => task?.status !== GUARD_STATUS.MERGED)
    .map((task) => {
      const guidance = resolvedGuidance(task);
      return {
        branch: task.branch,
        status: task.status,
        action: guidance.action,
        reason: guidance.reason,
        peerOverlapCount: reviewGradePeerCount(task),
      };
    })
    .sort((left, right) => comparePriority(left, right))
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

export function buildIntegrationClusters(graph = { nodes: [], edges: [] }) {
  const nodeByBranch = new Map((graph.nodes || []).map((node) => [node.branch, node]));
  const adjacency = new Map([...nodeByBranch.keys()].map((branch) => [branch, new Set()]));
  for (const edge of graph.edges || []) {
    if (!edge.reviewRequired) continue;
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }

  const visited = new Set();
  const clusters = [];
  for (const branch of [...nodeByBranch.keys()].sort()) {
    if (visited.has(branch)) continue;
    const queue = [branch];
    const members = [];
    visited.add(branch);
    while (queue.length > 0) {
      const current = queue.shift();
      members.push(current);
      for (const next of [...(adjacency.get(current) || [])].sort()) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    members.sort();
    const memberSet = new Set(members);
    const reviewEdges = (graph.edges || []).filter((edge) =>
      edge.reviewRequired && memberSet.has(edge.from) && memberSet.has(edge.to)
    );
    const type = members.length === 1 && reviewEdges.length === 0 ? 'INDEPENDENT' : 'REVIEW_CLUSTER';
    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      type,
      members,
      reviewEdgeCount: reviewEdges.length,
      statuses: [...new Set(members.map((member) => nodeByBranch.get(member)?.status).filter(Boolean))].sort(),
      provisional: true,
    });
  }
  return clusters;
}

export function buildClusterStrategy(cluster = {}, tasks = []) {
  const taskByBranch = new Map((tasks || []).map((task) => [task.branch, task]));
  const members = (cluster.members || []).map((branch) => taskByBranch.get(branch)).filter(Boolean);
  const statuses = new Set(members.map((task) => task.status));

  if (cluster.type === 'INDEPENDENT') {
    const task = members[0];
    if (!task) {
      return {
        action: GUARD_ACTION.STOP_AND_INSPECT,
        reason: 'Independent cluster has no matching TASK details.',
        provisional: true,
      };
    }
    return {
      action: resolvedGuidance(task).action,
      reason: `Independent TASK can be handled on its own. ${resolvedGuidance(task).reason}`,
      provisional: true,
    };
  }

  if (statuses.has(GUARD_STATUS.BLOCKED)) {
    return {
      action: GUARD_ACTION.STOP_AND_INSPECT,
      reason: 'Review cluster contains at least one BLOCKED TASK; stop cluster processing until blocked state is resolved.',
      provisional: true,
    };
  }
  if (statuses.has(GUARD_STATUS.RECONCILE_REQUIRED)) {
    return {
      action: GUARD_ACTION.RECONCILE_TARGET,
      reason: 'Review cluster contains stale TASK state; reconcile affected TASKs with the latest target before deciding cluster order.',
      provisional: true,
    };
  }
  return {
    action: GUARD_ACTION.REVIEW_OVERLAP,
    reason: 'Review cluster should be reviewed as a set before choosing a one-at-a-time integration order.',
    provisional: true,
  };
}

export function buildClusterStrategies(clusters = [], tasks = []) {
  return (clusters || []).map((cluster) => ({
    clusterId: cluster.id,
    type: cluster.type,
    members: [...(cluster.members || [])],
    ...buildClusterStrategy(cluster, tasks),
  }));
}

export function buildClusterOrders(clusters = [], tasks = [], graph = { nodes: [], edges: [] }) {
  const taskByBranch = new Map((tasks || []).map((task) => [task.branch, task]));
  const reviewDegree = new Map();
  for (const edge of graph.edges || []) {
    if (!edge.reviewRequired) continue;
    reviewDegree.set(edge.from, (reviewDegree.get(edge.from) || 0) + 1);
    reviewDegree.set(edge.to, (reviewDegree.get(edge.to) || 0) + 1);
  }

  return (clusters || []).map((cluster) => {
    const entries = (cluster.members || [])
      .map((branch) => taskByBranch.get(branch))
      .filter(Boolean)
      .map((task) => ({
        branch: task.branch,
        status: task.status,
        action: resolvedGuidance(task).action,
        reviewDegree: reviewDegree.get(task.branch) || 0,
        changedFileCount: unique(task.taskFiles || []).length,
      }))
      .sort((left, right) => comparePriority(left, right, {
        peerCountKey: 'reviewDegree',
        fileCountKey: 'changedFileCount',
      }))
      .map((entry, index) => ({
        ...entry,
        position: index + 1,
        provisional: true,
        rationale: `Status ${entry.status}; ${entry.reviewDegree} review-grade direct overlap(s); ${entry.changedFileCount} changed file(s).`,
      }));

    return {
      clusterId: cluster.id,
      type: cluster.type,
      entries,
      provisional: true,
    };
  });
}

export function buildReevaluationPlan(clusters = [], graph = { nodes: [], edges: [] }) {
  const clusterByBranch = new Map();
  for (const cluster of clusters || []) {
    for (const member of cluster.members || []) clusterByBranch.set(member, cluster);
  }

  const directReviewPeers = new Map();
  for (const edge of graph.edges || []) {
    if (!edge.reviewRequired) continue;
    if (!directReviewPeers.has(edge.from)) directReviewPeers.set(edge.from, new Set());
    if (!directReviewPeers.has(edge.to)) directReviewPeers.set(edge.to, new Set());
    directReviewPeers.get(edge.from).add(edge.to);
    directReviewPeers.get(edge.to).add(edge.from);
  }

  return (graph.nodes || [])
    .map((node) => {
      const cluster = clusterByBranch.get(node.branch);
      const direct = [...(directReviewPeers.get(node.branch) || [])].sort();
      const sameCluster = (cluster?.members || [])
        .filter((branch) => branch !== node.branch)
        .sort();
      const candidates = unique([...direct, ...sameCluster]).sort();
      return {
        afterBranch: node.branch,
        clusterId: cluster?.id || '',
        directReviewPeers: direct,
        sameClusterCandidates: sameCluster,
        reevaluateBranches: candidates,
        reason: candidates.length > 0
          ? 'Re-evaluate direct review-grade peers and remaining TASKs in the same review cluster after target history changes.'
          : 'No review-grade peer or same-cluster TASK requires predicted re-evaluation.',
        provisional: true,
      };
    })
    .sort((a, b) => a.afterBranch.localeCompare(b.afterBranch));
}

export function buildFocusedReevaluationSets(reevaluationPlan = [], graph = { nodes: [] }) {
  const activeBranches = (graph.nodes || []).map((node) => node.branch).filter(Boolean).sort();
  return (reevaluationPlan || [])
    .map((item) => {
      const primary = unique(item.reevaluateBranches || []).filter((branch) => branch !== item.afterBranch).sort();
      const primarySet = new Set(primary);
      const secondary = activeBranches
        .filter((branch) => branch !== item.afterBranch && !primarySet.has(branch))
        .sort();
      return {
        afterBranch: item.afterBranch,
        primaryReinspection: primary,
        secondaryReinspection: secondary,
        fullGuardRerunRequired: true,
        reason: primary.length > 0
          ? 'Prioritize predicted affected TASKs first, then re-run the full Guard across all remaining active TASKs because target history changed.'
          : 'No elevated-risk TASK was predicted, but re-run the full Guard across all remaining active TASKs because target history changed.',
        provisional: true,
      };
    })
    .sort((a, b) => a.afterBranch.localeCompare(b.afterBranch));
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
