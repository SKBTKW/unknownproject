import { InvestigationHistoryComparator } from '../game/src/warning/index.js';

const comparator = new InvestigationHistoryComparator();

const previous = {
    id: 'r8',
    observedAtVerse: 8,
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'SCALE', tag: 'SCALE_MEDIUM' }
    ]
};

const current = {
    id: 'r12',
    observedAtVerse: 12,
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'SCALE', tag: 'SCALE_LARGE' },
        { facet: 'MOVEMENT', tag: 'BAGGAGE_PRESENT' }
    ]
};

const result = comparator.compare(previous, current);

if (result.scale.change !== 'INCREASED') {
    throw new Error('scale increase was not detected');
}
if (!result.newTags.includes('BAGGAGE_PRESENT')) {
    throw new Error('new evidence was not detected');
}
if (!result.repeatedTags.includes('NORTH_ACTIVITY')) {
    throw new Error('repeated evidence was not detected');
}
if (!result.missingTags.includes('SCALE_MEDIUM')) {
    throw new Error('previous scale tag difference missing');
}
if (result.missingTags.includes('NORTH_ACTIVITY')) {
    throw new Error('repeated evidence incorrectly marked missing');
}

const sparseCurrent = {
    id: 'r13',
    observedAtVerse: 13,
    observations: [{ facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }]
};
const sparseResult = comparator.compare(current, sparseCurrent);
if (sparseResult.scale.change !== 'UNCHANGED_OR_UNKNOWN') {
    throw new Error('absence of scale evidence must not imply decrease');
}

console.log('PASS investigation history comparator');
