import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';

const engine = GameEngine.createGame({ runSeed: 76543 });
const state = engine.state;
const stateIdentity = state;
const subsystemRefs = Object.fromEntries([
    'engine', 'defenseSystem', 'deckManager', 'gridEngine', 'buffSystem',
    'chronicleSystem', 'globalEventManager', 'checkSystem'
].map(key => [key, state[key]]));

const originalCard = state.handOffering[1];
const commandMaster = engine.deckManager.getLandCardMaster().find(master => master.category === 'COMMAND');
assert.ok(commandMaster);
state.reserveSlots[0] = {
    id: 'card_command_1', cardMasterId: commandMaster.id, terrain: commandMaster,
    currentShape: [[1]], currentAnchor: { r: 0, c: 0 },
    originalHandIdx: 1, reservedThisTurn: true
};
state.handOffering[1] = { isBlank: true, id: 'blank_1_1', originalCard };
state.cardCooldowns.CARD_PLAINS_1X1 = 8;
state.consumedUniqueCards = ['UNIQUE_B'];
state.usedUniqueCards = ['UNIQUE_A'];
state.mergeLinks.add('zone:a:b');
state.grantedConnectionPairs.add('group:a:b');
state.mergedBlocks = { groupA: { terrainId: 'GL1_PLAINS', cells: [[0, 0]] } };
state.grid[0][0].placed = true;
state.grid[0][0].hasSocket = true;
state.grid[0][0].terrain = { id: 'GL1_PLAINS', terrainId: 'GL1_PLAINS', food: 2, defense: 0, shape: [[1]] };
state.grid[0][0].socketResource = { id: 'SOCKET_WILD_WHEAT', nameKey: 'SOCKET_WILD_WHEAT', bonusFood: 3 };
state.hasReservedThisTurn = true;
state.nextTrialTurn = 17;

const serialized = serializeGameState(state);
const saved = structuredClone(serialized);
const resolveCardMaster = id => engine.deckManager.getLandCardMaster().find(master => master.id === id);

state.turn = 42;
state.ember = -1;
state.wood = -99;
state.material = -99;
state.grid = [];
state.handOffering = [];
state.offeringCards = [];
state.reserveSlots = [];
state.mergeLinks = new Set(['wrong']);
state.grantedConnectionPairs = new Set();
state.mergedBlocks = {};
state.stage = { id: 3, name: 'Wrong', size: 9, maxTiles: 80 };
state.trialSchedule = { trial1: -1 };

// Hydration must not invoke any simulation, UI, RNG, or recording action.
const forbidden = () => { throw new Error('HYDRATE_CALLED_FORBIDDEN_ACTION'); };
engine.deckManager.generateOfferingCards = forbidden;
engine.gridEngine.expandGrid = forbidden;
engine.checkSystem.resolve = forbidden;
engine.gameplayRandom.nextFloat = forbidden;
engine.gameplayRandom.nextInt = forbidden;
engine.gameplayRandom.nextId = forbidden;
engine.chronicleSystem.record = forbidden;
engine.gameFactHub.emit = forbidden;
state.addLog = forbidden;

assert.equal(hydrateGameState(state, saved, { resolveCardMaster }), stateIdentity);
assert.equal(engine.state, stateIdentity);
assert.deepEqual(serializeGameState(state), saved, 'serialize → mutate → hydrate → serialize');
for (const [key, value] of Object.entries(subsystemRefs)) assert.equal(state[key], value, `${key} ref preserved`);
assert.equal(state.material, state.wood);
assert.equal(state.offeringCards, state.handOffering);
assert.ok(state.mergeLinks instanceof Set);
assert.ok(state.grantedConnectionPairs instanceof Set);
assert.deepEqual(state.handOffering.map(card => card?.cardMasterId ?? null), saved.handOffering.map(card => card?.cardMasterId ?? null));
assert.deepEqual(state.reserveSlots.map(card => card?.cardMasterId ?? null), saved.reserveSlots.map(card => card?.cardMasterId ?? null));
assert.deepEqual(serializeGameState(state).grid, saved.grid, 'socket layout exact');
assert.equal(state.handOffering[1].isBlank, true);
assert.equal(state.reserveSlots[0].originalHandIdx, 1);
assert.equal(state.reserveSlots[0].reservedThisTurn, true);
assert.equal(state.reserveSlots[0].cardMasterId, commandMaster.id);
assert.notEqual(state.grid, saved.grid, 'world data cloned');

const beforeInvalid = serializeGameState(state);
assert.throws(() => hydrateGameState(state, {
    ...saved, reserveSlots: [{ cardMasterId: 'MISSING', id: 'missing' }]
}, { resolveCardMaster }), /HYDRATE_CARD_MASTER_NOT_FOUND/);
assert.deepEqual(serializeGameState(state), beforeInvalid, 'invalid lookup does not partially mutate state');
assert.throws(() => hydrateGameState(state, { ...saved, engine: {} }, { resolveCardMaster }), /HYDRATE_UNKNOWN_FIELD/);
console.log('Hydrate GameState round-trip: PASS');
