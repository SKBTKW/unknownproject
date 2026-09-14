import {
    createKnownEnemyState,
    createObservableEnemyProfile,
    InvestigationCardExecutionService
} from '../game/src/warning/index.js';

const known = createKnownEnemyState({ trialIndex: 1 });
const profile = createObservableEnemyProfile({
    trialIndex: 1,
    threatRevision: 3,
    directionHints: ['NORTH_ACTIVITY'],
    physiqueTraits: ['LARGE_BODY_PRESENT'],
    movementTraits: ['NIGHT_MOVEMENT']
});

const service = new InvestigationCardExecutionService({
    resolver: {
        resolve({ profile, observedAtVerse, sourcePolicy }) {
            return {
                id: 'exec-1',
                observedAtVerse,
                trialIndex: profile.trialIndex,
                sourceType: sourcePolicy.sourceType,
                threatRevision: profile.threatRevision,
                observations: [
                    { facet: 'DIRECTION', tag: profile.directionHints[0] },
                    { facet: 'PHYSIQUE', tag: profile.physiqueTraits[0] }
                ]
            };
        }
    }
});

const result = service.execute({
    card: {
        id: 'INVESTIGATE_FOOTPRINTS',
        category: 'INVESTIGATION',
        investigationSourceType: 'FOOTPRINTS',
        maxObservations: 2
    },
    profile,
    knownEnemyState: known,
    observedAtVerse: 9
});

if (!result.success) throw new Error('investigation execution failed');
if (known.reports.length !== 1) throw new Error('report was not recorded');
if (!known.observedTags.includes('NORTH_ACTIVITY')) throw new Error('direction observation missing');
if (!known.observedTags.includes('LARGE_BODY_PRESENT')) throw new Error('physique observation missing');
if (result.report.sourceType !== 'FOOTPRINTS') throw new Error('source policy mismatch');
if (result.report.threatRevision !== 3) throw new Error('snapshot revision missing');

const invalid = service.execute({
    card: { id: 'BASE_A', category: 'LAND' },
    profile,
    knownEnemyState: known,
    observedAtVerse: 10
});
if (invalid.success) throw new Error('non-investigation card executed as investigation');

console.log('PASS investigation card execution');
