import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { WARNING_STATES } from '../game/src/warning/domain/warning_state.js';
import { WarningStateService } from '../game/src/warning/systems/warning_state_service.js';
import { WarningStateFactBridge } from '../game/src/warning/systems/warning_state_fact_bridge.js';

const hub = new GameFactHub();
const state = new WarningStateService();
const bridge = new WarningStateFactBridge({ gameFactHub: hub, warningStateService: state });

state.markOmen({ source: 'EVENT_DEMIHUMAN_TRACES', verse: 8 });
state.markWatch({ source: 'INVESTIGATION_RECORDED', verse: 9 });
state.markTense({ source: 'TRIAL_TIMING_TENSE', verse: 10 });
state.markImminent({ source: 'TRIAL_TIMING_IMMINENT', verse: 14 });
state.resetForNextTrial({ verse: 15 });

const facts = hub.getFacts().filter(fact => fact.type === GAME_FACT_TYPES.WARNING_STATE_CHANGED);
assert.equal(facts.length, 5);
assert.deepEqual(
    facts.map(fact => [fact.payload.previous, fact.payload.current]),
    [
        [WARNING_STATES.CALM, WARNING_STATES.OMEN],
        [WARNING_STATES.OMEN, WARNING_STATES.WATCH],
        [WARNING_STATES.WATCH, WARNING_STATES.TENSE],
        [WARNING_STATES.TENSE, WARNING_STATES.IMMINENT],
        [WARNING_STATES.IMMINENT, WARNING_STATES.CALM]
    ]
);
assert.equal('distance' in facts[2].payload, false, 'semantic Warning fact must not expose exact Trial distance');
assert.equal('remainingVerses' in facts[2].payload, false, 'semantic Warning fact must not expose countdown data');

bridge.dispose();
state.markOmen({ source: 'NEXT_TRIAL', verse: 16 });
assert.equal(
    hub.getFacts().filter(fact => fact.type === GAME_FACT_TYPES.WARNING_STATE_CHANGED).length,
    5,
    'disposing the bridge must stop fact publication'
);

console.log('warning state fact bridge: ok');
