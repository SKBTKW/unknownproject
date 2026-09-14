import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { AdvisorEventBridge } from '../game/src/ui/advisor/advisor_event_bridge.js';
import {
    ADVISOR_NEUTRAL_PERSONALITY,
    resolveNeutralGlobalEventReaction
} from '../game/src/ui/advisor/advisor_global_event_neutral_reactions.js';
import { ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS } from '../game/src/ui/advisor/advisor_global_event_choice_reactions.js';
import { resolveAdvisorGlobalEventChoiceReaction } from '../game/src/ui/advisor/advisor_global_event_choice_reaction_resolver.js';

const publicContext = {
    captureZone: 'OUTER',
    visibleFacts: ['LIGHTLY_EQUIPPED'],
    civilianMood: 'CALM'
};

{
    const neutral = resolveNeutralGlobalEventReaction(
        'EVENT_CAPTURED_SCOUT',
        ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED
    );
    assert.equal(neutral.focus, 'FACT_ONLY');
    assert.equal(neutral.lineKey, 'EVENT_CAPTURED_SCOUT_DESC');
}

{
    const reaction = resolveAdvisorGlobalEventChoiceReaction({
        eventId: 'EVENT_CAPTURED_SCOUT',
        personality: ADVISOR_NEUTRAL_PERSONALITY,
        timing: ADVISOR_GLOBAL_EVENT_CHOICE_TIMINGS.PRESENTED,
        publicContext
    });
    assert.equal(reaction.focus, 'FACT_ONLY');
    assert.deepEqual(reaction.context.publicContext, publicContext);
}

{
    const factHub = new GameFactHub();
    const neutralNarrations = [];
    const personalityDialogue = [];
    const dialogueSystem = {
        emit: item => { personalityDialogue.push(item); return true; },
        emitTopic: item => { personalityDialogue.push(item); return true; },
        emitResolved: item => { personalityDialogue.push(item); return true; }
    };
    const bridge = new AdvisorEventBridge(dialogueSystem, factHub, {
        profile: { personality: 'stern', policy: { defense: 4 } },
        enabledProvider: () => false,
        neutralNarrationSink: reaction => {
            neutralNarrations.push(reaction);
            return true;
        }
    });

    factHub.emit(GAME_FACT_TYPES.GLOBAL_EVENT_CHOICE_PRESENTED, {
        eventId: 'EVENT_CAPTURED_SCOUT',
        publicContext
    });

    assert.equal(neutralNarrations.length, 1);
    assert.equal(neutralNarrations[0].focus, 'FACT_ONLY');
    assert.equal(personalityDialogue.length, 0);
    assert.equal(bridge.observeMilitaryAction('TEST_ACTION', 10), false);
    assert.equal(personalityDialogue.length, 0);

    bridge.destroy();
}

console.log('advisor neutral global event narration: ok');
