import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { GlobalEventChoiceSystem } from '../game/src/systems/global_event_choice_system.js';
import { AdvisorEventBridge } from '../game/src/ui/advisor/advisor_event_bridge.js';

const publicContext = {
    captureZone: 'OUTER',
    visibleFacts: ['LIGHTLY_EQUIPPED'],
    civilianMood: 'CALM'
};

{
    const system = new GlobalEventChoiceSystem();
    const presentation = system.buildPresentation('EVENT_CAPTURED_SCOUT', publicContext);
    assert.equal(presentation.eventId, 'EVENT_CAPTURED_SCOUT');
    assert.equal(presentation.descKey, 'EVENT_CAPTURED_SCOUT_DESC');
    assert.deepEqual(presentation.publicContext, publicContext);
    assert.equal(presentation.choices.length, 3);

    const resolution = system.resolveChoice('EVENT_CAPTURED_SCOUT', 'INTERROGATE', publicContext);
    assert.equal(resolution.resultKey, 'EVENT_CAPTURED_SCOUT_RESULT_INTERROGATE');
    assert.deepEqual(resolution.publicContext, publicContext);
}

{
    const factHub = new GameFactHub();
    const personalityDialogue = [];
    const dialogueSystem = {
        emit: item => { personalityDialogue.push(item); return true; },
        emitTopic: item => { personalityDialogue.push(item); return true; },
        emitResolved: item => { personalityDialogue.push(item); return true; }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, factHub, {
        profile: { personality: 'stern', policy: { defense: 4 } },
        enabledProvider: () => false
    });

    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        publicContext
    });
    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        choiceId: 'INTERROGATE',
        publicContext,
        publicOutcomeTags: ['INTEL_OPPORTUNITY', 'CAPTIVE_REMAINS']
    });

    assert.equal(personalityDialogue.length, 0);
    assert.equal(bridge.observeMilitaryAction('TEST_ACTION', 10), false);

    bridge.destroy();
}

console.log('global event presentation remains independent when advisor is disabled: ok');
