import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';

const report = {
    id: 'investigation:1:8',
    observedAtVerse: 8,
    trialIndex: 1,
    sourceType: 'FOOTPRINTS',
    threatRevision: 2,
    observations: [
        { facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' },
        { facet: 'PHYSIQUE', tag: 'LARGE_BODY_PRESENT' }
    ]
};

const comparison = {
    previousReportId: null,
    currentReportId: report.id,
    newTags: ['NORTH_ACTIVITY', 'LARGE_BODY_PRESENT'],
    missingTags: [],
    repeatedTags: [],
    scale: {
        previousTag: null,
        currentTag: null,
        change: 'UNCHANGED_OR_UNKNOWN'
    },
    hasComparableChange: true
};

const source = {
    turn: 9,
    ember: 20,
    maxEmber: 20,
    food: 50,
    wood: 30,
    defense: 10,
    currentDefense: 10,
    maxDefense: 10,
    mystic: 0,
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
    grid: [],
    handOffering: [],
    reserveSlots: [null],
    cardCooldowns: {},
    usedUniqueCards: [],
    consumedUniqueCards: [],
    mergedBlocks: {},
    mergeLinks: new Set(),
    grantedConnectionPairs: new Set(),
    investigationUnlocked: true,
    investigationUnlockedAtVerse: 6,
    knownEnemyState: {
        trialIndex: 1,
        reports: [report],
        observedTags: ['NORTH_ACTIVITY', 'LARGE_BODY_PRESENT']
    },
    lastInvestigationReport: report,
    lastInvestigationComparison: comparison
};

const serialized = serializeGameState(source);
if (!serialized.investigationUnlocked) throw new Error('unlock state was not serialized');
if (serialized.investigationUnlockedAtVerse !== 6) throw new Error('unlock Verse was not serialized');
if (!Array.isArray(serialized.knownEnemyState?.observedTags)) {
    throw new Error('observed tags are not JSON-safe');
}
if (serialized.knownEnemyState.observedTags.length !== 2) {
    throw new Error('observed tags were lost during serialization');
}

const json = JSON.stringify(serialized);
if (!json.includes('NORTH_ACTIVITY') || !json.includes('LARGE_BODY_PRESENT')) {
    throw new Error('observed tags were lost in JSON serialization');
}

const target = {
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
    grid: [],
    handOffering: [],
    reserveSlots: [null],
    mergeLinks: new Set(),
    grantedConnectionPairs: new Set()
};

hydrateGameState(target, JSON.parse(json), {
    resolveCardMaster: () => null
});

if (!target.investigationUnlocked) throw new Error('unlock state was not restored');
if (target.investigationUnlockedAtVerse !== 6) throw new Error('unlock Verse was not restored');
if (target.knownEnemyState?.reports?.[0]?.id !== report.id) {
    throw new Error('investigation report history was not restored');
}
if (!target.knownEnemyState?.observedTags?.includes('NORTH_ACTIVITY')) {
    throw new Error('known observation tags were not restored');
}
if (target.lastInvestigationReport?.id !== report.id) {
    throw new Error('latest investigation report was not restored');
}
if (target.lastInvestigationComparison?.currentReportId !== report.id) {
    throw new Error('latest investigation comparison was not restored');
}

const legacy = { ...serialized };
delete legacy.investigationUnlocked;
delete legacy.investigationUnlockedAtVerse;
delete legacy.knownEnemyState;
delete legacy.lastInvestigationReport;
delete legacy.lastInvestigationComparison;

hydrateGameState(target, legacy, { resolveCardMaster: () => null });
if (target.investigationUnlocked !== false) {
    throw new Error('legacy snapshot did not default investigation lock safely');
}
if (target.knownEnemyState !== null) {
    throw new Error('legacy snapshot did not clear absent known enemy state');
}

console.log('PASS investigation restore round trip');
