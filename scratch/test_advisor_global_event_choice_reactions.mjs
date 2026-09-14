import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { AdvisorEventBridge } from '../game/src/ui/advisor/advisor_event_bridge.js';
import {
    resolveAdvisorGlobalEventChoiceReaction
} from '../game/src/ui/advisor/advisor_global_event_choice_reaction_resolver.js';
import {
    ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS
} from '../game/src/ui/advisor/advisor_global_event_choice_reactions.js';

const baseContext = {
    captureZone: 'OUTER',
    visibleFacts: ['LIGHTLY_EQUIPPED'],
    civilianMood: 'CALM'
};

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: 'stern',
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED,
        publicContext: {
            captureZone: 'INNER',
            visibleFacts: [],
            civilianMood: 'CALM'
        }
    });
    assert.equal(reaction.focus, 'INFORMATION_LEAK');
}

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: 'stern',
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED,
        publicContext: {
            captureZone: 'INNER',
            visibleFacts: ['MAP_FRAGMENT_FOUND'],
            civilianMood: 'ANGRY'
        }
    });
    assert.equal(reaction.focus, 'INTERROGATION_VALUE');
}

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: 'stern',
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED,
        publicContext: {
            captureZone: 'OUTER',
            visibleFacts: [],
            civilianMood: 'ANGRY'
        }
    });
    assert.equal(reaction.focus, 'CIVILIAN_PRESSURE');
}

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: 'stern',
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.RESOLVED,
        choiceId: 'RELEASE',
        publicContext: baseContext,
        publicOutcomeTags: ['DEESCALATION_POSSIBLE', 'INFORMATION_LEAK_RISK']
    });
    assert.equal(reaction.focus, 'INFORMATION_LEAK_RISK');
}

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: 'unknown_personality',
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED,
        publicContext: baseContext
    });
    assert.equal(reaction, null);
}

{
    const factHub = new GameFactHub();
    const emitted = [];
    const dialogueSystem = {
        emit: () => false,
        emitTopic: () => false,
        emitResolved: reaction => {
            emitted.push(reaction);
            return true;
        }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, factHub, {
        profile: { personality: 'stern', policy: {} },
        enabledProvider: () => true
    });

    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        publicContext: {
            captureZone: 'INNER',
            visibleFacts: [],
            civilianMood: 'CALM'
        }
    });
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].focus, 'INFORMATION_LEAK');

    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_RESOLVED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        choiceId: 'INTERROGATE',
        publicContext: baseContext,
        publicOutcomeTags: ['INTEL_OPPORTUNITY', 'CAPTIVE_REMAINS']
    });
    assert.equal(emitted.length, 2);
    assert.equal(emitted[1].focus, 'INTEL_OPPORTUNITY');

    bridge.destroy();
}

{
    const factHub = new GameFactHub();
    const emitted = [];
    const dialogueSystem = {
        emit: () => false,
        emitTopic: () => false,
        emitResolved: reaction => {
            emitted.push(reaction);
            return true;
        }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, factHub, {
        profile: { personality: 'stern', policy: {} },
        enabledProvider: () => false
    });

    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        publicContext: baseContext
    });
    assert.equal(emitted.length, 0);

    bridge.destroy();
}

console.log('advisor global event choice reactions: ok');
