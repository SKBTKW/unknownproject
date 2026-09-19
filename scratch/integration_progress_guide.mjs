export const PROGRESS_CLASS = Object.freeze({
  INTEGRATE_NOW: 'INTEGRATE_NOW',
  PREPARE_FOR_INTEGRATION: 'PREPARE_FOR_INTEGRATION',
  NO_INTEGRATION_NEEDED: 'NO_INTEGRATION_NEEDED',
});

function repairSteps(task = {}) {
  switch (task.status) {
    case 'REVIEW_REQUIRED':
      return [
        'Review target/peer overlap evidence and decide the intended ownership/order.',
        'If code or responsibility changes are required, update the TASK branch only.',
        'Run focused tests and AoT Full Inspection.',
        'Rerun Integration Guard until this TASK becomes READY or MERGED.',
      ];
    case 'RECONCILE_REQUIRED':
      return [
        'Reconcile the latest target into this TASK without changing target directly.',
        'Resolve any resulting semantic or content conflict deliberately.',
        'Run focused tests and AoT Full Inspection.',
        'Rerun Integration Guard until this TASK becomes READY or MERGED.',
      ];
    case 'BLOCKED':
    default:
      return [
        'Inspect the blocking evidence before changing history.',
        'Fix the specific branch/ref/worktree/merge-preview problem on the TASK side.',
        'Run focused tests and AoT Full Inspection when code changed.',
        'Rerun Integration Guard until this TASK becomes READY or MERGED.',
      ];
  }
}

export function classifyProgressTask(task = {}) {
  if (task.status === 'MERGED') {
    return {
      branch: task.branch,
      status: task.status,
      progressClass: PROGRESS_CLASS.NO_INTEGRATION_NEEDED,
      nextAction: 'CLEANUP_CANDIDATE',
      reason: 'TASK HEAD is already contained in target history; no integration is needed.',
      steps: ['Keep branch cleanup separate from integration and verify deletion safety before deleting.'],
    };
  }

  if (task.status === 'READY') {
    return {
      branch: task.branch,
      status: task.status,
      progressClass: PROGRESS_CLASS.INTEGRATE_NOW,
      nextAction: 'SAFE_INTEGRATION_RUNNER',
      reason: 'TASK is READY and may be considered by the one-at-a-time Safe Integration Runner.',
      steps: [
        'Verify/open the PR and AoT Full Inspection result.',
        'Run Safe Integration Runner for at most one integration.',
        'After target changes, rerun Integration Guard before selecting another TASK.',
      ],
    };
  }

  return {
    branch: task.branch,
    status: task.status || 'BLOCKED',
    progressClass: PROGRESS_CLASS.PREPARE_FOR_INTEGRATION,
    nextAction: task.guidance?.action || 'STOP_AND_INSPECT',
    reason: task.guidance?.reason || 'TASK must be made safe before integration.',
    steps: repairSteps(task),
    evidence: {
      targetOverlap: task.overlap?.risk || 'NONE',
      peerOverlaps: (task.peerOverlaps || []).map((entry) => ({
        branch: entry.branch,
        risk: entry.overlap?.risk || 'NONE',
      })),
      mergePreview: task.mergePreview?.status || 'UNKNOWN',
      localRemoteMismatch: Boolean(task.localRemoteMismatch),
    },
  };
}

function progressBucket(entry) {
  if (entry.progressClass === PROGRESS_CLASS.INTEGRATE_NOW) return 0;
  if (entry.progressClass === PROGRESS_CLASS.PREPARE_FOR_INTEGRATION) {
    if (entry.status === 'REVIEW_REQUIRED') return 1;
    if (entry.status === 'RECONCILE_REQUIRED') return 2;
    return 3;
  }
  return 4;
}

export function buildIntegrationProgressGuide(analysis = {}) {
  const tasks = Array.isArray(analysis.tasks) ? analysis.tasks : [];
  const entries = tasks
    .map(classifyProgressTask)
    .sort((a, b) => progressBucket(a) - progressBucket(b) || String(a.branch).localeCompare(String(b.branch)));

  const counts = Object.fromEntries(Object.values(PROGRESS_CLASS).map((key) => [key, 0]));
  for (const entry of entries) counts[entry.progressClass] += 1;

  const active = entries.filter((entry) => entry.progressClass !== PROGRESS_CLASS.NO_INTEGRATION_NEEDED);
  const next = active[0] || null;

  return {
    schemaVersion: 1,
    target: analysis.target || '',
    targetSha: analysis.targetSha || '',
    counts,
    next,
    entries,
    completionRule: 'Repeat: prepare blocked/review/reconcile TASKs -> READY -> integrate one -> rerun full Integration Guard. Never reuse a stale READY list after target changes.',
  };
}

export function printIntegrationProgressGuide(guide = {}) {
  const counts = guide.counts || {};
  console.log('Integration Progress Guide:');
  console.log(`  integrate now:          ${counts.INTEGRATE_NOW || 0}`);
  console.log(`  prepare for integration:${counts.PREPARE_FOR_INTEGRATION || 0}`);
  console.log(`  integration not needed: ${counts.NO_INTEGRATION_NEEDED || 0}`);

  if (guide.next) {
    console.log(`  next: [${guide.next.status}] ${guide.next.branch} -> ${guide.next.nextAction}`);
    console.log(`  why:  ${guide.next.reason}`);
  } else {
    console.log('  next: no active TASK requires integration work');
  }

  console.log('  rule: after every target change, rerun the full Integration Guard before choosing the next TASK.');
}
