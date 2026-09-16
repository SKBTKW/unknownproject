import assert from 'node:assert/strict';
import { GAME_FACT_TYPES, GameFactHub } from '../game/src/core/game_fact.js';
import { ADVISOR_SCENES } from '../game/src/data/advisor_scene_catalog.js';
import { AdvisorReactionService } from '../game/src/services/advisor_reaction_service.js';
import { assertAdvisorCharacterDefinition } from '../game/src/ui/advisor/advisor_character_contract.js';
import { ADVISOR_CHARACTERS, DEFAULT_ADVISOR_CHARACTER } from '../game/src/ui/advisor/advisor_profiles.js';

const characters = Object.values(ADVISOR_CHARACTERS);
assert.ok(characters.length >= 1, 'at least one advisor character must be registered');
assert.ok(
    characters.includes(DEFAULT_ADVISOR_CHARACTER),
    'default advisor must be one of the registered character definitions'
);

for (const character of characters) {
    assert.equal(assertAdvisorCharacterDefinition(character), true);
    assert.equal(Object.isFrozen(character), true);
    assert.equal(Object.isFrozen(character.policy), true);
    assert.equal(Object.isFrozen(character.personalityTraits), true);
    assert.equal(Object.isFrozen(character.speechStyle), true);
    assert.equal(Object.isFrozen(character.characterRules), true);
    assert.equal(Object.isFrozen(character.reactions), true);
    assert.equal(Object.isFrozen(character.dutyDialogue), true);
    assert.equal(Object.isFrozen(character.initialSkills), true);
}

// Current UI compatibility: all character definitions expose the legacy portrait aliases.
for (const character of characters) {
    assert.equal(character.portrait, character.portraits.normal);
    assert.equal(character.portraitExpanded, character.portraits.expanded);
    assert.equal(character.portraitCollapsed, character.portraits.collapsed);
}

// Every character is accepted by the same reaction runtime. Missing optional reactions are intentional silence.
for (const character of characters) {
    const gameFactHub = new GameFactHub();
    const service = new AdvisorReactionService({ gameFactHub, character });
    const received = [];
    service.subscribe(item => received.push(item));

    gameFactHub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
        routes: [{ routeId: 'route-a', status: 'INTERCEPT', defenseAllocation: 3 }],
        totalDefenseAllocated: 3
    });

    if (character.reactions?.[ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED]) {
        assert.equal(received.length, 1);
        assert.equal(received[0].characterId, character.id);
        assert.equal(received[0].scene, ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED);
    } else {
        assert.equal(received.length, 0);
    }

    service.dispose();
}

console.log('advisor character contract: ok');
