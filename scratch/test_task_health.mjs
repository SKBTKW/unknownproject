import assert from 'node:assert/strict';
import { assessTaskHealth, classifyOverlap, INTEGRATION_STATE, OVERLAP_RISK, TASK_HEALTH } from './task_health.mjs';

let passed = 0;
function check(actual, expected, label) {
    assert.deepEqual(actual, expected, label);
    passed += 1;
    console.log(`  PASS: ${label}`);
}

const differentDomain = classifyOverlap(['game/src/presentation/web25d_canvas_renderer.js'], ['game/src/trial/domain/trial_state.js']);
check(differentDomain.risk, OVERLAP_RISK.NONE, 'different domain target drift has no overlap');
check(assessTaskHealth({ targetAdvanced: true, overlap: differentDomain }).health, TASK_HEALTH.TARGET_DRIFT, 'TARGET_DRIFT continues normal work');
check(assessTaskHealth({ targetAdvanced: true, overlap: differentDomain }).action, 'CONTINUE', 'TARGET_DRIFT is not a stop condition');

const sameDomain = classifyOverlap(['game/src/trial/runtime/runtime_bridge.js'], ['game/src/trial/domain/trial_state.js']);
check(sameDomain.risk, OVERLAP_RISK.DOMAIN_OVERLAP, 'same source domain is classified');
check(assessTaskHealth({ targetAdvanced: true, overlap: sameDomain }).action, 'CONTINUE', 'domain overlap remains workable');

const shared = classifyOverlap(['AGENTS.md'], ['game/src/trial/domain/trial_state.js']);
check(shared.risk, OVERLAP_RISK.SHARED_SURFACE, 'shared surface is classified');
check(assessTaskHealth({ targetAdvanced: true, overlap: shared }).health, TASK_HEALTH.TARGET_DRIFT, 'shared surface does not globally block work');

const contract = { risk: OVERLAP_RISK.CONTRACT_OVERLAP, evidence: ['service'] };
check(assessTaskHealth({ targetAdvanced: true, overlap: contract }).health, TASK_HEALTH.RECONCILE_RECOMMENDED, 'contract overlap recommends reconciliation');

check(assessTaskHealth({ remoteTaskIsAncestor: false }).action, 'STOP', 'remote TASK drift stops only that task');
check(assessTaskHealth({ baseIsTargetAncestor: false }).reason.startsWith('BASE_REWRITE'), true, 'base rewrite stops the task');
check(assessTaskHealth({ targetAdvanced: true, targetIsAncestor: false, integrationReady: true }).integrationState,
    INTEGRATION_STATE.WAITING_FOR_BASE_UPDATE, 'integration gate waits for a stale task to update its base');
check(assessTaskHealth({ targetAdvanced: false, targetIsAncestor: true, integrationReady: true }).health,
    TASK_HEALTH.HEALTHY, 'current clean relationship is healthy for integration review');

console.log(`Task health contract: ${passed}/12 PASS`);
