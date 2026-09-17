import assert from 'node:assert/strict';
import { ADVISOR_CHARACTERS } from '../game/src/ui/advisor/advisor_profiles.js';

const general = ADVISOR_CHARACTERS.GENERAL_OLD_01;
const staff = ADVISOR_CHARACTERS.STAFF_OFFICER_FEMALE_01;
const generalFrames = new Set(general.characterRules.preferredFrames);
const staffFrames = new Set(staff.characterRules.preferredFrames);
const generalLexicon = new Set(general.characterRules.lexicalPreferences);
const staffLexicon = new Set(staff.characterRules.lexicalPreferences);

assert.ok(generalFrames.has('survival') && generalFrames.has('sustainability'));
assert.ok(staffFrames.has('discipline') && staffFrames.has('civilian_safety'));
assert.ok(staffLexicon.has('reporting') && staffLexicon.has('verification') && staffLexicon.has('stockpiles') && staffLexicon.has('attrition') && staffLexicon.has('withdrawal'));
assert.ok(generalLexicon.has('備え') && generalLexicon.has('余裕') && generalLexicon.has('立て直す'));
const overlap = [...staffLexicon].filter(word => generalLexicon.has(word));
assert.ok(overlap.length <= 2, `advisor core lexicons have drifted too close: ${overlap.join(', ')}`);
assert.notDeepEqual(staff.characterRules.preferredFrames, general.characterRules.preferredFrames);
assert.notDeepEqual(staff.characterRules.lexicalPreferences, general.characterRules.lexicalPreferences);
for (const concept of ['lavish_praise', 'perfection', 'absolutism', 'miracle', 'fate', 'glory']) {
    assert.ok(staff.characterRules.lexicalAvoid.includes(concept));
}
console.log('advisor character differentiation: ok');
