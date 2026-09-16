import { GameplayRandomService } from '../game/src/core/gameplay_random_service.js';
import { GameState } from '../game/src/v2_unity_ready_main.js';
import { GridEngine } from '../game/src/systems/grid_engine.js';

console.log('=== GameState / Grid Gameplay RNG Routing ===');

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

function socketCoords(grid) {
    const result = [];
    for (const row of grid || []) {
        for (const cell of row || []) {
            if (cell?.hasSocket) result.push(`${cell.r}:${cell.c}`);
        }
    }
    return result.sort();
}

function createState(seed) {
    const engine = { gameplayRandom: new GameplayRandomService(seed) };
    return new GameState({ engine });
}

const stateA = createState(4242);
const stateB = createState(4242);

assert(
    JSON.stringify(stateA.trialSchedule) === JSON.stringify(stateB.trialSchedule),
    'same run seed reproduces Trial schedule'
);
assert(
    JSON.stringify(socketCoords(stateA.grid)) === JSON.stringify(socketCoords(stateB.grid)),
    'same run seed reproduces fallback GameState initial sockets'
);

const gridStateA = { grid: null, stage: { id: 1, size: 5 }, defenseSystem: null };
const gridStateB = { grid: null, stage: { id: 1, size: 5 }, defenseSystem: null };
const gridA = new GridEngine(gridStateA, { gameplayRandom: new GameplayRandomService(999) });
const gridB = new GridEngine(gridStateB, { gameplayRandom: new GameplayRandomService(999) });
gridStateA.grid = gridA.initGrid(5);
gridStateB.grid = gridB.initGrid(5);

assert(
    JSON.stringify(socketCoords(gridStateA.grid)) === JSON.stringify(socketCoords(gridStateB.grid)),
    'same gameplay stream reproduces GridEngine initial sockets'
);

gridA.expandGrid(7);
gridB.expandGrid(7);
assert(
    JSON.stringify(socketCoords(gridStateA.grid)) === JSON.stringify(socketCoords(gridStateB.grid)),
    'same gameplay stream reproduces expansion sockets'
);

console.log(`GameState/Grid Gameplay RNG Routing: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
