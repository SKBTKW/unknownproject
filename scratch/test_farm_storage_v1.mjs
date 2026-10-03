import { CellViewDataService } from '../game/src/services/cell_view_data_service.js';
import assert from 'node:assert/strict';
import { GameEngine } from '../game/src/core/game_engine.js';
import { SpecialBlockService } from '../game/src/systems/special_block_service.js';
import { SpecialBlockProductionResolver } from '../game/src/core/special_block_production.js';
import { readResourceStorage, enforceResourceStorage } from '../game/src/core/resource_storage_policy.js';
import { COMMAND_CARDS_MASTER } from '../game/src/data/command_cards_data.js';
import { resolveCanonicalTerrainSemantic } from '../game/src/data/land_system.js';
import { excludesCellFromZones, readSpecialBlockAdjacencyProfile } from '../game/src/core/special_block_domain.js';
import { resolveCellProductionBase } from '../game/src/core/land_production_contract.js';
import { serializeGameState } from '../game/src/core/state_serializer_base.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state_base.js';
import { UIController } from '../game/src/ui/ui_controller.js';

const engine = GameEngine.createGame({ runSeed: 20261003, firstRun: true });
const state = engine.state;
const board = engine.boardDomainAdapter;
const service = engine.specialBlockService;
const card = COMMAND_CARDS_MASTER.find(c => c.id === 'CMD_CULTIVATION');
assert.ok(card);
const plains = resolveCanonicalTerrainSemantic('GL1_PLAINS');
Object.assign(state.grid[1][1], { placed: true, terrain: { ...plains }, isHQ: false });
state.wood = state.material = 100;
assert.equal(service.quoteCost('FARM').resources.wood, 30);
assert.deepEqual(readResourceStorage(state).bonus, { food: 0, wood: 0 });
assert.equal(engine.deckManager.offeringEligibility.evaluate(card).eligible, true);
const ui = { engine, getCommandCardExecutionTargets: UIController.prototype.getCommandCardExecutionTargets };
assert.equal(UIController.prototype.isCommandExecutionTarget.call(ui, card, 1, 1), true);
function play(r, c) {
    state.handOffering = [card]; state.hasPickedThisTurn = false;
    return engine.playCommandCard(card, { type: 'OFFERING', index: 0 }, { r, c });
}
const beforeTerrain = JSON.stringify(state.grid[1][1].terrain);
assert.equal(play(1, 1).success, true);
assert.equal(state.wood, 70);
assert.equal(JSON.stringify(state.grid[1][1].terrain), beforeTerrain);
assert.equal(resolveCellProductionBase(state.grid[1][1]).yields.food, 0);
assert.equal(excludesCellFromZones(state.grid[1][1]), true);
const production = new SpecialBlockProductionResolver();
assert.equal(production.resolveCell(state, state.grid[1][1], { r: 1, c: 1 }).yields.food, 6);
assert.equal(new CellViewDataService(engine.productionCalculator).getCellViewData(state, 1, 1).yields.food, 6);
assert.equal(readResourceStorage(state).food, 170);
assert.equal(service.validateTarget('FARM', { r: 1, c: 1 }).valid, false);
assert.equal(play(1, 0).success, true, 'first expansion from overlay FARM');
assert.equal(state.grid[1][0].placed, false);
assert.equal(state.grid[1][0].terrain, null);
assert.equal(readResourceStorage(state).food, 190);
assert.deepEqual(readSpecialBlockAdjacencyProfile(state.grid[1][0]), { e: 1, gl: 1, source: { r: 1, c: 1 } });
assert.equal(play(0, 0).success, true, 'second expansion from special-only FARM');
assert.equal(readResourceStorage(state).food, 210);
assert.equal(state.wood, 10);
assert.equal(engine.deckManager.offeringEligibility.evaluate(card).eligible, false, 'insufficient material suppresses Offering');
const unchanged = JSON.stringify(serializeGameState(state));
assert.equal(play(0, 1).success, false, 'stale Reserve cannot build without funds');
assert.equal(state.wood, 10);
assert.equal(Boolean(state.grid[0][1].specialBlock), false);

state.grid[0][1].socketResource = { id: 'SOCKET_WILD_WHEAT', category: 'CAT_GRAIN' };
state.grid[2][1].socketResource = { id: 'SOCKET_BARLEY', category: 'CAT_GRAIN' };
assert.equal(production.resolveCell(state, state.grid[1][1], { r: 1, c: 1 }).yields.food, 7, 'grain bonus does not stack');
assert.equal(readResourceStorage(state).food, 210);
state.grid[0][1].socketResource = null; state.grid[2][1].socketResource = null;
state.grid[0][2].socketResource = { id: 'SOCKET_WILD_WHEAT', category: 'CAT_GRAIN' };
assert.equal(production.resolveCell(state, state.grid[1][1], { r: 1, c: 1 }).yields.food, 6, 'diagonal grain does not count');
state.grid[1][0].specialBlock.state = 'DAMAGED';
assert.equal(readResourceStorage(state).food, 190);
state.grid[4][4].specialBlock = { definitionId: 'LOGGING_CAMP', state: 'ACTIVE', terrainAdjacencyProfile: { e: 1, gl: 1 } };
assert.equal(readResourceStorage(state).wood, 200);
state.food = 500; state.wood = 500;
const clamped = enforceResourceStorage(state);
assert.equal(state.food, 190); assert.equal(state.wood, 200); assert.equal(state.material, 200);
assert.deepEqual(clamped.overflow, { food: 310, wood: 300 });
const restored = {};
hydrateGameState(restored, serializeGameState(state), { resolveCardMaster: id => COMMAND_CARDS_MASTER.find(c => c.id === id) });
assert.deepEqual(readResourceStorage(restored), readResourceStorage(state));
assert.equal(enforceResourceStorage(restored).overflow.food, 0, 'restore cannot double count capacity');

// Direct cultivation breaks a completed Zone; FARM cannot complete it again.
const e2 = GameEngine.createGame({ runSeed: 20261004 });
for (const [r,c] of [[0,0],[0,1],[1,0],[1,1]]) Object.assign(e2.state.grid[r][c], {
    placed: true, terrain: { ...plains }, merged: true, mergeType: '2x2', mergeGroupId: 'farm_zone'
});
e2.state.mergedBlocks.farm_zone = { cells: [{r:0,c:0},{r:0,c:1},{r:1,c:0},{r:1,c:1}], mergeType: '2x2' };
assert.equal(e2.specialBlockService.createSpecialBlock('FARM', { r: 0, c: 0 }, { paymentConfirmed: true, paidCost: { wood: 30 } }).success, true);
assert.equal(e2.state.mergedBlocks.farm_zone, undefined);
e2.gridEngine.checkMergePatterns();
assert.equal(e2.state.grid[0][0].mergeGroupId, null);
assert.equal(e2.gridEngine.checkNewMergeLinks().count, 0);
console.log('PASS: cultivation direct/chain/atomic cost/grain/zone/storage/restore');

// Production settlement pays maintenance before discarding excess harvest.
const e3 = GameEngine.createGame({ runSeed: 20261005 });
for (const [r,c] of [[0,0],[0,1],[1,0],[1,1]]) Object.assign(e3.state.grid[r][c], {
    placed: true, terrain: { ...plains }, isHQ: false
});
e3.state.food = 149; e3.state.wood = e3.state.material = 149;
e3.state.hasPickedThisTurn = true;
const preview = e3.previewTurnEndMaintenance();
const expectedFood = Math.min(150, 149 + preview.production.grossFood - preview.foodCost);
const next = e3.nextTurn();
assert.equal(next, 2);
assert.equal(e3.state.food, expectedFood);
assert.equal(e3.state.material, e3.state.wood);
assert.ok(e3.state.wood <= 150);
console.log('PASS: production settlement enforces storage after maintenance');
