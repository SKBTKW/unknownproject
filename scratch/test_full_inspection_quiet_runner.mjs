import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
    isPathInside,
    parseInspectionMetrics,
    resolveExternalLogRoot,
} from './run_full_inspection_quiet.mjs';

const sample = `
Executed: 0; PASS: 0; non-PASS: 0; not run: 312.
UI検問結果: 188 PASS / 0 FAIL
Executed: 108; PASS: 108; non-PASS: 0; not run: 203.
Stage1 E2E audit checks: 131 PASS / 0 FAIL
FirstRun Stage1 completion certification: PASS=24 FAIL=0
`;

assert.deepEqual(parseInspectionMetrics(sample), {
    supplemental: { executed: 108, passed: 108, failed: 0 },
    uiLifecycle: { passed: 188, failed: 0 },
    stage1E2E: { passed: 131, failed: 0 },
    firstRun: { passed: 24, failed: 0 },
});

const repo = path.resolve('C:/repo');
assert.equal(isPathInside(repo, path.join(repo, 'scratch', 'logs')), true);
assert.equal(isPathInside(repo, path.join(tmpdir(), 'aot-logs')), false);
assert.throws(
    () => resolveExternalLogRoot(repo, path.join(repo, 'inspection-logs')),
    /INSPECTION_LOG_ROOT_MUST_BE_OUTSIDE_REPOSITORY/
);
assert.equal(resolveExternalLogRoot(repo, path.join(tmpdir(), 'aot-logs')), path.resolve(tmpdir(), 'aot-logs'));

console.log('Full Inspection quiet runner contract: PASS');
