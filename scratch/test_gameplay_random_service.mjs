import { GameplayRandomService } from '../game/src/core/gameplay_random_service.js';

console.log('=== GameplayRandomService deterministic stream ===');

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

const a = new GameplayRandomService(123456);
const b = new GameplayRandomService(123456);

assert(a.nextFloat() === b.nextFloat(), 'same run seed produces same gameplay stream');
assert(a.nextInt(1, 6) === b.nextInt(1, 6), 'integer draws are deterministic');

const arrA = ['a', 'b', 'c', 'd', 'e'];
const arrB = ['a', 'b', 'c', 'd', 'e'];
a.shuffle(arrA);
b.shuffle(arrB);
assert(JSON.stringify(arrA) === JSON.stringify(arrB), 'shuffle is deterministic');

const saved = a.getState();
const expectedNext = a.nextFloat();
const restored = new GameplayRandomService(999);
restored.setState(saved);
assert(restored.nextFloat() === expectedNext, 'saved gameplay RNG state resumes exactly');

const stateBeforeId = restored.getState();
const id1 = restored.nextId('card', 8);
const stateAfterId = restored.getState();
assert(id1 === 'card_8_1', 'deterministic ids use sequence instead of wall clock');
assert(stateAfterId.sequence === stateBeforeId.sequence + 1, 'id sequence is serialized state');

console.log(`GameplayRandomService: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
