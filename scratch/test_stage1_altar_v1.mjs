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
const target = { source: { r: 0, c: 1 }, destination: { r: 1, c: 2 } };
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
    const cell = state.grid[0][1];
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
test('Offering requires public positive mystic, legal HQ-vicinity destination and affordability', () => {
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
test('eight-way source adjacency, HQ-vicinity only and common terrain legality', () => {
    const { state, service, cell } = setup();
    assert.equal(service.validateTarget('ALTAR', target).valid, true, 'diagonal source');
    assert.equal(service.validateTarget('ALTAR', { ...target, destination: { r: 1, c: 1 } }).valid, true, 'orthogonal source');
    for (const destination of [{ r: 0, c: 0 }, { r: 0, c: 2 }]) {
        assert.equal(service.validateTarget('ALTAR', { ...target, destination }).reason, 'DESTINATION_REGION_NOT_ALLOWED');
    }
    assert.equal(service.validateTarget('ALTAR', { ...target, destination: { r: -1, c: 0 } }).valid, false);
    assert.equal(service.validateTarget('ALTAR', { source: { r: 0, c: 1 }, destination: { r: 2, c: 2 } }).valid, false, 'HQ');
    state.grid[1][2].placed = true;
    assert.equal(service.validateTarget('ALTAR', target).reason, 'DESTINATION_OCCUPIED');
    state.grid[1][2].placed = false; state.grid[1][2].specialBlock = { type: 'FARM' };
    assert.equal(service.validateTarget('ALTAR', target).reason, 'DESTINATION_OCCUPIED');
    state.grid[1][2].specialBlock = null;
    Object.assign(state.grid[1][3], { placed: true, terrain: { id: 'E3_MOUNTAIN', e: 3, gl: 0 } });
    assert.equal(service.validateTarget('ALTAR', target).valid, false, 'common mountain restriction');
    state.grid[1][3].placed = false; state.grid[1][3].terrain = null;
    cell.socketResource = null; cell.terrain.mystic = 1;
    assert.equal(service.validateTarget('ALTAR', target).valid, true, 'terrain source');
    cell.terrain.mystic = 0;
    assert.equal(service.validateTarget('ALTAR', target).valid, false, 'HQ mystic alone is excluded');
});
test('all eight source directions are queried with HQ excluded', () => {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const { state, cell, service } = setup();
        cell.socketResource = null;
        const source = { r: 1 + dr, c: 1 + dc };
        const src = state.grid[source.r][source.c];
        if (!src.isHQ) Object.assign(src, { placed:true, terrain:{id:'GL1_PLAINS',e:1,gl:1,mystic:1} });
        assert.equal(service.validateTarget('ALTAR', {source, destination:{r:1,c:1}}).valid, !src.isHQ);
    }
});
test('Stage2 and restored fallback use the current eight-cell vicinity', () => {
    const { state, service } = setup(7);
    Object.assign(state.grid[1][3], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 2 } });
    const t = { source: { r: 1, c: 3 }, destination: { r: 2, c: 3 } };
    assert.equal(service.validateTarget('ALTAR', t).valid, true);
    assert.equal(service.validateTarget('ALTAR', { ...t, destination: { r: 1, c: 2 } }).reason, 'DESTINATION_REGION_NOT_ALLOWED');
    delete state.isHQVicinity;
    assert.equal(service.validateTarget('ALTAR', t).valid, true);
});
test('Offering rejects outer-edge-only targets and enumeration exposes only HQ vicinity', () => {
    const { state, deck } = setup();
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.ok(targets.length > 0);
    assert.ok(targets.every(t => state.isHQVicinity(t.r, t.c) && !state.grid[t.r][t.c].isHQ));
    for (const row of state.grid) for (const cell of row) if (state.isHQVicinity(cell.r, cell.c)) cell.placed = true;
    assert.equal(state.grid[0][2].placed, false, 'old outer-edge destination still empty');
    assert.equal(deck.isCardEligible(card), false);
    assert.deepEqual(deck.enumerateCardExecutionTargets(card), []);
});
test('shared Preview/Commit pays exactly and saves special-only E/GL without zone participation', () => {
    const { state, deck } = setup();
    const targets = deck.enumerateCardExecutionTargets(card);
    assert.ok(targets.some(t => t.r === 1 && t.c === 2));
    assert.deepEqual([state.food, state.wood], [100, 100]);
    assert.equal(deck.playCommandCard(card, targets.find(t => t.r === 1 && t.c === 2), 0, -1).success, true);
    assert.deepEqual([state.food, state.wood, state.material], [90, 70, 70]);
    const altar = state.grid[1][2];
    assert.equal(altar.terrain, null); assert.equal(altar.placed, false);
    assert.deepEqual(readSpecialBlockAdjacencyProfile(altar), { e: 1, gl: 1, source: { r: 0, c: 1 } });
    assert.equal(excludesCellFromZones(altar), true);
    assert.deepEqual(altar.specialBlock.paidCost, { food: 10, wood: 30 });
    assert.equal(altar.specialBlock.createdStage, 1);
    assert.equal(state.cardStageUsage['1'].CMD_ALTAR, 1);
    assert.equal(deck.isCardEligible(card), false);
});
test('dynamic production counts 1/2/3/4 sources once, excludes HQ/ALTAR and retains construction E', () => {
    const { state, cell, service } = setup();
    cell.terrain.e = 0;
    const previews = service.enumerateLegalTargets('ALTAR');
    assert.equal(service.createSpecialBlock('ALTAR', target, paid).success, true);
    const altar = state.grid[1][2].specialBlock;
    assert.equal(altar.terrainAdjacencyProfile.e, 0);
    assert.equal(altar.terrainAdjacencyProfile.gl, 1);
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1);
    cell.terrain.mystic = 10; cell.socketResource.bonusMystic = 20;
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1, 'multiple components still one source');
    const additions = [[0, 2], [0, 3], [1, 3]];
    additions.forEach(([r,c], i) => {
        Object.assign(state.grid[r][c], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 2 } });
        assert.equal(sumSpecialBlockProduction(state).yields.mystic, Math.min(i + 2, 3));
    });
    cell.terrain.mystic = 0; cell.socketResource = null;
    for (const [r,c] of additions.slice(1)) state.grid[r][c].terrain.mystic = 0;
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1, 'source removal');
    state.grid[0][3].terrain.mystic = 1;
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 2, 'source increase');
    assert.equal(altar.terrainAdjacencyProfile.e, 0, 'E fixed after sources change');
    for (const [r,c] of additions) state.grid[r][c].terrain.mystic = 0;
    state.grid[1][1].specialBlock = { type: 'ALTAR', state: 'DYSFUNCTIONAL' };
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 0, 'HQ and ALTAR do not qualify');
    cell.terrain.mystic = 1;
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 1);
    altar.state = 'DYSFUNCTIONAL';
    assert.equal(sumSpecialBlockProduction(state).yields.mystic, 0);
    assert.ok(previews.length > 0);
});
test('multiple source selection is deterministic and Preview exposes inherited E source', () => {
    const { state, service } = setup();
    state.grid[0][1].terrain.e = 0;
    Object.assign(state.grid[0][2], { placed: true, terrain: { id: 'GL1_PLAINS', e: 1, gl: 1, mystic: 2 } });
    const first = service.validateTarget('ALTAR', { r: 1, c: 2 });
    const second = service.validateTarget('ALTAR', { r: 1, c: 2 });
    assert.deepEqual(first.source, { r: 0, c: 1 });
    assert.deepEqual(second.source, first.source);
    assert.equal(first.adjacencyProfile.e, 0);
});
test('positive special-block and converted yields use shared projections; Altars excluded', () => {
    const { state } = setup();
    const cell = state.grid[0][0];
    cell.specialBlock = { type: 'MINE', state: 'ACTIVE', terrainAdjacencyProfile: { e: 1, gl: 1, source: { r: 0, c: 1 } } };
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic'), true);
    cell.specialBlock.state = 'DYSFUNCTIONAL';
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic'), false);
    cell.specialBlock = { type: 'ALTAR', state: 'ACTIVE' };
    assert.equal(hasCellPositiveProduction(state, cell, { r: 0, c: 0 }, 'mystic', { excludedDefinitionIds: ['ALTAR'] }), false);
    const land = state.grid[0][1]; land.socketResource = null;
    state.zoneConversionService = { resolveCellProduction: () => ({ status: 'RESOLVED', yields: { mystic: 2 } }) };
    assert.equal(hasCellPositiveProduction(state, land, { r: 0, c: 1 }, 'mystic'), true);
});
test('Stage usage remains per Stage while vicinity spacing prevents a second Altar', () => {
    const { state, service, deck } = setup();
    assert.equal(service.createSpecialBlock('ALTAR', target, paid).success, true);
    state.stage.id = 2;
    assert.deepEqual(service.enumerateLegalTargets('ALTAR'), []);
    assert.equal(deck.isCardEligible(card), false);
    assert.equal(definition.placement.maxCreationsPerStage, 1);
    assert.equal(definition.placement.minimumSameDefinitionDistance, 3);
    for (const destination of [{r:1,c:1}, {r:3,c:2}, {r:3,c:0}]) {
        assert.equal(service.validateTarget('ALTAR', { source: target.source, destination }).reason, 'SAME_DEFINITION_TOO_CLOSE');
    }
    const far = service.validateTarget('ALTAR', {source:{r:0,c:1}, destination:{r:1,c:5}});
    assert.equal(far.reason, 'DESTINATION_NOT_ADJACENT', 'distance 3 passes spacing; source adjacency fails separately');
    // A retained old exterior Altar at distance 3 may coexist: no new global cap or migration.
    state.grid[1][2].specialBlock = null;
    state.grid[4][2].specialBlock = { type:'ALTAR', state:'ACTIVE', createdStage:1 };
    assert.equal(service.validateTarget('ALTAR', target).valid, true);
    state.stage.id = 1;
    assert.equal(service.validateTarget('ALTAR', target).reason, 'STAGE_CREATION_LIMIT');
});
for (const mutation of ['source', 'destination', 'nearby', 'stage']) test(`post-payment stale ${mutation} rolls back payment and preserves card/use ledger`, () => {
    const { state, cell, board, deck } = setup();
    const preview = deck.enumerateCardExecutionTargets(card).find(t => t.r === 1 && t.c === 2);
    const create = board.createSpecialBlock.bind(board);
    board.createSpecialBlock = (...args) => {
        assert.deepEqual([state.food, state.wood], [90, 70]);
        if (mutation === 'source') cell.socketResource = null;
        if (mutation === 'destination') state.grid[1][2].placed = true;
        if (mutation === 'nearby') state.grid[0][2].specialBlock = { type: 'ALTAR', state: 'DYSFUNCTIONAL', createdStage: 0 };
        if (mutation === 'stage') state.grid[4][4].specialBlock = { type: 'ALTAR', createdStage: 1 };
        return create(...args);
    };
    assert.equal(deck.playCommandCard(card, preview, 0, -1).success, false);
    assert.deepEqual([state.food, state.wood, state.material], [100, 100, 100]);
    assert.equal(state.grid[1][2].specialBlock, null);
    assert.equal(state.handOffering[0], card);
    assert.equal(state.cardStageUsage['1']?.CMD_ALTAR ?? 0, 0);
});
test('Save/Restore preserves entity, production, stage limit and distance without double production', () => {
    const { state, deck, cell } = setup();
    cell.terrain.e = 0;
    assert.equal(deck.playCommandCard(card, target, 0, -1).success, true);
    const saved = serializeGameState(state); const restored = {}; hydrateGameState(restored, saved);
    assert.deepEqual(restored.grid[1][2].specialBlock, state.grid[1][2].specialBlock);
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
    assert.equal(UIController.prototype.onCellClick.call(ui, 1, 2), true);
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
