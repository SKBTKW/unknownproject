import assert from 'node:assert/strict';

import { resolveAdvisorAdvice } from '../game/src/ui/advisor/advisor_advice_resolver.js';
import {
    ADVISOR_EVENTS,
    findAdvisorDialogue
} from '../game/src/ui/advisor/advisor_dialogue_database.js';

const profile = { personality: 'stern', policy: { defense: 4 } };

{
    const advice = resolveAdvisorAdvice({}, { active: false });
    assert.equal(advice.suggestionKey, 'UI_ADVISOR_DIALOGUE_STABLE_1');
}

const genericPreThreatExpectations = new Map([
    [ADVISOR_EVENTS.DEFENSE_WEAK, ['UI_ADVISOR_DIALOGUE_DEFENSE_WEAK_1']],
    [ADVISOR_EVENTS.DEFENSE_CRITICAL, ['UI_ADVISOR_DIALOGUE_DEFENSE_WEAK_1']],
    [ADVISOR_EVENTS.MILITARY_ACTION, ['UI_ADVISOR_DIALOGUE_MILITARY_2']]
]);

for (const [event, expectedLineKeys] of genericPreThreatExpectations) {
    const entry = findAdvisorDialogue(event, profile);
    assert.ok(entry, `${event} dialogue must exist`);
    assert.deepEqual(entry.lineKeys, expectedLineKeys);
    assert.equal(entry.segmentGroups, undefined, `${event} must not use pre-threat unsafe segment groups`);
}

{
    const warning = findAdvisorDialogue(ADVISOR_EVENTS.TRIAL_WARNING, profile);
    assert.deepEqual(warning?.lineKeys, ['UI_ADVISOR_DIALOGUE_TRIAL_WARNING']);

    const trialStart = findAdvisorDialogue(ADVISOR_EVENTS.TRIAL_START, profile);
    assert.deepEqual(trialStart?.lineKeys, ['UI_ADVISOR_DIALOGUE_TRIAL_START']);
}

console.log('advisor threat language contract: ok');
