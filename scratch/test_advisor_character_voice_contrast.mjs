import assert from 'node:assert/strict';
import { I18n } from '../game/src/i18n.js';
import { ADVISOR_CHARACTERS } from '../game/src/ui/advisor/advisor_profiles.js';
import { ADVISOR_EVENTS, findAdvisorDialogue } from '../game/src/ui/advisor/advisor_dialogue_database.js';
import { AdvisorDialogueSystem, ADVISOR_DIALOGUE_MODES } from '../game/src/ui/advisor/advisor_dialogue_system.js';

I18n.setLanguage('ja');
const general = ADVISOR_CHARACTERS.GENERAL_OLD_01;
const staff = ADVISOR_CHARACTERS.STAFF_OFFICER_FEMALE_01;

function render(profile, event) {
    const entry = findAdvisorDialogue(event, profile);
    assert.ok(entry, `${profile.id}:${event} must resolve`);
    const system = new AdvisorDialogueSystem({
        profile,
        translate: key => I18n.t(key),
        getLanguage: () => 'ja',
        dialogueMode: ADVISOR_DIALOGUE_MODES.DETAILED,
        setTimer: () => null,
        clearTimer: () => {}
    });
    return system.resolveLine(entry, {}, system.resolveDialogueMode(entry, ADVISOR_DIALOGUE_MODES.DETAILED)).text;
}

for (const event of [
    ADVISOR_EVENTS.EMBER_WARNING,
    ADVISOR_EVENTS.FOOD_WARNING,
    ADVISOR_EVENTS.DEFENSE_WEAK,
    ADVISOR_EVENTS.FIRST_ZONE_COMPLETED,
    ADVISOR_EVENTS.FIRST_LINK_COMPLETED,
    ADVISOR_EVENTS.CONNECTION_HEALTHY,
    ADVISOR_EVENTS.MAJOR_DEVELOPMENT
]) {
    assert.notEqual(render(staff, event), render(general, event), `${event} must sound character-specific`);
}
assert.match(render(staff, ADVISOR_EVENTS.FOOD_WARNING), /備蓄|消費速度/);
assert.match(render(staff, ADVISOR_EVENTS.DEFENSE_WEAK), /即応|損耗|補充/);
assert.match(render(staff, ADVISOR_EVENTS.CONNECTION_HEALTHY), /輸送|迂回|運用/);
assert.match(render(general, ADVISOR_EVENTS.EMBER_WARNING), /民|人々|余裕/);
assert.match(render(staff, ADVISOR_EVENTS.EMBER_WARNING), /余力|負担|維持/);
console.log('advisor rendered voice contrast: ok');
