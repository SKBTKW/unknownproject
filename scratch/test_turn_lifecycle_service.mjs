import { TurnLifecycleService } from '../game/src/core/turn_lifecycle_service.js';

console.log('=== TurnLifecycleService regression contract ===');

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

const calls = [];
const state = {
    turn: 4,
    food: 10,
    wood: 7,
    material: 7,
    mystic: 2,
    hasPickedThisTurn: true,
    hasMulliganedThisTurn: true,
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
    trialSchedule: { trial1: 5, trial2: 30, trial3: 50 },
    nextTrialTurn: 5,
    processTurnEndMaintenance(input) {
        calls.push('maintenance');
        this.food -= input.production.foodCost;
        return { success: true, fallbackPlan: input.fallbackPlan };
    },
    addLog(message) {
        calls.push(`log:${message}`);
    }
};

const engine = {
    state,
    i18n: {
        t(key, params = {}) {
            if (key === 'LOG_STAGE_EXPAND') return `stage:${params.stage}:${params.size}`;
            if (key === 'LOG_TURN_START') return `turn:${params.turn}`;
            return key;
        }
    },
    transactionManager: { clearHistory: () => calls.push('transaction.clear') },
    undoSystem: { clearSnapshot: () => calls.push('undo.clear') },
    previewTurnEndMaintenance: () => ({
        production: { grossFood: 8, foodCost: 3, totalWood: 4, totalMystic: 1 },
        automaticPlan: { id: 'AUTO' },
        hypotheticalFallbackPlan: { id: 'HYPOTHETICAL', canFullyCover: true }
    }),
    globalEventManager: {
        tickTurn: () => calls.push('global.tick'),
        onTurnStart: () => calls.push('global.start')
    },
    deckManager: {
        onNextTurn() {
            calls.push('deck.next');
            state.turn++;
            state.hasPickedThisTurn = false;
            state.hasMulliganedThisTurn = false;
        }
    },
    gridEngine: {
        expandGrid: size => calls.push(`grid.expand:${size}`)
    }
};

const lifecycle = new TurnLifecycleService(engine);
const result = lifecycle.advance();

assert(result === 5, 'returns the advanced turn');
assert(state.turn === 5, 'keeps turn increment delegated to DeckManager during R2');
assert(state.food === 15, 'applies gross production before maintenance');
assert(state.wood === 11 && state.material === 11, 'keeps wood/material alias synchronized');
assert(state.mystic === 3, 'applies mystic production');
assert(state.stage.id === 2 && state.nextTrialTurn === 30, 'runs stage transition after advancing the turn');
assert(
    calls.indexOf('global.tick') < calls.indexOf('deck.next')
        && calls.indexOf('deck.next') < calls.indexOf('global.start'),
    'preserves global-event tick -> turn advance -> turn-start order'
);
assert(
    calls.indexOf('global.start') < calls.indexOf('grid.expand:7'),
    'preserves turn-start event evaluation before stage expansion'
);

console.log(`TurnLifecycleService: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
