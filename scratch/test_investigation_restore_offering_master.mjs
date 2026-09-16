import { HistoryRestoreService } from '../game/src/core/history_restore_service.js';
import { attachInvestigationRuntime } from '../game/src/warning/integration/investigation_runtime_bridge.js';

const restoredInvestigationCard = {
    id: 'instance-investigation-1',
    cardMasterId: 'INVESTIGATE_FOOTPRINTS',
    category: 'INVESTIGATION',
    rarity: 'C',
    terrainId: 'INVESTIGATE_FOOTPRINTS',
    nameKey: 'INVESTIGATE_FOOTPRINTS_NAME',
    currentShape: [[1]],
    currentAnchor: null,
    cyclePolicy: 'RARITY',
    reservedThisTurn: false
};

const restorePoint = {
    rngState: { seed: 1 },
    gameplayRngState: { seed: 2 },
    chronicle: [],
    runtime: {},
    gameState: {
        turn: 9,
        grid: [],
        handOffering: [restoredInvestigationCard],
        reserveSlots: [],
        mergeLinks: [],
        grantedConnectionPairs: [],
        investigationUnlocked: true,
        investigationUnlockedAtVerse: 6,
        knownEnemyState: {
            trialIndex: 1,
            reports: [],
            observedTags: []
        },
        lastInvestigationReport: null,
        lastInvestigationComparison: null
    }
};

const engine = {
    state: {
        turn: 15,
        investigationUnlocked: false,
        grid: [],
        handOffering: [],
        reserveSlots: [],
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        hasPickedThisTurn: false
    },
    deckManager: {
        getLandCardMaster() { return []; }
    },
    turnLifecycleService: {
        getPhase() { return 'ACTIVE'; },
        lastCommittedBoundary: null
    },
    historySnapshotService: {
        getRestorePoint(verse) { return verse === 9 ? restorePoint : null; },
        truncateAfterVerse() {}
    },
    checkSystem: {
        getState() { return { seed: 1 }; },
        setState() {}
    },
    gameplayRandom: {
        getState() { return { seed: 2 }; },
        setState() {},
        nextFloat() { return 0; },
        nextId() { return 'restored-investigation-report'; }
    },
    chronicleSystem: {
        getAllEvents() { return []; },
        restoreEvents() {}
    },
    trialRestoreBoundaryService: {
        resolveRestoreVerse(verse) { return verse; },
        end() {}
    },
    transactionManager: { clearHistory() {} },
    undoSystem: { clearSnapshot() {} }
};

const attached = attachInvestigationRuntime(engine, {
    observableProfileProvider() {
        return {
            trialIndex: 1,
            threatRevision: 1,
            directionHints: ['NORTH_ACTIVITY'],
            scaleBand: null,
            physiqueTraits: ['LARGE_BODY_PRESENT'],
            equipmentTraits: [],
            movementTraits: [],
            terrainTraits: []
        };
    },
    executionService: {
        execute({ card, knownEnemyState, observedAtVerse }) {
            const report = {
                id: 'restored-execution',
                observedAtVerse,
                trialIndex: 1,
                sourceType: card.investigationSourceType,
                threatRevision: 1,
                observations: [{ facet: 'DIRECTION', tag: 'NORTH_ACTIVITY' }]
            };
            knownEnemyState.reports.push(report);
            if (!knownEnemyState.observedTags.includes('NORTH_ACTIVITY')) {
                knownEnemyState.observedTags.push('NORTH_ACTIVITY');
            }
            return { success: true, report, comparison: null };
        }
    }
});
if (!attached.success) throw new Error('investigation runtime did not attach');

const restoreService = new HistoryRestoreService(engine);
const restored = restoreService.restoreVerse(9);
if (!restored.success) throw new Error('history restore failed');
if (!engine.state.investigationUnlocked) throw new Error('investigation unlock did not restore');
if (engine.state.handOffering.length !== 1) throw new Error('investigation Offering card did not restore');

const card = engine.state.handOffering[0];
if (card?.terrain?.id !== 'INVESTIGATE_FOOTPRINTS') {
    throw new Error('investigation card master was not resolved during restore');
}
if (card?.terrain?.investigationSourceType !== 'FOOTPRINTS') {
    throw new Error('investigation card master fields were not restored');
}

engine.state.hasPickedThisTurn = false;
const execution = engine.executeInvestigationCard(card, { type: 'OFFERING', index: 0 });
if (!execution.success) throw new Error('restored investigation card could not execute');
if (engine.state.handOffering.length !== 0) throw new Error('restored investigation card was not consumed');
if (!engine.state.knownEnemyState.observedTags.includes('NORTH_ACTIVITY')) {
    throw new Error('restored investigation execution did not update known enemy state');
}

console.log('PASS investigation restore Offering master');
