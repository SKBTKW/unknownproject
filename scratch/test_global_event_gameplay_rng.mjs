import { GameplayRandomService } from '../game/src/core/gameplay_random_service.js';
import { GlobalEventDirector, GlobalEventSelector, GlobalEventManager } from '../game/src/systems/global_event_system.js';

console.log('=== GlobalEvent gameplay RNG routing ===');

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

const state = {
    turn: 10,
    lastGlobalEventTurn: 4,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: []
};

const rngA = new GameplayRandomService(424242);
const rngB = new GameplayRandomService(424242);
const directorA = new GlobalEventDirector(rngA);
const directorB = new GlobalEventDirector(rngB);
assert(
    directorA.shouldTriggerEvent(state) === directorB.shouldTriggerEvent(state),
    'trigger roll is deterministic for equal gameplay streams'
);

const defs = [
    { id: 'A', baseWeight: 1, conditions: [] },
    { id: 'B', baseWeight: 3, conditions: [] }
];
const selectorA = new GlobalEventSelector(rngA);
const selectorB = new GlobalEventSelector(rngB);
assert(
    selectorA.selectEvent(state, defs)?.id === selectorB.selectEvent(state, defs)?.id,
    'weighted selection is deterministic for equal gameplay streams'
);

const engineA = { runSeed: 777 };
const engineB = { runSeed: 777 };
new GlobalEventManager({ ...state, activeGlobalEvents: [], eventCooldowns: {}, temporaryWeightModifiers: [] }, engineA);
new GlobalEventManager({ ...state, activeGlobalEvents: [], eventCooldowns: {}, temporaryWeightModifiers: [] }, engineB);
assert(!!engineA.gameplayRandom && !!engineB.gameplayRandom, 'manager attaches gameplay RNG to engine when missing');
assert(
    engineA.gameplayRandom.nextFloat() === engineB.gameplayRandom.nextFloat(),
    'manager-owned fallback stream is seeded from runSeed'
);

console.log(`GlobalEvent Gameplay RNG Routing: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
