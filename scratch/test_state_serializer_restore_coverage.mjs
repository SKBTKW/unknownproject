import { serializeGameState } from '../game/src/core/state_serializer.js';

console.log('=== StateSerializer restore coverage contract ===');

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

const state = {
    turn: 7,
    ember: 18,
    maxEmber: 27,
    food: 33,
    wood: 21,
    defense: 14,
    defenseCapacityBonus: 4,
    currentDefense: 11,
    maxDefense: 14,
    mystic: 5,
    hasPickedThisTurn: true,
    hasReservedThisTurn: true,
    hasMulliganedThisTurn: false,
    mergeGroupCounter: 8,
    placementGroupCounter: 12,
    grantedConnectionPairs: new Set(['1:2', '2:3']),
    handOfferingSize: 4,
    nextTrialDamageMitigation: 0.8,
    nextTrialMultiplier: 1.25,
    trialSchedule: { trial1: 16, trial2: 31, trial3: 50, warningDuration: 5 },
    nextTrialTurn: 16,
    activeConstructionProjects: [{ name: 'CMD_BIG_WINDMILL', remainingTurns: 2 }],
    activeDrawBias: { type: 'UNTIL_BLOCKS', untilValue: 6 },
    placedBlockCount: 9,
    permanentPlainsFoodBonus: 2,
    permanentVicinityDefenseBonus: 3,
    emberConsumptionReducedTurns: 1,
    emberConsumptionStartsNextTurn: true,
    vigilanceTurns: 2,
    vigilanceStartsNextTurn: false,
    grandCultivationTurns: 4,
    grandCultivationStartsNextTurn: true,
    systematicLoggingTurns: 3,
    systematicLoggingStartsNextTurn: false,
    emergencyLevyTurns: 1,
    emergencyLevyStartsNextTurn: true,
    manifestMiracleTurns: 2,
    manifestMiracleStartsNextTurn: false,
    reserveFeeWaivedTurns: 3,
    reserveFeeWaivedStartsNextTurn: true,
    temporaryDefense: 6,
    temporaryDefenseTurns: 1,
    grid: [],
    handOffering: [],
    reserveSlots: [null],
    cardCooldowns: { CARD_A: 9 },
    usedUniqueCards: ['UNIQUE_B', 'UNIQUE_A'],
    consumedUniqueCards: ['UNIQUE_D', 'UNIQUE_C'],
    mergedBlocks: {},
    mergeLinks: new Set(['zone-b', 'zone-a']),
    stage: { id: 2, name: 'Stage 2', size: 7, maxTiles: 48 }
};

const snapshot = serializeGameState(state);

assert(snapshot.maxEmber === 27, 'captures maxEmber');
assert(snapshot.mergeGroupCounter === 8 && snapshot.placementGroupCounter === 12, 'captures identity counters');
assert(snapshot.grantedConnectionPairs.join(',') === '1:2,2:3', 'captures granted connection pairs deterministically');
assert(snapshot.handOfferingSize === 4, 'captures offering size');
assert(snapshot.nextTrialDamageMitigation === 0.8 && snapshot.nextTrialMultiplier === 1.25, 'captures Trial modifiers');
assert(snapshot.trialSchedule.trial1 === 16 && snapshot.nextTrialTurn === 16, 'captures Trial schedule state');
assert(snapshot.activeConstructionProjects[0].remainingTurns === 2, 'captures construction runtime');
assert(snapshot.activeDrawBias.type === 'UNTIL_BLOCKS', 'captures draw bias');
assert(snapshot.placedBlockCount === 9, 'captures placed block counter');
assert(snapshot.permanentVicinityDefenseBonus === 3, 'captures permanent vicinity defense bonus');
assert(snapshot.emberConsumptionReducedTurns === 1 && snapshot.emberConsumptionStartsNextTurn === true, 'captures ember duration state');
assert(snapshot.vigilanceTurns === 2, 'captures vigilance duration state');
assert(snapshot.grandCultivationTurns === 4 && snapshot.grandCultivationStartsNextTurn === true, 'captures cultivation duration state');
assert(snapshot.systematicLoggingTurns === 3, 'captures logging duration state');
assert(snapshot.emergencyLevyTurns === 1 && snapshot.emergencyLevyStartsNextTurn === true, 'captures levy duration state');
assert(snapshot.manifestMiracleTurns === 2, 'captures miracle duration state');
assert(snapshot.reserveFeeWaivedTurns === 3 && snapshot.reserveFeeWaivedStartsNextTurn === true, 'captures reserve fee duration state');
assert(snapshot.temporaryDefense === 6 && snapshot.temporaryDefenseTurns === 1, 'captures legacy temporary defense state');
assert(snapshot.usedUniqueCards.join(',') === 'UNIQUE_A,UNIQUE_B', 'normalizes used unique cards');
assert(snapshot.consumedUniqueCards.join(',') === 'UNIQUE_C,UNIQUE_D', 'normalizes consumed unique cards');
assert(snapshot.mergeLinks.join(',') === 'zone-a,zone-b', 'keeps merge links deterministic');

state.activeConstructionProjects[0].remainingTurns = 99;
state.activeDrawBias.untilValue = 99;
assert(snapshot.activeConstructionProjects[0].remainingTurns === 2, 'construction snapshot does not alias live state');
assert(snapshot.activeDrawBias.untilValue === 6, 'draw bias snapshot does not alias live state');

console.log(`StateSerializer Restore Coverage: ${passed}/${total} PASS`);
if (passed !== total) process.exitCode = 1;
