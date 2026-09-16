import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { TurnLifecycleService } from '../game/src/core/turn_lifecycle_service.js';
import { ChronicleSystem } from '../game/src/systems/chronicle_system.js';

console.log('=== History Snapshot boundary contract ===');

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

const rngState = { rng: { seed: 1234, state: 5678, cursor: 9 } };
const state = {
    turn: 4,
    ember: 20,
    food: 10,
    wood: 7,
    defense: 10,
    currentDefense: 10,
    maxDefense: 10,
    mystic: 2,
    hasPickedThisTurn: true,
    hasReservedThisTurn: true,
    hasMulliganedThisTurn: true,
    permanentPlainsFoodBonus: 0,
    grid: [],
    handOffering: [],
    reserveSlots: [null],
    cardCooldowns: {},
    consumedUniqueCards: [],
    mergedBlocks: {},
    mergeLinks: new Set(),
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
    trialSchedule: { trial1: 20, trial2: 35, trial3: 50 },
    nextTrialTurn: 20,
    activeGlobalEvents: [{ definitionId: 'TEST_EVENT', remainingTurns: 2, runtimeState: {} }],
    eventCooldowns: { TEST_EVENT: 3 },
    temporaryWeightModifiers: [],
    lastGlobalEventTurn: 3,
    processTurnEndMaintenance() { return { success: true }; },
    addLog() {}
};

const chronicleSystem = new ChronicleSystem(state);
const engine = {
    state,
    runSeed: 1234,
    chronicleSystem,
    checkSystem: { getState: () => rngState },
    buffSystem: { buffs: [{ id: 'TEST_BUFF', remainingTurns: 2 }] },
    previewTurnEndMaintenance: () => ({
        production: { grossFood: 0, foodCost: 0, totalWood: 0, totalMystic: 0 },
        automaticPlan: { canFullyCover: true },
        hypotheticalFallbackPlan: { canFullyCover: true }
    }),
    transactionManager: { clearHistory() {} },
    undoSystem: { clearSnapshot() {} },
    globalEventManager: { tickTurn() {}, onTurnStart() {} },
    deckManager: { generateOfferingCards() {} }
};

const lifecycle = new TurnLifecycleService(engine);
lifecycle.advance();

const snapshot = engine.historySnapshotService.getByCompletedTurn(4);
assert(snapshot !== null, 'captures a snapshot for the completed Verse');
assert(snapshot.completedTurn === 4 && snapshot.resumeTurn === 5, 'stores completed/resume Verse metadata');
assert(snapshot.gameState.turn === 4, 'captures game state before next Verse increment');
assert(snapshot.gameState.hasReservedThisTurn === true, 'captures reserved-action turn flag');
assert(snapshot.rngState.rng.seed === 1234, 'captures CheckSystem RNG state');
assert(snapshot.gameState.trialSchedule.trial1 === 20, 'captures Trial schedule in GameState');
assert(snapshot.gameState.nextTrialTurn === 20, 'captures next Trial turn in GameState');
assert(!Object.hasOwn(snapshot.runtime, 'trialSchedule'), 'runtime does not duplicate Trial schedule');
assert(!Object.hasOwn(snapshot.runtime, 'nextTrialTurn'), 'runtime does not duplicate next Trial turn');
assert(snapshot.runtime.activeGlobalEvents[0].remainingTurns === 2, 'captures active GlobalEvent runtime');
assert(snapshot.runtime.buffs[0].id === 'TEST_BUFF', 'captures BuffSystem runtime state');
assert(
    snapshot.chronicle.some(entry => entry.type === GAME_FACT_TYPES.VERSE_COMMITTED && entry.turn === 4),
    'captures Chronicle after VERSE_COMMITTED has been recorded'
);
assert(state.turn === 5, 'initializes next Verse only after snapshot capture');
assert(Object.isFrozen(snapshot), 'snapshot root is immutable');

state.activeGlobalEvents[0].remainingTurns = 99;
engine.buffSystem.buffs[0].remainingTurns = 99;
assert(snapshot.runtime.activeGlobalEvents[0].remainingTurns === 2, 'snapshot does not alias mutable event state');
assert(snapshot.runtime.buffs[0].remainingTurns === 2, 'snapshot does not alias mutable buff state');

console.log(`History Snapshot: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
