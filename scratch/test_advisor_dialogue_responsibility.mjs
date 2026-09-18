import assert from 'node:assert/strict';
import { ADVISOR_DIALOGUE_CHANNELS, ADVISOR_EVENT_RESPONSIBILITY, ADVISOR_SCENE_RESPONSIBILITY } from '../game/src/data/advisor_dialogue_responsibility.js';
import { ADVISOR_SCENES } from '../game/src/data/advisor_scene_catalog.js';
import { AdvisorReactionEvaluator } from '../game/src/ui/advisor/advisor_reaction_evaluator.js';
import { AdvisorRuntimeState } from '../game/src/ui/advisor/advisor_runtime_state.js';
import { ADVISOR_TOPICS, resolveAdvisorPeaceStates } from '../game/src/ui/advisor/advisor_peace_state_resolver.js';

const profile = {
    policy: { ember: 1, survival: 2, logistics: 4, defense: 1, connection: 2, development: 2, economy: 1, mysticism: 1 }
};
const evaluator = new AdvisorReactionEvaluator({ rng: () => 0 });

assert.equal(ADVISOR_EVENT_RESPONSIBILITY.FOOD_CRITICAL.policyKey, 'logistics');
assert.equal(ADVISOR_EVENT_RESPONSIBILITY.STABLE_OVERALL.policyKey, 'survival');
assert.equal(ADVISOR_SCENE_RESPONSIBILITY[ADVISOR_SCENES.FOOD_CRITICAL].channel, ADVISOR_DIALOGUE_CHANNELS.ADVICE);
assert.equal(ADVISOR_SCENE_RESPONSIBILITY[ADVISOR_SCENES.SEVERAL_LANDS_PLACED].channel, ADVISOR_DIALOGUE_CHANNELS.SILENT);

let result = evaluator.evaluateTurn({
    states: [{ id: 'EMBER_WARNING', topic: ADVISOR_TOPICS.EMBER, severity: 2 }],
    runtime: new AdvisorRuntimeState({ lastSpokenTurn: 1 }),
    profile,
    turn: 6
});
assert.equal(result, null, 'Policy 1 warning should remain silent');

result = evaluator.evaluateTurn({
    states: [{ id: 'EMBER_CRITICAL', topic: ADVISOR_TOPICS.EMBER, severity: 3 }],
    runtime: new AdvisorRuntimeState({ lastSpokenTurn: 1 }),
    profile,
    turn: 6
});
assert.equal(result?.id, 'EMBER_CRITICAL', 'Critical state may override low attention');

result = evaluator.evaluateTurn({
    states: [
        { id: 'EMBER_WARNING', topic: ADVISOR_TOPICS.EMBER, severity: 2 },
        { id: 'FOOD_WARNING', topic: ADVISOR_TOPICS.LOGISTICS, severity: 2 }
    ],
    runtime: new AdvisorRuntimeState({ lastSpokenTurn: 1 }),
    profile,
    turn: 6
});
assert.equal(result?.id, 'FOOD_WARNING', 'High-attention logistics should beat low-attention Ember warning');

result = evaluator.evaluateTurn({
    states: [
        { id: 'DEFENSE_HEALTHY', topic: ADVISOR_TOPICS.DEFENSE, severity: 1 },
        { id: 'FOOD_CRITICAL', topic: ADVISOR_TOPICS.LOGISTICS, severity: 3 }
    ],
    runtime: new AdvisorRuntimeState({ lastSpokenTurn: 1 }),
    profile: { ...profile, policy: { ...profile.policy, defense: 4 } },
    turn: 6
});
assert.equal(result?.id, 'FOOD_CRITICAL', 'Critical severity should beat defining-attention normal state');

const milestoneRuntime = new AdvisorRuntimeState();
assert.notEqual(evaluator.evaluateMilestone('ZONE_COMPLETED', milestoneRuntime)?.mandatory, true);
assert.notEqual(evaluator.evaluateMilestone('LINK_COMPLETED', milestoneRuntime)?.mandatory, true);

const foodState = resolveAdvisorPeaceStates({ emberRatio: 1, foodRunway: 0.5, defenseReference: 0, zoneCount: 0, boardOccupancy: 0 });
assert.ok(foodState.some(item => item.id === 'FOOD_CRITICAL' && item.topic === ADVISOR_TOPICS.LOGISTICS));
const stableState = resolveAdvisorPeaceStates({ emberRatio: 1, foodRunway: 10, defenseReference: 0, zoneCount: 0, boardOccupancy: 0 });
assert.ok(stableState.some(item => item.id === 'STABLE_OVERALL' && item.topic === ADVISOR_TOPICS.SURVIVAL));

console.log('advisor dialogue responsibility: ok');
