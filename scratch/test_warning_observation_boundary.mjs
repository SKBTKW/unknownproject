import assert from 'node:assert/strict';
import { EnemyObservationProjector } from '../game/src/warning/systems/enemy_observation_projector.js';
import { createEnemyStateTransitionResolver } from '../game/src/trial/systems/enemy_state_transition_resolver.js';

const projector = new EnemyObservationProjector();

const truth = {
    trialIndex: 2,
    threatRevision: 7,
    strategicSuppression: 999,
    nextTrialTurn: 30,
    commander: { id: 'SECRET_COMMANDER', power: 999 },
    ingress: { edge: 'NORTH', index: 3 },
    routes: [{ cells: [{ r: 0, c: 3 }, { r: 1, c: 3 }] }],
    forces: [{ id: 'SECRET_FORCE', exactCount: 42 }],
    observable: {
        scaleBand: 'LARGE',
        directionHints: ['NORTH'],
        physiqueTraits: ['LARGE_BODY_PRESENT'],
        equipmentTraits: ['METAL_EQUIPMENT'],
        movementTraits: ['FOREST_ACTIVITY'],
        terrainTraits: ['FOREST']
    }
};

const profile = projector.project(truth);

assert.deepEqual(profile, {
    trialIndex: 2,
    threatRevision: 7,
    directionHints: ['NORTH'],
    scaleBand: 'LARGE',
    physiqueTraits: ['LARGE_BODY_PRESENT'],
    equipmentTraits: ['METAL_EQUIPMENT'],
    movementTraits: ['FOREST_ACTIVITY'],
    terrainTraits: ['FOREST']
});

for (const forbidden of [
    'strategicSuppression',
    'nextTrialTurn',
    'commander',
    'ingress',
    'routes',
    'forces'
]) {
    assert.equal(Object.hasOwn(profile, forbidden), false, `${forbidden} leaked through observation boundary`);
}

truth.observable.directionHints.push('EAST');
assert.deepEqual(profile.directionHints, ['NORTH'], 'projected arrays must be snapshots');

const hiddenOnly = projector.project({
    trialIndex: 1,
    strategicSuppression: 999,
    routes: [{ cells: [{ r: 0, c: 0 }] }]
});
assert.equal(hiddenOnly.scaleBand, null, 'Warning must not derive scale from hidden combat values');
assert.deepEqual(hiddenOnly.directionHints, [], 'Warning must not infer route direction from hidden routes');

const transitionResolver = createEnemyStateTransitionResolver();
const transitionedTruth = transitionResolver({
    previousEnemyState: {
        observable: {
            directionHints: ['NORTH_ACTIVITY'],
            movementTraits: ['NIGHT_MOVEMENT'],
            terrainTraits: ['FOREST_ACTIVITY']
        }
    },
    currentThreat: { strategicSuppression: 14 },
    verse: 8,
    trialIndex: 1
});

assert.deepEqual(transitionedTruth.observable, {
    scaleBand: null,
    directionHints: ['NORTH_ACTIVITY'],
    physiqueTraits: ['MEDIUM_BODY_PRESENT'],
    equipmentTraits: ['STANDARD_EQUIPMENT'],
    movementTraits: ['NIGHT_MOVEMENT'],
    terrainTraits: ['FOREST_ACTIVITY']
}, 'Trial Truth transition must expose only coarse categorical force traits');

const transitionedProfile = projector.project(transitionedTruth);
assert.deepEqual(transitionedProfile.physiqueTraits, ['MEDIUM_BODY_PRESENT']);
assert.deepEqual(transitionedProfile.equipmentTraits, ['STANDARD_EQUIPMENT']);
for (const forbidden of ['strategicSuppression', 'armyStructure', 'forces', 'commander']) {
    assert.equal(Object.hasOwn(transitionedProfile, forbidden), false, `${forbidden} leaked from generated Truth observation`);
}

const zeroForceTruth = transitionResolver({
    previousEnemyState: transitionedTruth,
    currentThreat: { strategicSuppression: 0 },
    verse: 9,
    trialIndex: 1
});
assert.deepEqual(zeroForceTruth.observable.physiqueTraits, [], 'stale physique observations must clear when the current army has no force profiles');
assert.deepEqual(zeroForceTruth.observable.equipmentTraits, [], 'stale equipment observations must clear when the current army has no force profiles');
assert.deepEqual(zeroForceTruth.observable.directionHints, ['NORTH_ACTIVITY'], 'facets owned by other Truth sources must be preserved');

console.log('warning observation boundary: PASS');
