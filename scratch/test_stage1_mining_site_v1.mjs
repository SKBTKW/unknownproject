import { UIController } from '../game/src/ui/ui_controller.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardDomainAdapter } from '../game/src/core/board_domain_adapter.js';
import { SpecialBlockService } from '../game/src/systems/special_block_service.js';
import { sumSpecialBlockProduction } from '../game/src/core/special_block_production.js';
import { readSpecialBlockAdjacencyProfile } from '../game/src/core/special_block_domain.js';
import { DeckManager } from '../game/src/systems/deck_manager.js';
import { attachCardRuntimePolicy, isCardRuntimeActive } from '../game/src/systems/card_runtime_policy.js';
import { createCardDomainActionExecutor } from '../game/src/cards/card_domain_action_executor.js';
import { ECONOMY_CARDS_MASTER, COMMAND_CARDS_MASTER } from '../game/src/data/command_cards_data.js';
import { resolveDomainActionMigrationBlocker } from '../game/src/cards/legacy_command_execution_inventory.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
const card = COMMAND_CARDS_MASTER.find(c => c.id === 'CMD_MINE');
const sourceCard = JSON.parse(readFileSync(new URL('../game/src/data/economy_cards.json', import.meta.url))).find(c => c.id === card.id);
assert.deepEqual(card, sourceCard);
assert.deepEqual(ECONOMY_CARDS_MASTER.find(c => c.id === card.id), sourceCard);
assert.equal(isCardRuntimeActive(card), true);
assert.equal(resolveDomainActionMigrationBlocker(card.id), null);
assert.deepEqual([card.minStage, card.rarity, card.weight, card.cost], [1, 'UC', 0.25, {}]);
function setup() {
    const state = {
        turn: 6, stage: { id: 1 }, food: 100, wood: 100, material: 100, defense: 5, currentDefense: 5,
        mystic: 0, ember: 20, maxEmber: 20, mergedBlocks: {}, handOffering: [card], reserveSlots: [null],
        activeBuffs: [], consumedUniqueCards: [], usedUniqueCards: [], logs: [],
        addLog(text) { this.logs.push(text); }, addBuff(buff) { this.activeBuffs.push(buff); },
        grid: Array.from({length: 5}, (_, r) => Array.from({length: 5}, (_, c) => ({
            r, c, placed: false, terrain: null, specialBlock: null, isHQ: false, searched: false,
            hasSocket: false, socketResource: null, cachedSocketSeeds: {}
        })))
    };
    const cell = state.grid[2][2];
    Object.assign(cell, { placed: true, terrain: {id: 'E2_HILL', terrainId: 'E2_HILL', e: 2, gl: 1},
        socketResource: {id: 'SOCKET_STONE', category: 'CAT_STONE', bonusFood: 0, bonusWood: 2, bonusDefense: 1, bonusMystic: 0} });
    const board = new BoardDomainAdapter({state});
    const engine = {state, boardDomainAdapter: board};
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine); engine.deckManager = deck; deck.cycleSystem = null;
    attachCardRuntimePolicy(deck);
    return {state, cell, board, deck, service: new SpecialBlockService(state)};
}
let cases = 0;
function test(name, fn) { fn(); cases++; console.log(`PASS ${name}`); }
const target = {source: {r: 2, c: 2}, destination: {r: 2, c: 3}};
test('Offering requires resolved discovered resource and legal affordable execution', () => {
    const {state, cell, deck} = setup();
    assert.equal(cell.searched, false);
    assert.equal(deck.isCardEligible(card), true);
    const resource = cell.socketResource; cell.socketResource = null;
    assert.equal(deck.isCardEligible(card), false);
    cell.hasSocket = true; cell.cachedSocketSeeds.hidden = resource;
    assert.equal(deck.isCardEligible(card), false);
    cell.socketResource = resource; cell.placed = false;
    assert.equal(deck.isCardEligible(card), false); cell.placed = true;
    cell.socketResource = {category: 'CAT_STONE'};
    assert.equal(deck.isCardEligible(card), false); cell.socketResource = resource;
    state.food = 19; assert.equal(deck.isCardEligible(card), false);
    state.food = 100; state.wood = 29; state.material = 29; assert.equal(deck.isCardEligible(card), false);
    state.wood = state.material = 100;
    for (const [r,c] of [[1,2],[3,2],[2,1],[2,3]]) state.grid[r][c].placed = true;
    assert.equal(deck.isCardEligible(card), false);
});
test('placement rejects diagonal bounds occupied and incompatible resource', () => {
    const {state, cell, service} = setup();
    assert.equal(service.validateTarget('MINE', target).valid, true);
    const edge = state.grid[0][0];
    Object.assign(edge, {placed:true,terrain:{id:'E2_HILL',e:2,gl:1},socketResource:cell.socketResource});
    assert.equal(service.validateTarget('MINE', {source:{r:0,c:0},destination:{r:-1,c:0}}).reason, 'OUT_OF_BOUNDS');
    edge.placed = false; edge.terrain = null; edge.socketResource = null;
    const previous = cell.terrain;
    for (const terrain of [{id:'E2_DESERT_HILL',e:2,gl:0}, {id:'E3_MOUNTAIN',e:3,gl:0}]) {
        cell.terrain = terrain; assert.equal(service.validateTarget('MINE', target).valid, false);
    }
    cell.terrain = previous;
    for (const destination of [{r:3,c:3}, {r:2,c:5}]) assert.equal(service.validateTarget('MINE', {...target,destination}).valid, false);
    state.grid[2][3].placed = true; assert.equal(service.validateTarget('MINE', target).valid, false);
    state.grid[2][3].placed = false; state.grid[2][3].specialBlock = {type:'FARM'};
    assert.equal(service.validateTarget('MINE', target).valid, false); state.grid[2][3].specialBlock = null;
    cell.socketResource.category = 'CAT_GRAIN'; assert.equal(service.validateTarget('MINE', target).valid, false);
    for (const category of ['CAT_STONE','CAT_STRATEGIC_MINERAL','CAT_PRECIOUS_METAL','CAT_SPECIAL_MINERAL']) {
        cell.socketResource.category = category; assert.equal(service.validateTarget('MINE', target).valid, true);
    }
});
test('Preview is read-only; exact Board quote pays atomically; entity is special-only', () => {
    const {state, board, deck} = setup();
    assert.deepEqual(board.quoteSpecialBlockCost('MINE').resources, {food:20,wood:30});
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.equal(targets.length, 4); assert.deepEqual([state.food,state.wood], [100,100]);
    assert.equal(deck.playCommandCard(card, targets.find(t => t.destination.c === 3), 0, -1).success, true);
    assert.deepEqual([state.food,state.wood,state.material], [80,70,70]);
    const mine = state.grid[2][3];
    assert.equal(mine.terrain, null); assert.equal(mine.placed, false); assert.equal(mine.merged, undefined);
    assert.deepEqual(readSpecialBlockAdjacencyProfile(mine), {e:2,gl:1,source:{r:2,c:2}});
    assert.deepEqual(mine.specialBlock.sourceResourceReference, {r:2,c:2,resourceId:'SOCKET_STONE',category:'CAT_STONE'});
    assert.deepEqual(mine.specialBlock.paidCost, {food:20,wood:30});
    assert.equal(deck.isCardEligible(card), false);
    assert.equal(board.validateSpecialBlockTarget('MINE', {...target,destination:{r:1,c:2}}).valid, false);
});
test('positive channels project independently without mutating source; lifecycle gate', () => {
    const {state, cell, deck} = setup();
    const before = structuredClone(cell.socketResource);
    assert.equal(deck.playCommandCard(card, target, 0, -1).success, true);
    assert.deepEqual(sumSpecialBlockProduction(state), {yields:{food:0,wood:1,defense:1,mystic:0},unresolved:[]});
    assert.deepEqual(cell.socketResource,before);
    cell.socketResource.bonusFood = 3; cell.socketResource.bonusMystic = 2;
    assert.deepEqual(sumSpecialBlockProduction(state).yields, {food:1,wood:1,defense:1,mystic:1});
    state.grid[2][3].specialBlock.state = 'DYSFUNCTIONAL';
    assert.deepEqual(sumSpecialBlockProduction(state).yields, {food:0,wood:0,defense:0,mystic:0});
    assert.equal(deck.isCardEligible(card), false, 'inactive facility still occupies source allocation');
});
test('two different resources are independent and restore preserves links and totals', () => {
    const {state, deck, board} = setup();
    assert.equal(deck.playCommandCard(card,target,0,-1).success,true);
    Object.assign(state.grid[0][0],{placed:true,terrain:{id:'GL1_PLAINS',e:1,gl:1},
        socketResource:{id:'SOCKET_GOLD',category:'CAT_PRECIOUS_METAL',bonusMystic:3}});
    state.handOffering = [card]; state.hasPickedThisTurn = false;
    assert.equal(deck.playCommandCard(card,{source:{r:0,c:0},destination:{r:0,c:1}},0,-1).success,true);
    const expected={food:0,wood:1,defense:1,mystic:1};
    assert.deepEqual(sumSpecialBlockProduction(state).yields,expected);
    const saved = serializeGameState(state); const restored={}; hydrateGameState(restored,saved);
    assert.deepEqual(restored.grid[2][3].specialBlock,state.grid[2][3].specialBlock);
    assert.deepEqual(sumSpecialBlockProduction(restored).yields,expected);
    assert.deepEqual(sumSpecialBlockProduction(restored).yields,expected);
    assert.deepEqual(new SpecialBlockService(restored).enumerateLegalTargets('MINE'), []);
    assert.deepEqual(board.enumerateLegalSpecialBlockTargets('MINE'), []);
});
for (const mutation of ['source','identity','destination','duplicate']) test(`post-payment stale ${mutation} rolls payment back`, () => {
    const {state, cell, deck, board} = setup();
    const preview = deck.enumerateCardExecutionTargets(card).find(t => t.destination.c === 3);
    const create = board.createSpecialBlock.bind(board);
    board.createSpecialBlock = (...args) => {
        assert.deepEqual([state.food,state.wood], [80,70]);
        if (mutation === 'source') cell.socketResource = null;
        if (mutation === 'identity') cell.socketResource.id = 'SOCKET_REPLACED';
        if (mutation === 'destination') state.grid[2][3].placed = true;
        if (mutation === 'duplicate') state.grid[1][2].specialBlock = {type:'MINE',terrainAdjacencyProfile:{e:2,gl:1,source:{r:2,c:2}}};
        return create(...args);
    };
    assert.equal(deck.playCommandCard(card,preview,0,-1).success,false);
    assert.deepEqual([state.food,state.wood,state.material], [100,100,100]);
    assert.equal(state.handOffering[0],card); assert.equal(Boolean(state.hasPickedThisTurn), false);
    assert.equal(state.grid[2][3].specialBlock,null);
});


test('Board click forwards resource-source execution target through shared UI', () => {
    const {state, deck} = setup();
    const targets = deck.enumerateCardExecutionTargets(card);
    let selected = null;
    const ui = {
        state, selectedCard: card, selectedCardIdx: 0,
        isTrialInteractionActive() { return false; },
        commandCardRequiresTarget() { return true; }, hideCellTooltip() {},
        getCommandCardExecutionTargets() { return targets; },
        isCommandExecutionTarget: UIController.prototype.isCommandExecutionTarget,
        playCommandCard(_card, _idx, target) { selected = target; return deck.playCommandCard(card, target, 0, -1); }
    };
    assert.equal(UIController.prototype.onCellClick.call(ui, 2, 3), true);
    assert.deepEqual(selected.source, {r:2,c:2});
    assert.equal(selected.sourceResourceReference.resourceId, 'SOCKET_STONE');
});

test('material-only and raw bonus yields survive canonical socket serialization', () => {
    for (const yields of [{bonusMaterial:2,bonusDefense:1}, {bonusYields:{food:0,material:2,defense:1,mystic:0}}]) {
        const {state, cell, deck} = setup();
        cell.socketResource = {id:'SOCKET_STONE',category:'CAT_STONE',...yields};
        assert.equal(deck.playCommandCard(card,target,0,-1).success,true);
        const expected={food:0,wood:1,defense:1,mystic:0};
        assert.deepEqual(sumSpecialBlockProduction(state).yields,expected);
        const restored={}; hydrateGameState(restored,serializeGameState(state));
        assert.deepEqual(sumSpecialBlockProduction(restored).yields,expected);
    }
});
test('disappeared or replaced source cannot contribute production', () => {
    const {state, cell, deck} = setup();
    assert.equal(deck.playCommandCard(card,target,0,-1).success,true);
    cell.socketResource.id = 'SOCKET_REPLACED';
    assert.deepEqual(sumSpecialBlockProduction(state).yields,{food:0,wood:0,defense:0,mystic:0});
    cell.socketResource.id = 'SOCKET_STONE'; cell.placed = false;
    assert.deepEqual(sumSpecialBlockProduction(state).yields,{food:0,wood:0,defense:0,mystic:0});
});
console.log(`Mining Site: ${cases}/${cases} cases PASS`);
