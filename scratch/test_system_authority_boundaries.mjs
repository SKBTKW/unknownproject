import assert from 'node:assert';
import { auditSystemAuthorityBoundaries } from './audit_system_authority_boundaries.mjs';

// ==============================================================================
// 🧪 Test: System Authority Boundary Static Auditing Contract
// ==============================================================================

console.log('Testing System Authority Boundaries audit...');

// 1. Audit current codebase - must have 0 violations
const violations = auditSystemAuthorityBoundaries();
if (violations.length > 0) {
    console.error('Expected 0 violations across repository, but found:');
    for (const v of violations) {
        console.error(`  - [${v.rule}] ${v.file}:${v.line} -> ${v.code}`);
    }
}
assert.strictEqual(violations.length, 0, `Expected 0 violations in repo, found ${violations.length}`);
console.log('✅ Base repository authority boundary audit passed: 0 violations.');

// 2. Verify audit function exported and callable
assert.strictEqual(typeof auditSystemAuthorityBoundaries, 'function');

console.log('All system authority boundaries tests passed.');
