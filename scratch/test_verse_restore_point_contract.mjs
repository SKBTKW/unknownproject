import { HistorySnapshotService } from '../game/src/core/history_snapshot_service.js';

console.log('=== Verse Restore Point Contract ===');

let total = 0;
let passed = 0;
function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`  FAIL: ${message}`);
        process.exitCode = 1;
        return;
    }
    passed++;
    console.log(`  PASS: ${message}`);
}

const offering = [
    { id: 'card_8_1', cardMasterId: 'GL1_PLAINS', terrain: { id: 'GL1_PLAINS', terrainId: 'GL1_PLAINS', nameKey: 'TERRAIN_PLAINS', category: 'LAND', shape: [[1]] }, currentShape: [[1]], currentAnchor: { r: 0, c: 0 } },
    { id: 'card_8_2', cardMasterId: 'CMD_VIGILANCE', terrain: { id: 'CMD_VIGILANCE', nameKey: 'CMD_VIGILANCE_NAME', category: 'MILITARY' }, currentShape: [[1]], currentAnchor: { r: 0, c: 0 } }
];

const state = {
    turn: 8,
    ember: 18,
    food: 44,
    wood: 30,
    defense: 10,
    currentDefense: 10,
    maxDefense: 10,
    mystic: 2,
    grid: [[{ r: 0, c: 0, placed: false, isHQ: false, hasSocket: true, searched: false }]],
    handOffering: offering,
    reserveSlots: [null],
    cardCooldowns: {},
    consumedUniqueCards: [],
    usedUniqueCards: [],
    grantedConnectionPairs: new Set(),
    mergedBlocks: {},
    mergeLinks: new Set(),
    stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 }
};

const engine = {
    state,
    runSeed: 123,
    checkSystem: { getState: () => ({ rng: { seed: 1, state: 2, callCount: 3 } }) },
    gameplayRandom: { getState: () => ({ source: { seed: 4, state: 5, callCount: 6 }, sequence: 2 }) },
    chronicleSystem: { getAllEvents: () => [] },
    buffSystem: { buffs: [] }
};

const service = new HistorySnapshotService(engine);
const point = service.captureRestorePoint({ verse: 8, sourceCompletedTurn: 7 });

assert(point.verse === 8, 'restore point is keyed by active Verse');
assert(point.gameState.handOffering[0].cardMasterId === 'GL1_PLAINS', 'land Offering identity is preserved');
assert(point.gameState.handOffering[1].cardMasterId === 'CMD_VIGILANCE', 'command Offering identity is preserved');
assert(point.gameState.grid[0][0].hasSocket === true, 'known socket position is preserved');

offering[0].cardMasterId = 'MUTATED';
state.grid[0][0].hasSocket = false;
assert(point.gameState.handOffering[0].cardMasterId === 'GL1_PLAINS', 'restore Offering is immutable/non-aliased');
assert(point.gameState.grid[0][0].hasSocket === true, 'restore board/socket state is immutable/non-aliased');

assert(!!point.gameplayRngState, 'post-initialization gameplay RNG state is captured');
assert(service.getRestorePoint(8) === point, 'restore point lookup resolves exact Verse');

console.log(`Verse Restore Point Contract: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
