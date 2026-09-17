import assert from 'node:assert/strict';
import { ADVISOR_SCENES } from '../game/src/data/advisor_scene_catalog.js';
import { STAFF_OFFICER_REACTIONS } from '../game/src/data/advisor_staff_officer_reactions.js';

const reactions = STAFF_OFFICER_REACTIONS.reactions;
assert.equal(reactions[ADVISOR_SCENES.SEVERAL_LANDS_PLACED], undefined);
assert.equal(reactions[ADVISOR_SCENES.FOOD_CRITICAL], undefined);
assert.ok(reactions[ADVISOR_SCENES.LARGE_EXPANSION]);
assert.ok(reactions[ADVISOR_SCENES.CIVILIANS_LOST]);
assert.ok(reactions[ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED]);
assert.ok(reactions[ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED]);
console.log('staff officer reaction boundaries: ok');
