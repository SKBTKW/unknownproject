import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardDomainAdapter } from '../game/src/core/board_domain_adapter.js';
import { SpecialBlockService } from '../game/src/systems/special_block_service.js';
import { sumSpecialBlockProduction, hasCellPositiveProduction } from '../game/src/core/special_block_production.js';
import { getSpecialBlockDefinition, readSpecialBlockAdjacencyProfile, excludesCellFromZones } from '../game/src/core/special_block_domain.js';
import { DeckManager } from '../game/src/systems/deck_manager.js';
import { attachCardRuntimePolicy, isCardRuntimeActive } from '../game/src/systems/card_runtime_policy.js';
import { createCardDomainActionExecutor } from '../game/src/cards/card_domain_action_executor.js';
import { ECONOMY_CARDS_MASTER, COMMAND_CARDS_MASTER } from '../game/src/data/command_cards_data.js';
import { serializeGameState } from '../game/src/core/state_serializer.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state.js';
import { UIController } from '../game/src/ui/ui_controller.js';
import { GameplayRandomService } from '../game/src/core/gameplay_random_service.js';
import { pickWeightedCard, resolveOfferingWeight } from '../game/src/cards/offering_weight_policy.js';

const card = COMMAND_CARDS_MASTER.find(c => c.id === 'CMD_ALTAR');
const sourceCard = JSON.parse(readFileSync(new URL('../game/src/data/economy_cards.json', import.meta.url))).find(c => c.id === 'CMD_ALTAR');
const definition = getSpecialBlockDefinition('ALTAR');
const target = { source: { r: 1, c: 1 }, destination: { r: 0, c: 0 } };
function setup(size = 5, seed = 101) {
    const state = {
        turn: 6, stage: { id: size === 5 ? 1 : 2 }, food: 100, wood: 100, material: 100,
        defense: 10, currentDefense: 10, mystic: 0, ember: 20, maxEmber: 20, warningState: 'CALM',
        mergedBlocks: {}, handOffering: [card], handOfferingSize: 3, reserveSlots: [null],
        activeBuffs: [], consumedUniqueCards: [], usedUniqueCards: [], cardStageUsage: {},
        cardCooldowns: {}, logs: [], addLog(text) { this.logs.push(text); }, addBuff(b) { this.activeBuffs.push(b); },
        grid: Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ({
            r, c, placed: false, terrain: null, specialBlock: null, isHQ: false, socketResource: null
        })))
    };
    const center = Math.floor(size / 2);
    state.isHQVicinity = (r, c) => !(r === center && c === center) && Math.abs(r - center) <= 1 && Math.abs(c - center) <= 1;
    Object.assign(state.grid[center][center], { isHQ: true, placed: true, terrain: { id: 'HQ', e: 1, gl: 1, mystic: 1 } });
    const cell = state.grid[1][1];
    Object.assign(cell, { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 0 },
        socketResource: { id: 'SOCKET_CRYSTAL', category: 'CAT_SPECIAL_MINERAL', bonusMystic: 2 } });
    const board = new BoardDomainAdapter({ state });
    const engine = { state, boardDomainAdapter: board, gameplayRandom: new GameplayRandomService(seed) };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine); engine.deckManager = deck; deck.cycleSystem = null;
    attachCardRuntimePolicy(deck);
    return { state, cell, board, deck, service: new SpecialBlockService(state) };
}
const paid = { paymentConfirmed: true, paidCost: { food: 10, wood: 30 } };
let cases = 0;
function test(name, fn) { fn(); cases++; console.log(`PASS ${name}`); }

test('data parity, explicit runtime activation and Board-owned quote', () => {
    assert.deepEqual(card, sourceCard);
    assert.deepEqual(ECONOMY_CARDS_MASTER.find(c => c.id === card.id), sourceCard);
    assert.equal(COMMAND_CARDS_MASTER.filter(c => c.id === card.id).length, 1);
    assert.deepEqual([card.minStage, card.rarity, card.weight, card.cost, card.maxUsesPerStage], [1, 'UC', 0.25, {}, 1]);
    assert.equal(isCardRuntimeActive(card), true);
    assert.deepEqual(setup().board.quoteSpecialBlockCost('ALTAR').resources, { food: 10, wood: 30 });
    assert.equal(definition.trialTraits.defenseModifier, null);
    assert.deepEqual(definition.trialTraits.specialTactics, []);
});
test('Offering requires public positive mystic, legal outer-edge destination and affordability', () => {
    const { state, cell, deck } = setup();
    assert.equal(deck.isCardEligible(card), true);
    const socket = cell.socketResource; cell.socketResource = null;
    assert.equal(deck.isCardEligible(card), false, 'HQ alone does not qualify');
    cell.hasSocket = true; cell.cachedSocketSeeds = { hidden: socket };
    assert.equal(deck.isCardEligible(card), false);
    cell.socketResource = socket; cell.placed = false;
    assert.equal(deck.isCardEligible(card), false); cell.placed = true;
    cell.socketResource = { category: socket.category };
    assert.equal(deck.isCardEligible(card), false); cell.socketResource = socket;
    state.food = 9; assert.equal(deck.isCardEligible(card), false); state.food = 100;
    state.wood = state.material = 29; assert.equal(deck.isCardEligible(card), false);
    state.wood = state.material = 100;
    for (const row of state.grid) for (const entry of row) if (!entry.placed) entry.placed = true;
    assert.equal(deck.isCardEligible(card), false);
});
test('eight-way source adjacency, exterior-only region and normal terrain legality', () => {
    const { state, service, cell } = setup();
    assert.equal(service.validateTarget('ALTAR', target).valid, true, 'diagonal allowed');
    assert.equal(service.validateTarget('ALTAR', { ...target, destination: { r: 0, c: 1 } }).valid, true);
    assert.equal(service.validateTarget('ALTAR', { ...target, destination: { r: 1, c: 2 } }).valid, false, 'inside vicinity');
    assert.equal(service.validateTarget('ALTAR', { ...target, destination: { r: -1, c: 0 } }).valid, false);
    state.grid[0][0].placed = true; assert.equal(service.validateTarget('ALTAR', target).valid, false);
    state.grid[0][0].placed = false; state.grid[0][0].specialBlock = { type: 'FARM' };
    assert.equal(service.validateTarget('ALTAR', target).valid, false); state.grid[0][0].specialBlock = null;
    state.grid[0][1].placed = true; state.grid[0][1].terrain = { id: 'E3_MOUNTAIN', e: 3, gl: 0 };
    assert.equal(service.validateTarget('ALTAR', target).valid, false, 'common mountain restriction');
    state.grid[0][1].placed = false; state.grid[0][1].terrain = null;
    cell.socketResource = null; cell.terrain.mystic = 1;
    assert.equal(service.validateTarget('ALTAR', target).valid, true, 'terrain mystic is also a source');
});
test('Stage2 outer-edge follows current vicinity rather than Stage1 border', () => {
    const { state, service } = setup(7);
    Object.assign(state.grid[2][2], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 2 } });
    assert.equal(service.validateTarget('ALTAR', { source: { r: 2, c: 2 }, destination: { r: 1, c: 1 } }).valid, false, 'occupied');
    assert.equal(service.validateTarget('ALTAR', { source: { r: 2, c: 2 }, destination: { r: 1, c: 2 } }).valid, true);
    assert.equal(service.validateTarget('ALTAR', { source: { r: 1, c: 1 }, destination: { r: 0, c: 0 } }).valid, false, 'too far outside');
});
test('shared Preview/Commit pays exactly and saves special-only E/GL without zone participation', () => {
    const { state, deck } = setup();
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.ok(targets.some(t => t.r === 0 && t.c === 0));
    assert.deepEqual([state.food, state.wood], [100, 100]);
    assert.equal(deck.playCommandCard(card, targets.find(t => t.r === 0 && t.c === 0), 0, -1).success, true);
    assert.deepEqual([state.food, state.wood, state.material], [90, 70, 70]);
    const altar = state.grid[0][0];
    assert.equal(altar.terrain, null); assert.equal(altar.placed, false);
    assert.deepEqual(readSpecialBlockAdjacencyProfile(altar), { e: 1, gl: 1, source: { r: 1, c: 1 } });
    assert.equal(excludesCellFromZones(altar), true);
    assert.deepEqual(altar.specialBlock.paidCost, { food: 10, wood: 30 });
    assert.equal(altar.specialBlock.createdStage, 1);
    assert.equal(state.cardStageUsage['1'].CMD_ALTAR, 1);
    assert.equal(deck.isCardEligible(card), false);
});
test('current neighbors count once regardless of yield magnitude; cap 3 and lifecycle gate', () => {
    const { state, cell, service } = setup();
    assert.equal(service.createSpecialBlock('ALTAR', target, paid).success, true);
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1);
    cell.terrain.mystic = 10; cell.socketResource.bonusMystic = 20;
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1, 'terrain + resource + vicinity are one source');
    for (const [r, c] of [[0, 1], [1, 0]]) Object.assign(state.grid[r][c], {
        placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 2 }
    });
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 3);
    // A non-corner Altar can see more than three cells; production remains capped.
    state.grid[0][2].specialBlock = state.grid[0][0].specialBlock;
    state.grid[0][0].specialBlock = null;
    for (const [r, c] of [[0, 3], [1, 2], [1, 3]]) Object.assign(state.grid[r][c], {
        placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 1 }
    });
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 3);
    for (const row of state.grid) for (const entry of row) if (!entry.isHQ) {
        if (entry.terrain) entry.terrain.mystic = 0; entry.socketResource = null;
    }
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 0, 'no construction snapshot yield');
    cell.terrain.mystic = 1; assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1);
    state.grid[0][2].specialBlock.state = 'DYSFUNCTIONAL';
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 0);
});
test('positive special-block and converted yields use shared projections; Altars excluded', () => {
    const { state } = setup();
    const cell = state.grid[0][0];
    cell.specialBlock = { type: 'MINE', state: 'ACTIVE', terrainAdjacencyProfile: { e: 1, gl: 1, source: { r: 1, c: 1 } } };
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic'), true);
    cell.specialBlock.state = 'DYSFUNCTIONAL';
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic'), false);
    cell.specialBlock = { type: 'ALTAR', state: 'ACTIVE' };
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic', { excludedDefinitionIds: ['ALTAR'] }), false);
    const land = state.grid[1][1]; land.socketResource = null;
    state.zoneConversionService = { resolveCellProduction: () => ({ status: 'RESOLVED', yields: { mystic: 2 } }) };
    assert.equal(hasCellPositiveProduction(state, land, { r: 1, c: 1 }, 'mystic'), true);
});
test('one creation per Stage and two empty cells between all Altars, including diagonal', () => {
    const { state, service, deck } = setup();
    assert.equal(service.createSpecialBlock('ALTAR', target, paid).success, true);
    Object.assign(state.grid[1][3], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 1 } });
    const far = { source: { r: 1, c: 3 }, destination: { r: 0, c: 3 } };
    assert.equal(service.validateTarget('ALTAR', far).reason, 'STAGE_CREATION_LIMIT');
    state.stage.id = 2;
    assert.equal(service.validateTarget('ALTAR', { source: { r: 1, c: 1 }, destination: { r: 0, c: 2 } }).reason, 'SAME_DEFINITION_TOO_CLOSE');
    assert.equal(service.validateTarget('ALTAR', { source: { r: 1, c: 3 }, destination: { r: 0, c: 3 } }).valid, true);
    assert.equal(deck.isCardEligible(card), true);
    assert.equal(service.createSpecialBlock('ALTAR', far, paid).success, true);
    state.stage.id = 3;
    const nearDiagonal = { source: { r: 1, c: 1 }, destination: { r: 2, c: 2 } };
    assert.equal(service.validateTarget('ALTAR', nearDiagonal).reason, 'SAME_DEFINITION_TOO_CLOSE');
    const farDiagonal = { source: { r: 3, c: 3 }, destination: { r: 4, c: 4 } };
    Object.assign(state.grid[3][3], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 1 } });
    assert.equal(service.validateTarget('ALTAR', farDiagonal).valid, true);
});
for (const mutation of ['source', 'destination', 'nearby', 'stage']) test(`post-payment stale ${mutation} rolls back payment and preserves card/use ledger`, () => {
    const { state, cell, board, deck } = setup();
    const preview = deck.enumerateCardExecutionTargets(card).find(t => t.r === 0 && t.c === 0);
    const create = board.createSpecialBlock.bind(board);
    board.createSpecialBlock = (...args) => {
        assert.deepEqual([state.food, state.wood], [90, 70]);
        if (mutation === 'source') cell.socketResource = null;
        if (mutation === 'destination') state.grid[0][0].placed = true;
        if (mutation === 'nearby') state.grid[0][2].specialBlock = { type: 'ALTAR', state: 'DYSFUNCTIONAL', createdStage: 0 };
        if (mutation === 'stage') state.grid[4][4].specialBlock = { type: 'ALTAR', createdStage: 1 };
        return create(...args);
    };
    assert.equal(deck.playCommandCard(card, preview, 0, -1).success, false);
    assert.deepEqual([state.food, state.wood, state.material], [100, 100, 100]);
    assert.equal(state.grid[0][0].specialBlock, null);
    assert.equal(state.handOffering[0], card);
    assert.equal(state.cardStageUsage['1']?.CMD_ALTAR ?? 0, 0);
});
test('Save/Restore preserves entity, production, stage limit and distance without double production', () => {
    const { state, deck } = setup();
    assert.equal(deck.playCommandCard(card, target, 0, -1).success, true);
    const saved = serializeGameState(state); const restored = {}; hydrateGameState(restored, saved);
    assert.deepEqual(restored.grid[0][0].specialBlock, state.grid[0][0].specialBlock);
    assert.deepEqual(restored.cardStageUsage, state.cardStageUsage);
    for (let i = 0; i < 2; i++) assert.equal(sumSpecialBlockProduction(restored).yields.mystic, 1);
    assert.deepEqual(new SpecialBlockService(restored).enumerateLegalTargets('ALTAR'), []);
    restored.stage.id = 2;
    assert.equal(new SpecialBlockService(restored).validateTarget('ALTAR', { source: { r: 1, c: 1 }, destination: { r: 0, c: 2 } }).reason, 'SAME_DEFINITION_TOO_CLOSE');
});
test('Board click keeps source-bearing target through shared UI', () => {
    const { state, deck } = setup(); let selected;
    const targets = deck.enumerateCardExecutionTargets(card);
    const ui = { state, selectedCard: card, selectedCardIdx: 0, isTrialInteractionActive: () => false,
        commandCardRequiresTarget: () => true, hideCellTooltip() {}, getCommandCardExecutionTargets: () => targets,
        isCommandExecutionTarget: UIController.prototype.isCommandExecutionTarget,
        playCommandCard(_c, _idx, t) { selected = t; return deck.playCommandCard(card, t, 0, -1); } };
    assert.equal(UIController.prototype.onCellClick.call(ui, 0, 0), true);
    assert.deepEqual(selected.source, target.source);
});
console.log(`Altar: ${cases}/${cases} cases PASS`);

// Repeat a disclosed, eligible Stage1 fixture; this measures conditional Offering
// frequency, not the chance of finding suitable mystic sources in a normal run.
{
    const { state, deck } = setup();
    const pool = deck.offeringCandidatePool.build({ stageNum: 1, h2Count: 0, excludedCardIds: [],
        eligibilityOptions: { ignoreCooldown: true } });
    assert.ok(pool.some(c => c.id === card.id));
    const results = [];
    for (const weight of [0.15, 0.25, 0.35]) {
        const candidates = pool.map(c => c.id === card.id ? { ...c, weight } : c);
        const random = new GameplayRandomService(20261005);
        let drawn = 0;
        for (let i = 0; i < 10000; i++) {
            if (pickWeightedCard(candidates, state, () => random.nextFloat())?.id === card.id) drawn++;
        }
        const total = candidates.reduce((n, c) => n + resolveOfferingWeight(c, state), 0);
        results.push({ weight, candidates: candidates.length, expectedDrawShare: weight / total, drawn, samples: 10000 });
    }
    assert.ok(results[0].drawn < results[1].drawn && results[1].drawn < results[2].drawn);
    console.log('ALTAR_WEIGHT_PROBE', JSON.stringify(results));
}
