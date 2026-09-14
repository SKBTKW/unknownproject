import { attachInvestigationRuntime } from '../game/src/warning/index.js';
import { INVESTIGATION_CARDS_MASTER } from '../game/src/data/investigation_cards_data.js';

let sequence = 0;
let floatCalls = 0;
const state = {
    turn: 9,
    stage: 1,
    investigationUnlocked: false,
    hasPickedThisTurn: false,
    handOffering: [],
    reserveSlots: [null]
};

const baseMaster = [{ id: 'BASE_CARD', category: 'COMMAND', weight: 1 }];
const deckManager = {
    getLandCardMaster() { return baseMaster; }
};

const engine = {
    state,
    deckManager,
    gameplayRandom: {
        nextFloat() { floatCalls += 1; return 0; },
        nextId(prefix, scope) { sequence += 1; return `${prefix}_${scope}_${sequence}`; }
    },
    cardCycleSystem: {
        registered: [],
        registerOffering(cards, turn) {
            this.registered.push({ cards, turn });
        }
    }
};

const attached = attachInvestigationRuntime(engine, {
    observableProfileProvider: () => ({
        trialIndex: 1,
        threatRevision: 2,
        scaleBand: 'MEDIUM',
        directionHints: ['NORTH_ACTIVITY'],
        physiqueTraits: ['LARGE_BODY_PRESENT'],
        equipmentTraits: [],
        movementTraits: [],
        terrainTraits: []
    })
});

if (!attached.success) throw new Error('runtime bridge failed to attach');
if (engine.deckManager.getLandCardMaster().some(card => card.category === 'INVESTIGATION')) {
    throw new Error('investigation cards leaked before unlock');
}

state.investigationUnlocked = true;
const extended = engine.deckManager.getLandCardMaster();
if (!extended.some(card => card.id === 'INVESTIGATE_FOOTPRINTS')) throw new Error('investigation card missing after unlock');
if (!extended.some(card => card.id === 'BASE_CARD')) throw new Error('base cards were lost');

const card = INVESTIGATION_CARDS_MASTER[0];
const instance = { id: 'offering-1', cardMasterId: card.id, terrain: card };
state.handOffering = [instance];

const fake = { id: 'fake', cardMasterId: card.id, terrain: card };
const mismatch = engine.executeInvestigationCard(fake, { type: 'OFFERING', index: 0 });
if (mismatch.reason !== 'INVESTIGATION_SOURCE_MISMATCH') throw new Error('source mismatch was not rejected');
if (state.handOffering[0] !== instance) throw new Error('source mismatch consumed a real card');

const result = engine.executeInvestigationCard(instance, { type: 'OFFERING', index: 0 });
if (!result.success) throw new Error(`investigation execution failed: ${result.reason}`);
if (state.handOffering.length !== 0) throw new Error('played investigation card was not consumed');
if (!state.hasPickedThisTurn) throw new Error('investigation did not consume the Verse action');
if (state.knownEnemyState.reports.length !== 1) throw new Error('report was not recorded');
if (!state.knownEnemyState.observedTags.includes('NORTH_ACTIVITY')) throw new Error('known enemy state missing observed evidence');
if (engine.cardCycleSystem.registered.length !== 1) throw new Error('card cycle was not registered');
if (floatCalls < 1) throw new Error('gameplay RNG was not used');
if (result.report.id !== 'investigation_1:9_1') throw new Error('deterministic report ID was not supplied');

console.log('PASS investigation runtime bridge');
