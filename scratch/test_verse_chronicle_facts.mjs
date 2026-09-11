import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { TurnLifecycleService } from '../game/src/core/turn_lifecycle_service.js';
import { ChronicleSystem } from '../game/src/systems/chronicle_system.js';

console.log('=== Verse Chronicle Fact contract ===');

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
    turn: 4,
    food: 10,
    wood: 7,
    material: 7,
    mystic: 2,
    hasPickedThisTurn: true,
    hasReservedThisTurn: true,
    hasMulliganedThisTurn: true,
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
    trialSchedule: { trial1: 20, trial2: 35, trial3: 50 },
    nextTrialTurn: 20,
    processTurnEndMaintenance() {
        return { success: true };
    },
    addLog() {}
};

const chronicleSystem = new ChronicleSystem(state);
const engine = {
    state,
    chronicleSystem,
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

const facts = engine.gameFactHub.getFacts();
const entries = chronicleSystem.getAllEvents();

assert(facts.length === 1, 'emits exactly one fact for one committed Verse');
assert(facts[0].type === GAME_FACT_TYPES.VERSE_COMMITTED, 'fact type is VERSE_COMMITTED');
assert(facts[0].payload.completedTurn === 4, 'fact identifies the completed Verse before turn increment');
assert(facts[0].payload.nextTurn === 5, 'fact identifies the following Verse');
assert(state.turn === 5, 'next Verse initializes after the fact is committed');
assert(entries.length === 1, 'Chronicle derives exactly one entry from the fact');
assert(entries[0].turn === 4, 'Chronicle entry belongs to the completed Verse');
assert(entries[0].id === 'VERSE_COMMITTED_4', 'Chronicle entry uses deterministic Verse id');
assert(entries[0].meta.verse === 4 && entries[0].meta.nextVerse === 5, 'Chronicle keeps Verse boundary metadata');

engine.gameFactHub.emit(GAME_FACT_TYPES.VERSE_COMMITTED, { completedTurn: 4, nextTurn: 5 });
assert(chronicleSystem.getAllEvents().length === 1, 'duplicate Verse fact is idempotent in Chronicle');

chronicleSystem.destroy();

console.log(`Verse Chronicle Fact: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
