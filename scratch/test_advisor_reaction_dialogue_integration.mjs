import assert from 'node:assert/strict';
import { GameFactHub, GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { ADVISOR_CHARACTERS } from '../game/src/ui/advisor/advisor_profiles.js';
import { AdvisorDialogueSystem } from '../game/src/ui/advisor/advisor_dialogue_system.js';
import { AdvisorEventBridge } from '../game/src/ui/advisor/advisor_event_bridge.js';

const profile = ADVISOR_CHARACTERS.STAFF_OFFICER_FEMALE_01;
const hub = new GameFactHub();
const shown = [];
const system = new AdvisorDialogueSystem({
    profile,
    setTimer: () => null,
    clearTimer: () => {}
});
system.subscribe(item => { if (item) shown.push(item); });
const bridge = new AdvisorEventBridge(system, hub, { profile, enabledProvider: () => true });

hub.emit(GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, {
    routes: [{ routeId: 'route-a', status: 'INTERCEPT', defenseAllocation: 3 }],
    totalDefenseAllocated: 3
});

assert.equal(shown.length, 1, 'same fact must produce only one visible advisor utterance');
assert.equal(shown[0].event, 'TRIAL_INTERCEPTION_CONFIRMED');
assert.equal(shown[0].text, '承知しました。配置を確定します。');

bridge.destroy();
system.destroy();
console.log('advisor reaction/dialogue integration: ok');
