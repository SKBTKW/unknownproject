import assert from 'node:assert/strict';
import { I18n } from '../game/src/i18n.js';
import { ADVISOR_CHARACTERS } from '../game/src/ui/advisor/advisor_profiles.js';
import { ADVISOR_EVENTS, findAdvisorDialogue } from '../game/src/ui/advisor/advisor_dialogue_database.js';
import { AdvisorDialogueSystem, ADVISOR_DIALOGUE_MODES } from '../game/src/ui/advisor/advisor_dialogue_system.js';

const general = ADVISOR_CHARACTERS.GENERAL_OLD_01;
const staff = ADVISOR_CHARACTERS.STAFF_OFFICER_FEMALE_01;

assert.equal(findAdvisorDialogue(ADVISOR_EVENTS.FIRST_ZONE_COMPLETED, general).localizedSegments, undefined);
assert.ok(findAdvisorDialogue(ADVISOR_EVENTS.FIRST_ZONE_COMPLETED, staff).localizedSegments);
assert.equal(findAdvisorDialogue(ADVISOR_EVENTS.FIRST_LINK_COMPLETED, general).localizedSegments, undefined);
assert.ok(findAdvisorDialogue(ADVISOR_EVENTS.FIRST_LINK_COMPLETED, staff).localizedSegments);

const system = new AdvisorDialogueSystem({
    profile: staff,
    translate: key => I18n.t(key),
    getLanguage: () => 'ja',
    dialogueMode: ADVISOR_DIALOGUE_MODES.DETAILED,
    setTimer: () => null,
    clearTimer: () => {}
});

for (const event of [
    ADVISOR_EVENTS.EMBER_WARNING,
    ADVISOR_EVENTS.EMBER_CRITICAL,
    ADVISOR_EVENTS.EMBER_RECOVERED,
    ADVISOR_EVENTS.FOOD_WARNING,
    ADVISOR_EVENTS.FOOD_CRITICAL,
    ADVISOR_EVENTS.FOOD_RECOVERED,
    ADVISOR_EVENTS.DEFENSE_WEAK,
    ADVISOR_EVENTS.DEFENSE_CRITICAL,
    ADVISOR_EVENTS.DEFENSE_HEALTHY
]) {
    const entry = findAdvisorDialogue(event, staff);
    const line = system.resolveLine(entry, {}, system.resolveDialogueMode(entry, ADVISOR_DIALOGUE_MODES.DETAILED));
    assert.equal(line.segmentKeys.length, 3, `${event} should expose three layers at policy 4`);
}

for (const event of [
    ADVISOR_EVENTS.FIRST_ZONE_COMPLETED,
    ADVISOR_EVENTS.ZONE_COMPLETED,
    ADVISOR_EVENTS.FIRST_LINK_COMPLETED,
    ADVISOR_EVENTS.LINK_COMPLETED,
    ADVISOR_EVENTS.BOARD_FRAGMENTED,
    ADVISOR_EVENTS.CONNECTION_HEALTHY,
    ADVISOR_EVENTS.MAJOR_DEVELOPMENT
]) {
    const entry = findAdvisorDialogue(event, staff);
    const line = system.resolveLine(entry, {}, system.resolveDialogueMode(entry, ADVISOR_DIALOGUE_MODES.DETAILED));
    assert.equal(line.segmentKeys.length, 2, `${event} should cap at two layers with current policy`);
}

const enSystem = new AdvisorDialogueSystem({
    profile: staff,
    translate: key => I18n.t(key),
    getLanguage: () => 'en',
    dialogueMode: ADVISOR_DIALOGUE_MODES.DETAILED,
    setTimer: () => null,
    clearTimer: () => {}
});
const enFood = enSystem.resolveLine(
    findAdvisorDialogue(ADVISOR_EVENTS.FOOD_WARNING, staff), {}, ADVISOR_DIALOGUE_MODES.DETAILED
);
assert.match(enFood.text, /Food reserves/);

console.log('advisor character dialogue override: ok');
