import {
    createKnownEnemyState,
    KnownEnemyStateService
} from '../game/src/warning/index.js';

const state = createKnownEnemyState({ trialIndex: 1 });
const service = new KnownEnemyStateService();

const first = {
    id: 't1-v8',
    observedAtVerse: 8,
    trialIndex: 1,
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'SCALE', tag: 'SCALE_MEDIUM' }
    ]
};

const firstResult = service.record(state, first);
if (firstResult.previousReport !== null || firstResult.comparison !== null) {
    throw new Error('first report must not create comparison');
}

state.reports.push({
    id: 't2-v30',
    observedAtVerse: 30,
    trialIndex: 2,
    observations: [{ facet: 'DIRECTION', tag: 'EAST_ACTIVITY' }]
});

const second = {
    id: 't1-v12',
    observedAtVerse: 12,
    trialIndex: 1,
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'SCALE', tag: 'SCALE_LARGE' },
        { facet: 'MOVEMENT', tag: 'BAGGAGE_PRESENT' }
    ]
};

const secondResult = service.record(state, second);
if (secondResult.previousReport?.id !== 't1-v8') {
    throw new Error('previous report selection crossed trial boundary');
}
if (secondResult.comparison?.scale?.change !== 'INCREASED') {
    throw new Error('scale increase not detected');
}
if (!secondResult.comparison?.newTags?.includes('BAGGAGE_PRESENT')) {
    throw new Error('new evidence not detected');
}
if (!state.observedTags.includes('BAGGAGE_PRESENT')) {
    throw new Error('KnownEnemyState did not accumulate observed tag');
}

const third = {
    id: 't1-v13',
    observedAtVerse: 13,
    trialIndex: 1,
    observations: [{ facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }]
};
const thirdResult = service.record(state, third);
if (thirdResult.previousReport?.id !== 't1-v12') {
    throw new Error('latest same-trial report was not selected');
}
if (thirdResult.comparison?.scale?.change !== 'UNCHANGED_OR_UNKNOWN') {
    throw new Error('missing scale evidence was incorrectly treated as scale decrease');
}

console.log('PASS known enemy state service');
