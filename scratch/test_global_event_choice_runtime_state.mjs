import assert from 'node:assert/strict';
import { GlobalEventManager } from '../game/src/systems/global_event_system.js';

const rolls = [0.1, 0.8, 0.2, 0.4, 0.6];
let rollIndex = 0;
const state = {
    turn: 9,
    stage: { id: 2 },
    ember: 12,
    maxEmber: 20,
    activeGlobalEvents: [],
    eventCooldowns: {},
    temporaryWeightModifiers: [],
    lastGlobalEventTurn: 0,
    addLog() {}
};
const engine = { gameplayRandom: { nextFloat: () => rolls[rollIndex++ % rolls.length] } };
const manager = new GlobalEventManager(state, engine);

const instance = manager.triggerEvent('EVENT_DEMIHUMAN_SCOUTS');
assert.ok(instance);
assert.equal(instance.runtimeState.choice.status, 'PENDING');
assert.equal(instance.runtimeState.choice.eventId, 'EVENT_CAPTURED_SCOUT');

const pending = manager.getPendingChoice();
assert.equal(pending.sourceEventId, 'EVENT_DEMIHUMAN_SCOUTS');
assert.deepEqual(pending.publicContext, instance.runtimeState.choice.publicContext);

manager.tickTurn();
assert.equal(state.activeGlobalEvents.length, 1, 'pending choice event must not expire');

const resolution = {
    eventId: 'EVENT_CAPTURED_SCOUT',
    choiceId: 'INTERROGATE',
    publicOutcomeTags: ['INTEL_OPPORTUNITY', 'CAPTIVE_REMAINS']
};
assert.equal(manager.markChoiceResolved('EVENT_DEMIHUMAN_SCOUTS', resolution), true);
assert.equal(instance.runtimeState.choice.status, 'RESOLVED');

manager.tickTurn();
assert.equal(state.activeGlobalEvents.length, 0, 'resolved one-Verse event may expire normally');
console.log('global event choice runtime state: PASS');
