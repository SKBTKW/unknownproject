import { TrialRestoreBoundaryService } from '../game/src/core/trial_restore_boundary_service.js';

console.log('=== Trial Restore Boundary Service ===');

let total = 0;
let passed = 0;
function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`  FAIL: ${message}`);
        process.exitCode = 1;
        return;
    }
    passed++;
    console.log(`  PASS: ${message}`);
}

const engine = { state: { turn: 12 } };
const service = new TrialRestoreBoundaryService(engine);

assert(service.resolveRestoreVerse(8) === 8, 'normal Restore resolves requested Verse');

const begun = service.begin();
assert(begun.active && begun.startVerse === 12, 'Trial boundary captures current Verse at entry');
assert(service.resolveRestoreVerse(15) === 12, 'active Trial redirects Restore to Trial-start Verse');

engine.state.turn = 20;
service.begin();
assert(service.getStartVerse() === 12, 're-entering Trial boundary does not move original start Verse');

const ended = service.end();
assert(ended.startVerse === 12, 'ending returns the closed Trial boundary');
assert(service.resolveRestoreVerse(15) === 15, 'after Trial exit Restore resolves requested Verse again');

console.log(`Trial Restore Boundary Service: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
