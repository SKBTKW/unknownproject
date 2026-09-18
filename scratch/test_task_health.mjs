import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { MERGE_PREVIEW_STATUS } from './task_merge_preview.mjs';
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

const cleanPreview = {
    status: MERGE_PREVIEW_STATUS.CLEAN,
    conflictPaths: [],
    reason: '',
};
const conflictPreview = {
    status: MERGE_PREVIEW_STATUS.CONFLICT,
    conflictPaths: ['game/src/core/game_engine.js'],
    reason: 'conflict',
};

const noOverlap = classifyOverlap(
    ['game/src/presentation/web25d_canvas_renderer.js'],
    ['game/src/trial/domain/trial_state.js'],
);
const freshDrift = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: noOverlap,
    mergePreview: cleanPreview,
});
check(noOverlap.risk, OVERLAP_RISK.NONE, 'different domains have no observed overlap');
check(freshDrift.health, TASK_HEALTH.TARGET_DRIFT, 'clean target drift is reported');
check(freshDrift.action, 'CONTINUE', 'clean target drift continues normal work');

const sameDomain = classifyOverlap(['game/src/trial/runtime/runtime_bridge.js'], ['game/src/trial/domain/trial_state.js']);
check(sameDomain.risk, OVERLAP_RISK.DOMAIN_OVERLAP, 'same source domain is classified');
const sameDomainAssessment = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: sameDomain,
    mergePreview: cleanPreview,
});
check(sameDomainAssessment.health, TASK_HEALTH.OVERLAP_DETECTED, 'clean overlap is distinguished from plain drift');
check(sameDomainAssessment.action, 'CONTINUE', 'clean overlap remains workable');

const sharedPath = classifyOverlap(['AGENTS.md'], ['AGENTS.md']);
check(sharedPath.risk, OVERLAP_RISK.SHARED_SURFACE, 'shared surface is primary risk when both sides touch it');
check(sharedPath.risks.includes(OVERLAP_RISK.PATH_OVERLAP), true, 'shared surface retains path overlap evidence');
const targetOnlyShared = classifyOverlap(['AGENTS.md'], ['scratch/test_task_health.mjs']);
check(targetOnlyShared.risk, OVERLAP_RISK.NONE, 'target-only shared file does not create false shared overlap');

const genericServices = classifyOverlap(
    ['game/src/trial/runtime/trial_launch_service.js'],
    ['game/src/advisor/advisor_service.js'],
);
check(genericServices.risk, OVERLAP_RISK.NONE, 'generic service filename does not imply contract overlap');
const explicitContract = classifyOverlap(['scratch/task_branch_contract.mjs'], ['scratch/task_branch_contract.mjs']);
check(explicitContract.risk, OVERLAP_RISK.CONTRACT_OVERLAP, 'explicit same-path contract surface is classified');
const contractAssessment = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: explicitContract,
    mergePreview: cleanPreview,
});
check(contractAssessment.health, TASK_HEALTH.RECONCILE_RECOMMENDED, 'clean contract overlap still recommends reconciliation review');

const normalConflict = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    overlap: sharedPath,
    mergePreview: conflictPreview,
});
check(normalConflict.health, TASK_HEALTH.RECONCILE_RECOMMENDED, 'confirmed conflict recommends reconciliation during normal work');
check(normalConflict.integrationState, INTEGRATION_STATE.WORKING, 'confirmed conflict does not globally stop unfinished work');
check(normalConflict.action, 'CONTINUE_WITH_RECONCILIATION_PLAN', 'confirmed conflict remains workable before integration');

const integrationConflict = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    integrationReady: true,
    overlap: sharedPath,
    mergePreview: conflictPreview,
});
check(integrationConflict.integrationState, INTEGRATION_STATE.CONFLICT, 'confirmed conflict blocks integration as CONFLICT');
check(integrationConflict.action, 'BLOCK', 'confirmed conflict is fail-closed at integration gate');

const unknownPreview = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    mergePreview: { status: MERGE_PREVIEW_STATUS.UNKNOWN, conflictPaths: [], reason: 'unsupported git' },
});
check(unknownPreview.health, TASK_HEALTH.RECONCILE_RECOMMENDED, 'unknown preview is visible during normal work');
check(unknownPreview.action, 'CONTINUE_WITH_WARNING', 'unknown preview warns without stopping normal work');
const unknownIntegration = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: true,
    targetIsAncestor: false,
    integrationReady: true,
    mergePreview: { status: MERGE_PREVIEW_STATUS.UNKNOWN, conflictPaths: [], reason: 'unsupported git' },
});
check(unknownIntegration.health, TASK_HEALTH.BLOCKED, 'unknown preview blocks integration');
check(unknownIntegration.action, 'BLOCK', 'unknown preview is fail-closed at integration gate');

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
    mergePreview: cleanPreview,
});
check(staleIntegration.integrationState, INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE, 'clean stale task waits at integration gate');
check(staleIntegration.action, 'BLOCK', 'clean stale task still cannot integrate before reconciliation');

const readyIntegration = assessTaskHealth({
    targetHasAdvancedSinceRecordedBase: true,
    needsReconciliationNow: false,
    targetIsAncestor: true,
    integrationReady: true,
});
check(readyIntegration.integrationState, INTEGRATION_STATE.READY, 'reconciled task is ready at integration gate');
check(readyIntegration.action, 'READY_FOR_INTEGRATION', 'ready task reports integration action');

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

const ranges = buildTaskFileRanges({ mergeBase: 'B', targetRef: 'origin/AoT260917', head: 'HEADSHA' });
check(ranges.targetOnlyRange, 'B..origin/AoT260917', 'target-only range begins at latest merge-base');
check(ranges.taskOwnedRange, 'B..HEADSHA', 'task-owned range excludes target history after reconciliation');

console.log(`Task health contract: ${passed} PASS`);

const here = path.dirname(fileURLToPath(import.meta.url));
for (const script of ['test_task_merge_preview.mjs', 'test_task_health_git_integration.mjs']) {
    execFileSync(process.execPath, [path.join(here, script)], {
        cwd: here,
        stdio: 'inherit',
        windowsHide: true,
    });
}
