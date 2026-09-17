import assert from 'node:assert/strict';
import { GAME_FACT_TYPES } from '../game/src/core/game_fact.js';
import { ADVISOR_SCENES } from '../game/src/data/advisor_scene_catalog.js';
import { STAFF_OFFICER_REACTIONS } from '../game/src/data/advisor_staff_officer_reactions.js';
import { AdvisorCueResolver } from '../game/src/services/advisor_cue_resolver.js';

const resolver = new AdvisorCueResolver();
const authoredScenes = new Set(Object.keys(STAFF_OFFICER_REACTIONS.reactions));

// Scenes that current production-owned facts can resolve without inference.
const liveScenes = new Set([
    ADVISOR_SCENES.TRIAL_WARNING,
    ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED,
    ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED,
    ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED,
    ADVISOR_SCENES.THIRD_TRIAL_VICTORY,
    ADVISOR_SCENES.GAME_OVER
]);

// Kept only for older/synthetic TRIAL_RESULT_SETTLED payloads that predate result data.
const compatibilityFallbackScenes = new Set([
    ADVISOR_SCENES.TRIAL_COMPLETED
]);

// Authored reactions waiting for a game-owned semantic fact. Do not infer these
// from nearby lower-level facts in Advisor code.
const reservedScenes = new Set([
    ADVISOR_SCENES.LARGE_EXPANSION,
    ADVISOR_SCENES.REFUGEES_FOUND,
    ADVISOR_SCENES.CIVILIANS_LOST,
    ADVISOR_SCENES.TRIAL_REGION_ABANDONED,
    ADVISOR_SCENES.TRIAL_PREPARED_DEFENSE_SUCCESS,
    ADVISOR_SCENES.TRIAL_PYRRHIC_VICTORY,
    ADVISOR_SCENES.TRIAL_VICTORY_WITH_CIVILIAN_LOSS,
    ADVISOR_SCENES.TRIAL_DESPERATE_STAND_SUCCESS,
    ADVISOR_SCENES.RUN_CLEAR
]);

const classifiedScenes = new Set([
    ...liveScenes,
    ...compatibilityFallbackScenes,
    ...reservedScenes
]);

assert.deepEqual(
    [...classifiedScenes].sort(),
    [...authoredScenes].sort(),
    'every authored staff-officer reaction must be explicitly classified as live, compatibility fallback, or reserved'
);

assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.WARNING_STATE_CHANGED,
        payload: { previous: 'WATCH', current: 'TENSE', source: 'TRIAL_TIMING_TENSE' }
    })?.type,
    ADVISOR_SCENES.TRIAL_WARNING,
    'entering the high-alert semantic window must produce one Trial warning scene'
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.WARNING_STATE_CHANGED,
        payload: { previous: 'WATCH', current: 'IMMINENT', source: 'TRIAL_TIMING_IMMINENT' }
    })?.type,
    ADVISOR_SCENES.TRIAL_WARNING,
    'a direct jump into IMMINENT must still produce the warning scene'
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.WARNING_STATE_CHANGED,
        payload: { previous: 'TENSE', current: 'IMMINENT', source: 'TRIAL_TIMING_IMMINENT' }
    }),
    null,
    'TENSE to IMMINENT must not repeat the warning reaction'
);
assert.equal(
    resolver.resolve({ type: GAME_FACT_TYPES.TRIAL_PLAN_CONFIRMED, payload: {} })?.type,
    ADVISOR_SCENES.TRIAL_INTERCEPTION_CONFIRMED
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { trialIndex: 1, outcome: 'SURVIVED', result: { totalEmberDamage: 0 }, settlement: {} }
    })?.type,
    ADVISOR_SCENES.TRIAL_SURVIVED_UNDAMAGED
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { trialIndex: 2, outcome: 'SURVIVED', result: { totalEmberDamage: 2 }, settlement: {} }
    })?.type,
    ADVISOR_SCENES.TRIAL_SURVIVED_DAMAGED
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { trialIndex: 3, outcome: 'SURVIVED', result: { totalEmberDamage: 0 }, settlement: {} }
    })?.type,
    ADVISOR_SCENES.THIRD_TRIAL_VICTORY,
    'third Trial victory must take precedence over generic undamaged survival'
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { trialIndex: 3, outcome: 'SURVIVED', result: { totalEmberDamage: 4 }, settlement: {} }
    })?.type,
    ADVISOR_SCENES.THIRD_TRIAL_VICTORY,
    'third Trial victory must take precedence over generic damaged survival'
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { trialIndex: 3, outcome: 'FAILED', result: { totalEmberDamage: 3 }, settlement: { runTerminated: true } }
    })?.type,
    ADVISOR_SCENES.GAME_OVER,
    'failed third Trial must remain GAME_OVER'
);
assert.equal(
    resolver.resolve({
        type: GAME_FACT_TYPES.TRIAL_RESULT_SETTLED,
        payload: { outcome: 'SURVIVED', settlement: {} }
    })?.type,
    ADVISOR_SCENES.TRIAL_COMPLETED
);

// Semantic guardrails: these lower-level facts do not prove the authored scene.
assert.equal(
    resolver.resolve({ type: GAME_FACT_TYPES.TRIAL_ROUTE_SKIPPED, payload: {} }),
    null,
    'skipping an interception route does not prove that a region was abandoned or civilians were withdrawn'
);
assert.equal(
    resolver.resolve({ type: GAME_FACT_TYPES.TRIAL_THREAT_UPDATED, payload: {} }),
    null,
    'Advisor Reaction must not reinterpret raw Trial threat updates as an authored warning scene'
);

console.log('advisor reaction scene coverage: ok');
