import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { GLOBAL_EVENT_CHOICE_IDS } from '../game/src/data/global_event_choices.js';
import { GlobalEventChoiceSystem } from '../game/src/systems/global_event_choice_system.js';
import { GlobalEventChoiceRuntimeIntegration } from '../game/src/ui/global_event_choice_runtime_integration.js';

const context = marker => ({
    captureZone: 'INNER',
    visibleFacts: ['NEAR_MAIN_ROAD'],
    civilianMood: 'ANGRY',
    publicEnemyTraits: [marker],
    alertState: 'WATCH'
});

const factHub = new GameFactHub();
const system = new GlobalEventChoiceSystem({ factHub });
let pending = null;
const calls = { mark: 0, turnStart: 0, rng: 0, chronicle: 0, hide: 0, show: 0 };
const component = {
    root: { hidden: false },
    presentation: { eventId: 'FUTURE_A' },
    advisorReaction: { lineKey: 'FUTURE_ADVISOR' },
    neutralReaction: { lineKey: 'FUTURE_NEUTRAL' },
    hide() {
        calls.hide++;
        this.root.hidden = true;
        this.presentation = null;
        this.advisorReaction = null;
        this.neutralReaction = null;
    },
    show(presentation) {
        calls.show++;
        this.presentation = presentation;
        this.root.hidden = false;
    }
};
const runtime = Object.create(GlobalEventChoiceRuntimeIntegration.prototype);
runtime.manager = {
    getPendingChoice: () => pending,
    markChoiceResolved: () => calls.mark++,
    onTurnStart: () => calls.turnStart++
};
runtime.system = system;
runtime.component = component;
runtime.active = { eventId: 'FUTURE_A', publicContext: context('FUTURE_A'), sourceEventId: 'SOURCE_A' };
runtime.engine = {
    gameplayRandom: { nextFloat: () => calls.rng++ },
    chronicleSystem: { record: () => calls.chronicle++ }
};

assert.equal(runtime.reconcilePending(), null);
assert.equal(runtime.active, null);
assert.equal(component.root.hidden, true);
assert.equal(component.presentation, null);
assert.equal(component.advisorReaction, null);
assert.equal(component.neutralReaction, null);

pending = {
    eventId: GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT,
    sourceEventId: 'SOURCE_B',
    publicContext: context('RESTORED_B')
};
const restoredB = runtime.reconcilePending();
assert.equal(restoredB.eventId, GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT);
assert.equal(runtime.active.sourceEventId, 'SOURCE_B');
assert.deepEqual(runtime.active.publicContext.publicEnemyTraits, ['RESTORED_B']);
assert.equal(component.presentation.publicContext.publicEnemyTraits[0], 'RESTORED_B');
assert.equal(component.advisorReaction, null);
assert.equal(component.neutralReaction, null);

pending.publicContext.publicEnemyTraits[0] = 'MUTATED_MANAGER_CONTEXT';
assert.deepEqual(runtime.active.publicContext.publicEnemyTraits, ['RESTORED_B'],
    'active context must be detached from manager state');

component.advisorReaction = { lineKey: 'STALE_SAME_EVENT' };
pending = {
    ...pending,
    publicContext: context('SAME_EVENT_RESTORED_CONTEXT')
};
runtime.reconcilePending();
assert.deepEqual(runtime.active.publicContext.publicEnemyTraits, ['SAME_EVENT_RESTORED_CONTEXT']);
assert.equal(component.advisorReaction, null, 'same-event reconciliation must clear stale reaction');

assert.equal(factHub.getFacts().length, 0, 'reconcile must emit no facts');
assert.deepEqual(
    { mark: calls.mark, turnStart: calls.turnStart, rng: calls.rng, chronicle: calls.chronicle },
    { mark: 0, turnStart: 0, rng: 0, chronicle: 0 }
);

system.createPresentation(GLOBAL_EVENT_CHOICE_IDS.CAPTURED_SCOUT, context('NORMAL_PRESENTATION'));
assert.equal(
    factHub.getFacts().filter(fact => fact.type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED).length,
    1,
    'normal presentation must still emit exactly one PRESENTED fact'
);
assert.equal(
    factHub.getFacts().filter(fact => fact.type === GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED).length,
    0
);

console.log('Global Event Choice Restore reconciliation: PASS');
