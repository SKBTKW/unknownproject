import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  GUARD_ACTION,
  GUARD_STATUS,
  buildClusterOrders,
  buildClusterStrategies,
  buildFocusedReevaluationSets,
  buildIntegrationClusters,
  buildIntegrationOrder,
  buildOverlapGraph,
  buildReevaluationPlan,
  buildSessionId,
  buildTaskGuidance,
  explainIntegrationOrder,
  classifyObservedTask,
  discoverTaskNames,
  isAoTTarget,
  parseWorktreesPorcelain,
  targetFromTaskBranch,
} from './integration_guard_core.mjs';
import { runIntegrationGuard, assertRemoteSnapshotUnchanged } from './integration_guard.mjs';
import { verifyBundleRestorable } from './integration_guard_backup.mjs';

let passed = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}
async function rejects(fn, pattern, label) {
  await assert.rejects(fn, pattern, label);
  passed += 1;
  console.log(`  PASS: ${label}`);
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

check(isAoTTarget('AoT260917'), true, 'AoT target name accepted');
check(isAoTTarget('main'), false, 'non-AoT target rejected');
check(targetFromTaskBranch('aot-task/AoT260917/tooling/guard'), 'AoT260917', 'target extracted from TASK branch');
check(targetFromTaskBranch('TASK/foo'), '', 'legacy TASK name does not infer target');
check(discoverTaskNames(['refs/heads/aot-task/AoT260917/a/x', 'origin/aot-task/AoT260917/b/y', 'origin/main'], 'AoT260917'), ['aot-task/AoT260917/a/x', 'aot-task/AoT260917/b/y'], 'TASK refs normalize and dedupe');
const parsed = parseWorktreesPorcelain('worktree C:/repo\nHEAD abc\nbranch refs/heads/AoT260917\n\nworktree C:/task\nHEAD def\nbranch refs/heads/aot-task/AoT260917/x/y\nlocked\n\n');
check(parsed.length, 2, 'worktree parser finds entries');
check(parsed[1].locked, true, 'worktree parser preserves lock state');
check(classifyObservedTask({ relationshipKnown:false, mergePreviewStatus:'UNKNOWN' }), GUARD_STATUS.BLOCKED, 'unknown relationship fails closed');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:false, mergePreviewStatus:'CONFLICT' }), GUARD_STATUS.BLOCKED, 'confirmed conflict blocks');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:false, mergePreviewStatus:'CLEAN' }), GUARD_STATUS.RECONCILE_REQUIRED, 'target drift requires reconcile');
check(classifyObservedTask({ relationshipKnown:true, taskIsAncestor:true, targetIsAncestor:false, mergePreviewStatus:'UNKNOWN' }), GUARD_STATUS.MERGED, 'TASK already contained by target is merged');
check(classifyObservedTask({ relationshipKnown:true, targetIsAncestor:true, taskIsAncestor:false, mergePreviewStatus:'NOT_REQUIRED' }), GUARD_STATUS.READY, 'contained clean TASK is ready');
check(buildSessionId(new Date(2026, 8, 18, 22, 30, 40, 123)), '20260918-223040-123', 'session id is deterministic and millisecond precise');

check(buildTaskGuidance({ status: GUARD_STATUS.MERGED }), {
  action: GUARD_ACTION.NONE,
  reason: 'TASK HEAD is already contained in the target history.',
}, 'merged guidance requires no action');
check(buildTaskGuidance({ status: GUARD_STATUS.READY }), {
  action: GUARD_ACTION.INTEGRATE_ONE_AT_A_TIME,
  reason: 'TASK contains the latest target, merge preview is clean, and no review-grade overlap was observed.',
}, 'ready guidance preserves one-at-a-time integration');
check(buildTaskGuidance({
  status: GUARD_STATUS.REVIEW_REQUIRED,
  overlap: { risk: 'SHARED_SURFACE' },
  peerOverlaps: [],
}).action, GUARD_ACTION.REVIEW_OVERLAP, 'review guidance requires overlap review');
check(buildTaskGuidance({ status: GUARD_STATUS.RECONCILE_REQUIRED }).action, GUARD_ACTION.RECONCILE_TARGET, 'stale TASK guidance requires target reconciliation');
check(buildTaskGuidance({
  status: GUARD_STATUS.BLOCKED,
  localRemoteMismatch: true,
}).action, GUARD_ACTION.STOP_AND_INSPECT, 'blocked guidance stops for inspection');

check(buildIntegrationOrder([
  { branch: 'z-ready', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), peerOverlaps: [] },
  { branch: 'a-review', status: GUARD_STATUS.REVIEW_REQUIRED, guidance: buildTaskGuidance({ status: GUARD_STATUS.REVIEW_REQUIRED, overlap: { risk: 'PATH_OVERLAP' }, peerOverlaps: [] }), peerOverlaps: [] },
  { branch: 'm-merged', status: GUARD_STATUS.MERGED, guidance: buildTaskGuidance({ status: GUARD_STATUS.MERGED }), peerOverlaps: [] },
  { branch: 'b-blocked', status: GUARD_STATUS.BLOCKED, guidance: buildTaskGuidance({ status: GUARD_STATUS.BLOCKED }), peerOverlaps: [] },
]).map((entry) => entry.branch), ['z-ready', 'a-review', 'b-blocked'], 'integration order excludes merged and prioritizes ready');
check(buildIntegrationOrder([
  { branch: 'b-ready', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), peerOverlaps: [{ overlap: { risk: 'PATH_OVERLAP', risks: ['PATH_OVERLAP'] } }] },
  { branch: 'a-ready', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), peerOverlaps: [] },
]).map((entry) => entry.branch), ['a-ready', 'b-ready'], 'integration order prefers fewer review-grade peer overlaps within status');

check(buildIntegrationOrder([
  {
    branch: 'custom-guidance',
    status: GUARD_STATUS.READY,
    guidance: { action: 'CUSTOM_ACTION', reason: 'custom reason' },
    peerOverlaps: [],
  },
])[0], {
  branch: 'custom-guidance',
  status: GUARD_STATUS.READY,
  action: 'CUSTOM_ACTION',
  reason: 'custom reason',
  peerOverlapCount: 0,
  position: 1,
  provisional: true,
}, 'integration order preserves precomputed guidance after helper refactor');


const graphFixture = buildOverlapGraph([
  {
    branch: 'a',
    status: GUARD_STATUS.READY,
    guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }),
    peerOverlaps: [{ branch: 'b', overlap: { risk: 'PATH_OVERLAP', risks: ['PATH_OVERLAP'], evidence: ['x.js'] } }],
  },
  {
    branch: 'b',
    status: GUARD_STATUS.REVIEW_REQUIRED,
    guidance: buildTaskGuidance({ status: GUARD_STATUS.REVIEW_REQUIRED, overlap: { risk: 'PATH_OVERLAP' }, peerOverlaps: [] }),
    peerOverlaps: [{ branch: 'a', overlap: { risk: 'PATH_OVERLAP', risks: ['PATH_OVERLAP'], evidence: ['x.js'] } }],
  },
  {
    branch: 'merged',
    status: GUARD_STATUS.MERGED,
    guidance: buildTaskGuidance({ status: GUARD_STATUS.MERGED }),
    peerOverlaps: [],
  },
]);
check(graphFixture.summary, { nodeCount: 2, edgeCount: 1, reviewEdgeCount: 1 }, 'overlap graph dedupes symmetric edges and excludes merged');
check(graphFixture.edges[0].reviewRequired, true, 'overlap graph marks review-grade edge');
const explainedFixture = explainIntegrationOrder(
  buildIntegrationOrder([
    { branch: 'a', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), peerOverlaps: [{ branch: 'b', overlap: { risk: 'PATH_OVERLAP', risks: ['PATH_OVERLAP'] } }] },
    { branch: 'b', status: GUARD_STATUS.REVIEW_REQUIRED, guidance: buildTaskGuidance({ status: GUARD_STATUS.REVIEW_REQUIRED, overlap: { risk: 'PATH_OVERLAP' }, peerOverlaps: [] }), peerOverlaps: [{ branch: 'a', overlap: { risk: 'PATH_OVERLAP', risks: ['PATH_OVERLAP'] } }] },
  ]),
  graphFixture
);
check(explainedFixture[0].relatedBranches, ['b'], 'order explanation lists review-grade peers');
check(explainedFixture.every((entry) => entry.provisional === true), true, 'order explanations remain explicitly provisional');

const clusterFixture = buildIntegrationClusters({
  nodes: [
    { branch: 'a', status: GUARD_STATUS.READY },
    { branch: 'b', status: GUARD_STATUS.REVIEW_REQUIRED },
    { branch: 'c', status: GUARD_STATUS.READY },
    { branch: 'd', status: GUARD_STATUS.RECONCILE_REQUIRED },
  ],
  edges: [
    { from: 'a', to: 'b', reviewRequired: true },
    { from: 'b', to: 'c', reviewRequired: true },
    { from: 'c', to: 'd', reviewRequired: false },
  ],
});
check(clusterFixture.length, 2, 'cluster builder separates independent tasks from review-connected component');
check(clusterFixture[0], {
  id: 'cluster-1',
  type: 'REVIEW_CLUSTER',
  members: ['a', 'b', 'c'],
  reviewEdgeCount: 2,
  statuses: [GUARD_STATUS.READY, GUARD_STATUS.REVIEW_REQUIRED].sort(),
  provisional: true,
}, 'cluster builder groups transitive review overlap');
check(clusterFixture[1].type, 'INDEPENDENT', 'cluster builder marks isolated task independent');

const strategyFixture = buildClusterStrategies(clusterFixture, [
  { branch: 'a', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }) },
  { branch: 'b', status: GUARD_STATUS.REVIEW_REQUIRED, guidance: buildTaskGuidance({ status: GUARD_STATUS.REVIEW_REQUIRED, overlap: { risk: 'PATH_OVERLAP' }, peerOverlaps: [] }) },
  { branch: 'c', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }) },
  { branch: 'd', status: GUARD_STATUS.RECONCILE_REQUIRED, guidance: buildTaskGuidance({ status: GUARD_STATUS.RECONCILE_REQUIRED }) },
]);
check(strategyFixture[0].action, GUARD_ACTION.REVIEW_OVERLAP, 'review cluster strategy requires set-level review');
check(strategyFixture[1].action, GUARD_ACTION.RECONCILE_TARGET, 'independent stale TASK preserves task-level reconcile action');
check(strategyFixture.every((entry) => entry.provisional === true), true, 'cluster strategies remain explicitly provisional');
check(buildClusterStrategies([
  { id: 'cluster-x', type: 'REVIEW_CLUSTER', members: ['blocked', 'ready'] },
], [
  { branch: 'blocked', status: GUARD_STATUS.BLOCKED, guidance: buildTaskGuidance({ status: GUARD_STATUS.BLOCKED }) },
  { branch: 'ready', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }) },
])[0].action, GUARD_ACTION.STOP_AND_INSPECT, 'blocked member stops review-cluster strategy');

const localOrderFixture = buildClusterOrders([
  { id: 'cluster-1', type: 'REVIEW_CLUSTER', members: ['a', 'b', 'c'] },
], [
  { branch: 'a', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), taskFiles: ['1.js', '2.js'] },
  { branch: 'b', status: GUARD_STATUS.READY, guidance: buildTaskGuidance({ status: GUARD_STATUS.READY }), taskFiles: ['1.js'] },
  { branch: 'c', status: GUARD_STATUS.REVIEW_REQUIRED, guidance: buildTaskGuidance({ status: GUARD_STATUS.REVIEW_REQUIRED, overlap: { risk: 'PATH_OVERLAP' }, peerOverlaps: [] }), taskFiles: ['1.js'] },
], {
  edges: [
    { from: 'a', to: 'c', reviewRequired: true },
    { from: 'b', to: 'c', reviewRequired: true },
  ],
});
check(localOrderFixture[0].entries.map((entry) => entry.branch), ['b', 'a', 'c'], 'cluster-local order prefers safer status, fewer direct overlaps, then narrower file impact');
check(localOrderFixture[0].entries.every((entry) => entry.provisional === true), true, 'cluster-local entries remain provisional');
check(localOrderFixture[0].entries[0].rationale.includes('changed file'), true, 'cluster-local order records rationale');

const reevaluationFixture = buildReevaluationPlan([
  { id: 'cluster-1', type: 'REVIEW_CLUSTER', members: ['a', 'b', 'c'] },
  { id: 'cluster-2', type: 'INDEPENDENT', members: ['d'] },
], {
  nodes: [
    { branch: 'a' },
    { branch: 'b' },
    { branch: 'c' },
    { branch: 'd' },
  ],
  edges: [
    { from: 'a', to: 'b', reviewRequired: true },
    { from: 'b', to: 'c', reviewRequired: true },
  ],
});
check(reevaluationFixture.find((item) => item.afterBranch === 'a')?.reevaluateBranches, ['b', 'c'], 're-evaluation plan includes direct peer and same-cluster remainder');
check(reevaluationFixture.find((item) => item.afterBranch === 'b')?.directReviewPeers, ['a', 'c'], 're-evaluation plan records direct review peers');
check(reevaluationFixture.find((item) => item.afterBranch === 'd')?.reevaluateBranches, [], 'independent TASK has no predicted re-evaluation candidates');
check(reevaluationFixture.every((item) => item.provisional === true), true, 're-evaluation plan remains explicitly provisional');

const focusedFixture = buildFocusedReevaluationSets(reevaluationFixture, {
  nodes: [
    { branch: 'a' },
    { branch: 'b' },
    { branch: 'c' },
    { branch: 'd' },
  ],
});
check(focusedFixture.find((item) => item.afterBranch === 'a')?.primaryReinspection, ['b', 'c'], 'focused rerun set prioritizes predicted affected TASKs');
check(focusedFixture.find((item) => item.afterBranch === 'a')?.secondaryReinspection, ['d'], 'focused rerun set retains lower-priority remaining TASKs');
check(focusedFixture.find((item) => item.afterBranch === 'd')?.primaryReinspection, [], 'focused rerun set allows empty primary set');
check(focusedFixture.every((item) => item.fullGuardRerunRequired === true && item.provisional === true), true, 'focused rerun sets always require full Guard rerun');









const stableSnapshot = { targetSha: 'a', tasks: { one: 'b' } };
assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'a', tasks: { one: 'b' } }, 'test');
passed += 1;
console.log('  PASS: identical remote snapshots accepted');
await rejects(async () => assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'c', tasks: { one: 'b' } }, 'test'), /Remote refs changed/, 'remote target drift blocks');
await rejects(async () => assertRemoteSnapshotUnchanged(stableSnapshot, { targetSha: 'a', tasks: { one: 'c' } }, 'test'), /Remote refs changed/, 'remote TASK drift blocks');
const fullInspectionSource = fs.readFileSync(path.join(process.cwd(), 'scratch', 'run_full_inspection.mjs'), 'utf8');
check(fullInspectionSource.includes('scratch/test_integration_guard.mjs'), true, 'Full Inspection invokes Integration Guard contract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-integration-guard-test-'));
const origin = path.join(root, 'origin.git');
const repo = path.join(root, 'unknownproject');
const backupRoot = path.join(root, 'backups');
const target = 'AoT260917';
const taskA = 'aot-task/AoT260917/tooling/guard-a';
const taskB = 'aot-task/AoT260917/tooling/guard-b';
const taskMerged = 'aot-task/AoT260917/tooling/guard-merged';
try {
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'init', '-q', repo);
  git(repo, 'config', 'user.email', 'aot@example.invalid');
  git(repo, 'config', 'user.name', 'AoT Integration Guard Test');
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'base\n');
  fs.writeFileSync(path.join(repo, 'base.txt'), 'base\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'branch', '-M', target);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '-u', 'origin', target);
  const baseSha = git(repo, 'rev-parse', 'HEAD');

  git(repo, 'checkout', '-q', '-b', taskA, baseSha);
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'task-a\n');
  git(repo, 'commit', '-q', '-am', 'task a');
  git(repo, 'push', '-q', '-u', 'origin', taskA);

  git(repo, 'checkout', '-q', '-b', taskB, baseSha);
  fs.writeFileSync(path.join(repo, 'AGENTS.md'), 'task-b\n');
  git(repo, 'commit', '-q', '-am', 'task b');
  git(repo, 'push', '-q', '-u', 'origin', taskB);

  git(repo, 'checkout', '-q', target);
  fs.writeFileSync(path.join(repo, 'target.txt'), 'target advanced\n');
  git(repo, 'add', 'target.txt');
  git(repo, 'commit', '-q', '-m', 'target advanced');
  git(repo, 'push', '-q', 'origin', target);
  const targetSha = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'branch', taskMerged, targetSha);
  git(repo, 'push', '-q', '-u', 'origin', taskMerged);
  const beforeHead = git(repo, 'rev-parse', 'HEAD');
  const beforeStatus = git(repo, 'status', '--porcelain', '--untracked-files=all');

  const now = new Date(2026, 8, 18, 23, 0, 0, 0);
  const result = await runIntegrationGuard({ cwd: repo, target, backupRoot, now });
  check(result.analysis.targetSha, targetSha, 'E2E analysis pins current target SHA');
  check(result.analysis.backupVerified, true, 'E2E backup is verified before analysis result');
  check(result.analysis.schemaVersion, 9, 'E2E analysis uses focused-rerun schema version');
  check(result.analysis.tasks.length, 3, 'E2E discovers stale and merged TASK branches');
  check(result.analysis.summary.MERGED, 1, 'E2E classifies target-contained TASK as merged');
  check(result.analysis.summary.RECONCILE_REQUIRED, 2, 'E2E marks both stale TASKs for reconciliation');
  const mergedTask = result.analysis.tasks.find((task) => task.branch === taskMerged);
  check(mergedTask?.taskIsAncestor, true, 'E2E records merged ancestry direction');
  check(mergedTask?.peerOverlaps, [], 'E2E excludes merged TASK from peer-overlap warnings');
  check(mergedTask?.guidance?.action, GUARD_ACTION.NONE, 'E2E merged TASK guidance is no action');
  check(result.analysis.tasks.filter((task) => task.status !== GUARD_STATUS.MERGED).every((task) => task.peerOverlaps.some((peer) => peer.overlap.risk === 'SHARED_SURFACE')), true, 'E2E still detects overlap between active stale TASKs');
  check(result.analysis.tasks.filter((task) => task.status === GUARD_STATUS.RECONCILE_REQUIRED).every((task) => task.guidance?.action === GUARD_ACTION.RECONCILE_TARGET), true, 'E2E stale TASKs receive reconciliation guidance');
  check(result.analysis.integrationOrder.some((entry) => entry.branch === taskMerged), false, 'E2E integration order excludes merged TASK');
  check(result.analysis.integrationOrder.every((entry, index) => entry.position === index + 1 && entry.provisional === true), true, 'E2E integration order is explicitly provisional and positioned');
  check(result.analysis.overlapGraph.summary.reviewEdgeCount > 0, true, 'E2E overlap graph records review-grade peer edges');
  check(result.analysis.orderExplanations.length, result.analysis.integrationOrder.length, 'E2E explains every provisional order entry');
  check(result.analysis.integrationClusters.some((cluster) => cluster.type === 'REVIEW_CLUSTER'), true, 'E2E groups review-connected TASKs into a cluster');
  check(result.analysis.integrationClusters.every((cluster) => cluster.provisional === true), true, 'E2E integration groups are explicitly provisional');
  check(result.analysis.clusterStrategies.length, result.analysis.integrationClusters.length, 'E2E provides one strategy per integration cluster');
  check(result.analysis.clusterStrategies.every((strategy) => strategy.provisional === true), true, 'E2E cluster strategies are explicitly provisional');
  check(result.analysis.clusterOrders.length, result.analysis.integrationClusters.length, 'E2E provides one local order per cluster');
  check(result.analysis.clusterOrders.every((group) => group.provisional === true && group.entries.every((entry) => entry.provisional === true)), true, 'E2E cluster-local orders are explicitly provisional');
  check(result.analysis.reevaluationPlan.length, result.analysis.overlapGraph.nodes.length, 'E2E provides re-evaluation prediction for every active TASK');
  check(result.analysis.reevaluationPlan.every((item) => item.provisional === true), true, 'E2E re-evaluation predictions are explicitly provisional');
  check(result.analysis.focusedReevaluationSets.length, result.analysis.reevaluationPlan.length, 'E2E provides one focused rerun set per re-evaluation prediction');
  check(result.analysis.focusedReevaluationSets.every((item) => item.fullGuardRerunRequired === true && item.provisional === true), true, 'E2E focused rerun sets preserve full-rerun safety contract');
  check(fs.existsSync(result.backup.bundlePath), true, 'E2E writes bundle outside repository');
  check(fs.existsSync(result.backup.manifestPath), true, 'E2E writes backup manifest');
  check(fs.existsSync(path.join(result.backup.sessionDir, 'SHA256SUM.txt')), true, 'E2E writes bundle checksum');
  check(fs.existsSync(path.join(result.backup.sessionDir, 'integration-analysis.json')), true, 'E2E persists analysis beside backup');
  const manifest = JSON.parse(fs.readFileSync(result.backup.manifestPath, 'utf8'));
  check(manifest.bundle.verified, true, 'manifest records verified backup');
  check(manifest.bundle.restoreVerified, true, 'manifest records restore verification');
  check(manifest.targetSha, targetSha, 'manifest records exact target SHA');
  const lockPath = path.join(repo, '.git', 'aot-integration-guard.lock');
  check(fs.existsSync(lockPath), false, 'session lock is released after success');
  check(git(repo, 'rev-parse', 'HEAD'), beforeHead, 'Guard does not move HEAD');
  check(git(repo, 'status', '--porcelain', '--untracked-files=all'), beforeStatus, 'Guard leaves worktree unchanged');
  check(path.relative(repo, result.backup.sessionDir).startsWith('..'), true, 'backup is outside repository');
  check(result.backup.bundleSha256.length, 64, 'backup checksum is SHA-256 length');
  check(verifyBundleRestorable(result.backup.bundlePath, [targetSha]), true, 'bundle can be mirror-cloned and target commit restored');

  const corruptBundle = path.join(root, 'corrupt.bundle');
  fs.copyFileSync(result.backup.bundlePath, corruptBundle);
  const corruptBytes = fs.readFileSync(corruptBundle);
  fs.writeFileSync(corruptBundle, corruptBytes.subarray(0, Math.max(32, Math.floor(corruptBytes.length / 3))));
  await rejects(async () => verifyBundleRestorable(corruptBundle, [targetSha]), /Command failed|fatal|error/i, 'corrupt bundle fails restore verification');

  fs.writeFileSync(path.join(repo, 'dirty.tmp'), 'dirty\n');
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 1, 0) }), /dirty worktree/, 'dirty worktree blocks preflight');
  fs.unlinkSync(path.join(repo, 'dirty.tmp'));

  fs.writeFileSync(lockPath, '{not-json');
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 2, 0) }), /lock is unreadable/, 'unreadable lock blocks');
  check(fs.existsSync(lockPath), true, 'unreadable lock is preserved for inspection');
  fs.unlinkSync(lockPath);

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, sessionId: 'live', target }));
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 3, 0) }), /already active/, 'live lock blocks double start');
  fs.unlinkSync(lockPath);

  fs.writeFileSync(lockPath, JSON.stringify({ pid: 2147483647, sessionId: 'dead', target }));
  const recovered = await runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 4, 0) });
  check(recovered.analysis.backupVerified, true, 'valid dead lock is recoverable');
  const staleLocks = fs.readdirSync(path.join(repo, '.git')).filter((name) => name.startsWith('aot-integration-guard.lock.stale-'));
  check(staleLocks.length > 0, true, 'dead lock is archived rather than discarded');

  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot: path.join(repo, 'backups'), now: new Date(2026, 8, 18, 23, 0, 5, 0) }), /Backup root must be outside/, 'backup root inside repository blocks');

  const movedOrigin = `${origin}.offline`;
  fs.renameSync(origin, movedOrigin);
  await rejects(() => runIntegrationGuard({ cwd: repo, target, backupRoot, now: new Date(2026, 8, 18, 23, 0, 6, 0) }), /git fetch|failed/i, 'remote observation failure blocks');
  fs.renameSync(movedOrigin, origin);

  check(fs.existsSync(lockPath), false, 'lock is released after blocked remote run');
  check(git(repo, 'rev-parse', 'HEAD'), beforeHead, 'blocked runs still do not move HEAD');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`Integration Guard V1.10: ${passed} checks PASS`);
