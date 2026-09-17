import assert from 'node:assert/strict';
import {
    assessTaskHealth,
    buildTaskFileRanges,
    classifyOverlap,
    INTEGRATION_STATE,
    OVERLAP_RISK,
    REMOTE_FRESHNESS,
    TASK_HEALTH,
} from './task_health.mjs';

let passed = 0;
function check(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
    passed += 1;
    console.log(`  PASS: ${label}`);
}

const noOverlap = classifyOverlap(
    ['game/src/presentation/web25d_canvas_renderer.js'],
    ['game/src/trial/domain/trial_state.js'],
);
const freshDrift = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: noOverlap,
});
check(noOverlap.risk, OVERLAP_RISK.NONE, 'different domains have no observed overlap');
check(freshDrift.health, TASK_HEALTH.TARGET_DRIFT, 'fresh target drift is reported');
check(freshDrift.action, 'CONTINUE', 'fresh target drift continues normal work');

const sameDomain = classifyOverlap(['game/src/trial/runtime/runtime_bridge.js'], ['game/src/trial/domain/trial_state.js']);
check(sameDomain.risk, OVERLAP_RISK.DOMAIN_OVERLAP, 'same source domain is classified');
check(assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: sameDomain,
}).action, 'CONTINUE', 'domain overlap remains workable');

const sharedPath = classifyOverlap(['AGENTS.md'], ['AGENTS.md']);
check(sharedPath.risk, OVERLAP_RISK.SHARED_SURFACE, 'shared surface is primary risk');
check(sharedPath.risks.includes(OVERLAP_RISK.PATH_OVERLAP), true, 'shared surface retains path overlap evidence');

const reconciled = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: false,
    targetIsAncestor: true,
});
check(reconciled.health, TASK_HEALTH.HEALTHY, 'reconciled task is no longer TARGET_DRIFT');
check(reconciled.action, 'CONTINUE', 'reconciled task does not request another reconciliation');

const staleIntegration = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    integrationReady: true,
});
check(staleIntegration.integrationState, INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE, 'stale task waits at integration gate');

const readyIntegration = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: false,
    targetIsAncestor: true,
    integrationReady: true,
});
check(readyIntegration.integrationState, INTEGRATION_STATE.READY, 'reconciled task is ready at integration gate');

check(assessTaskHealth({ remoteTaskIsAncestor: false }).action, 'STOP', 'remote TASK drift stops only that task');
check(assessTaskHealth({ baseIsTargetAncestor: false }).reason.startsWith('BASE_REWRITE'), true, 'base rewrite stops the task');

const normalFetchFailure = assessTaskHealth({ remoteFreshness: REMOTE_FRESHNESS.UNKNOWN });
check(normalFetchFailure.health, TASK_HEALTH.TARGET_STATE_STALE, 'normal observation marks stale remote state');
check(normalFetchFailure.action, 'CONTINUE_WITH_WARNING', 'normal observation fetch failure remains available');

const integrationFetchFailure = assessTaskHealth({
    remoteFreshness: REMOTE_FRESHNESS.UNKNOWN,
    integrationReady: true,
});
check(integrationFetchFailure.health, TASK_HEALTH.BLOCKED, 'integration fetch failure blocks');
check(integrationFetchFailure.action, 'BLOCK', 'integration fetch failure has a blocking action');

const ranges = buildTaskFileRanges({ mergeBase: 'B', targetRef: 'origin/AoT260917', head: 'HEAD' });
check(ranges.targetOnlyRange, 'B..origin/AoT260917', 'target-only range begins at latest merge-base');
check(ranges.taskOwnedRange, 'B..HEAD', 'task-owned range excludes target history after reconciliation');

console.log(`Task health contract: ${passed}/19 PASS`);
