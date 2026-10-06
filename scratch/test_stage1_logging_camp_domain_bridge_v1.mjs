import { UIController } from '../game/src/ui/ui_controller.js';
import { SpecialBlockService } from '../game/src/systems/special_block_service.js';
import { GridEngine } from '../game/src/systems/grid_engine.js';
import { readSpecialBlockAdjacencyProfile, validateTerrainAgainstSpecialBlockAdjacency } from '../game/src/core/special_block_domain.js';
import { createBattleContext } from '../game/src/trial/domain/battle_context.js';
import { serializeGameState } from '../game/src/core/state_serializer_base.js';
import { hydrateGameState } from '../game/src/core/hydrate_game_state_base.js';
import assert from "node:assert/strict";

import { createCardDomainActionExecutor } from "../game/src/cards/card_domain_action_executor.js";
import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import {
    SPECIAL_BLOCK_COST_STATUS,
    SPECIAL_BLOCK_TYPES,
    getSpecialBlockDefinition
} from "../game/src/core/special_block_domain.js";
import { COMMAND_CARDS_MASTER } from "../game/src/data/command_cards_data.js";
import { SpecialBlockProductionResolver } from "../game/src/core/special_block_production.js";
import { DeckManager } from "../game/src/systems/deck_manager.js";
import { attachCardRuntimePolicy } from "../game/src/systems/card_runtime_policy.js";

console.log("\nStage1 Logging Camp Domain Bridge v2");

function cell(r, c, terrain = null) {
    return {
        r, c,
        placed: Boolean(terrain),
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        terrain,
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

function listSpecialBlocks(state, definitionId) {
    const rows = [];
    for (let r = 0; r < (state?.grid?.length || 0); r++) {
        for (let c = 0; c < (state.grid[r]?.length || 0); c++) {
            const entity = state.grid[r][c]?.specialBlock;
            if ((entity?.definitionId || entity?.type) === definitionId) rows.push({ r, c, entity });
        }
    }
    return rows;
}

const forest = {
    id: "GL2_FOREST",
    terrainId: "GL2_FOREST",
    zoneCategory: "FOREST",
    gl: 2,
    e: 1,
    food: 2,
    wood: 2,
    material: 2,
    defense: 2,
    mystic: 0
};

const grid = [
    [cell(0, 0, forest), cell(0, 1, forest), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)]
];

// Two separately placed 1x1 GL2+ lands may intentionally form the required pair.
grid[0][0].placementGroupId = "place_a";
grid[0][1].placementGroupId = "place_b";

const loggingCard = COMMAND_CARDS_MASTER.find(card => card.id === "CMD_LOGGING_CAMP");
assert.ok(loggingCard);
assert.deepEqual(loggingCard.cost, {});
assert.equal(loggingCard.reqForestNearby, undefined);
assert.deepEqual(loggingCard.offering?.requirements, [{
    type: "CONNECTED_GL_AT_LEAST",
    minimumGL: 2,
    value: 2
}]);
assert.deepEqual(loggingCard.effects, [{
    type: "DOMAIN_ACTION",
    action: "CREATE_SPECIAL_BLOCK",
    blockType: "LOGGING_CAMP",
    paymentMode: "DOMAIN_QUOTE",
    logActivation: true
}]);

const loggingDefinition = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.LOGGING_CAMP);
assert.equal(loggingDefinition.placement.mode, "INDEPENDENT_CELL_GENERATION");
assert.equal(loggingDefinition.placement.sourceMinGL, 2);
assert.equal(loggingDefinition.placement.minConnectedSourceCells, 2);
assert.equal(loggingDefinition.baseTerrainInteraction.kind, "INDEPENDENT");
assert.equal(loggingDefinition.production.kind, "RELATION_COUNT");
assert.equal(loggingDefinition.creationCost.status, SPECIAL_BLOCK_COST_STATUS.RESOLVED);
assert.deepEqual(loggingDefinition.creationCost.resources, { wood: 20 });
assert.equal(loggingDefinition.production.status, "RESOLVED");
assert.deepEqual(loggingDefinition.production.baseYields, { wood: 0 });
assert.deepEqual(loggingDefinition.production.perRelationYields, { wood: 2 });
assert.equal(loggingDefinition.production.relationMinGL, 2);
assert.equal(loggingDefinition.production.relationNeighborhood, "ORTHOGONAL");

// Canonical Logging Camp geometry: an empty destination adjacent to either cell
// of an orthogonally connected GL2+ source pair. Placement-group identity is
// deliberately irrelevant, so two 1x1 cards can create the pair over two Verses.
{
    const state = {
        turn: 6,
        stage: { id: 1 },
        food: 50,
        wood: 50,
        material: 50,
        defense: 5,
        mystic: 0,
        ember: 10,
        grid,
        handOffering: [],
        reserveSlots: [null],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        addLog() {}
    };
    const boardDomainAdapter = new BoardDomainAdapter({ state });

    assert.equal(
        boardDomainAdapter.hasConnectedTerrainGLAtLeast(2, { minimum: 2 }),
        true,
        "two adjacent GL2+ lands must satisfy the Offering board predicate"
    );

    const legalBoardTargets = boardDomainAdapter.enumerateLegalSpecialBlockTargets(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        { verse: state.turn, cardId: loggingCard.id }
    );
    assert.ok(legalBoardTargets.length > 0, "connected GL2+ pair must expose adjacent empty build sites");
    assert.ok(
        legalBoardTargets.some(target =>
            target.destination?.r === 1 && target.destination?.c === 0
        ),
        "an empty grid cardinally adjacent to the connected source pair must be legal"
    );
    assert.ok(
        legalBoardTargets.every(target => target.sourceClusterSize >= 2),
        "every Logging Camp target must be backed by a connected GL2+ source cluster"
    );

    const engine = {
        state,
        boardDomainAdapter,
        cardRuntimeActivationProvider: () => ({ activeCardIds: [loggingCard.id] })
    };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    assert.equal(attachCardRuntimePolicy(deck).success, true);

    const quote = deck.quoteCardExecutionCost(loggingCard);
    assert.equal(quote.success, true);
    assert.deepEqual(quote.resources, { wood: 20 });
    assert.equal(quote.quote?.status, SPECIAL_BLOCK_COST_STATUS.RESOLVED);

    const executionTargets = deck.enumerateCardExecutionTargets(loggingCard);
    assert.ok(executionTargets.length > 0);

    state.handOffering = [loggingCard];
    state.hasPickedThisTurn = false;
    const beforeWood = state.wood;
    const played = deck.playCommandCard(loggingCard, executionTargets[0], 0, -1);
    assert.equal(played.success, true);
    assert.equal(state.wood, beforeWood - 20);
    assert.equal(state.material, state.wood);

    const production = new SpecialBlockProductionResolver().sum(state);
    assert.equal(production.unresolved.length, 0);
    assert.equal(production.yields.wood, 2, "single active Logging Camp produces base +2 material");

    const built = listSpecialBlocks(state, SPECIAL_BLOCK_TYPES.LOGGING_CAMP)[0];
    built.entity.state = "DAMAGED";
    const damagedProduction = new SpecialBlockProductionResolver().sum(state);
    assert.equal(damagedProduction.yields.wood, 0, "damaged Logging Camp production must stop");
    built.entity.state = "ACTIVE";
}

// A single GL2+ source cell is not enough.
{
    const state = {
        grid: [
            [cell(0, 0, forest), cell(0, 1)],
            [cell(1, 0), cell(1, 1)]
        ]
    };
    const board = new BoardDomainAdapter({ state });
    assert.equal(board.hasConnectedTerrainGLAtLeast(2, { minimum: 2 }), false);
    assert.deepEqual(
        board.enumerateLegalSpecialBlockTargets(SPECIAL_BLOCK_TYPES.LOGGING_CAMP),
        []
    );
}

// Diagonal GL2+ cells do not count as a connected 1x2 source pair.
{
    const state = {
        grid: [
            [cell(0, 0, forest), cell(0, 1)],
            [cell(1, 0), cell(1, 1, forest)]
        ]
    };
    const board = new BoardDomainAdapter({ state });
    assert.equal(board.hasConnectedTerrainGLAtLeast(2, { minimum: 2 }), false);
    assert.deepEqual(
        board.enumerateLegalSpecialBlockTargets(SPECIAL_BLOCK_TYPES.LOGGING_CAMP),
        []
    );
}

// The generic Special Block DOMAIN_QUOTE bridge becomes executable once Board supplies
// a resolved quote. Payment is atomic and the exact paid cost is forwarded to Board.
{
    const card = {
        id: "TEST_BOARD_QUOTED_SPECIAL_BLOCK",
        category: "COMMAND",
        nameKey: "TEST_BOARD_QUOTED_SPECIAL_BLOCK",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_SPECIAL_BLOCK",
            blockType: "TEST_BLOCK",
            paymentMode: "DOMAIN_QUOTE",
            logActivation: true
        }]
    };
    const state = {
        turn: 7,
        stage: { id: 1 },
        food: 20,
        wood: 10,
        material: 10,
        defense: 5,
        mystic: 2,
        ember: 3,
        grid: [[cell(0, 0, forest)]],
        handOffering: [card],
        reserveSlots: [null],
        activeBuffs: [],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        hasPickedThisTurn: false,
        logs: [],
        addLog(message) { this.logs.push(message); }
    };

    let createContext = null;
    const board = {
        quoteSpecialBlockCost(type) {
            assert.equal(type, "TEST_BLOCK");
            return {
                status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
                resources: { wood: 6, ember: 1 }
            };
        },
        enumerateLegalSpecialBlockTargets() {
            return [{ r: 0, c: 0 }];
        },
        validateSpecialBlockTarget() {
            return { valid: true, reason: null };
        },
        validateSpecialBlockTargetAfterPayment(type, target, payment) {
            assert.equal(type, "TEST_BLOCK");
            assert.deepEqual(target, { r: 0, c: 0 });
            assert.deepEqual(payment, { wood: 6, ember: 1 });
            return { valid: true, reason: null };
        },
        createSpecialBlock(type, target, context) {
            assert.equal(type, "TEST_BLOCK");
            assert.deepEqual(target, { r: 0, c: 0 });
            createContext = { ...context, paidCost: { ...(context.paidCost || {}) } };
            return {
                success: true,
                entity: { id: "TEST_BLOCK", paidCost: { ...(context.paidCost || {}) } }
            };
        }
    };

    const engine = { state, boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    deck.cycleSystem = null;

    assert.deepEqual(deck.quoteCardExecutionCost(card), {
        success: true,
        resources: { wood: 6, ember: 1 },
        source: "DOMAIN_QUOTE",
        quote: {
            status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
            resources: { wood: 6, ember: 1 }
        }
    });

    assert.deepEqual(deck.enumerateCardExecutionTargets(card), [{
        r: 0,
        c: 0,
        cost: { wood: 6, ember: 1 }
    }]);

    const result = deck.playCommandCard(card, { r: 0, c: 0 }, 0, -1);
    assert.equal(result.success, true);
    assert.equal(state.wood, 4);
    assert.equal(state.material, 4);
    assert.equal(state.ember, 2);
    assert.equal(state.handOffering[0]?.isBlank, true);
    assert.equal(state.hasPickedThisTurn, true);
    assert.equal(createContext.paymentConfirmed, true);
    assert.deepEqual(createContext.paidCost, { wood: 6, ember: 1 });
}

// Stale commit quote must fail after DeckManager payment and trigger its rollback.
{
    const card = {
        id: "TEST_STALE_SPECIAL_BLOCK",
        category: "COMMAND",
        cost: {},
        effects: [{
            type: "DOMAIN_ACTION",
            action: "CREATE_SPECIAL_BLOCK",
            blockType: "TEST_BLOCK",
            paymentMode: "DOMAIN_QUOTE"
        }]
    };
    const state = {
        turn: 8,
        food: 20,
        wood: 10,
        material: 10,
        mystic: 0,
        ember: 3,
        grid: [[cell(0, 0, forest)]],
        handOffering: [card],
        reserveSlots: [null],
        consumedUniqueCards: [],
        usedUniqueCards: [],
        hasPickedThisTurn: false,
        addLog() {}
    };
    let quoteReads = 0;
    let creates = 0;
    const board = {
        quoteSpecialBlockCost() {
            quoteReads += 1;
            const wood = quoteReads >= 3 ? 7 : 6;
            return {
                status: SPECIAL_BLOCK_COST_STATUS.RESOLVED,
                resources: { wood, ember: 1 }
            };
        },
        enumerateLegalSpecialBlockTargets() {
            return [{ r: 0, c: 0 }];
        },
        validateSpecialBlockTargetAfterPayment() {
            return { valid: true };
        },
        validateSpecialBlockTarget() {
            return { valid: true };
        },
        createSpecialBlock() {
            creates += 1;
            return { success: true };
        }
    };
    const engine = { state, boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    deck.cycleSystem = null;

    const before = { wood: state.wood, material: state.material, ember: state.ember };
    const result = deck.playCommandCard(card, { r: 0, c: 0 }, 0, -1);
    assert.equal(result.success, false);
    assert.equal(result.reason, "SPECIAL_BLOCK_QUOTE_STALE");
    assert.deepEqual(
        { wood: state.wood, material: state.material, ember: state.ember },
        before,
        "stale Special Block quote must rollback payment exactly"
    );
    assert.equal(state.handOffering[0], card);
    assert.equal(state.hasPickedThisTurn, false);
    assert.equal(creates, 0);
}

// RELATION_COUNT can target the same Special Block definition without counting
// unrelated production facilities.
{
    const resolvedLoggingDefinition = {
        id: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        production: {
            kind: "RELATION_COUNT",
            status: "RESOLVED",
            relationDefinitionId: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
            relationNeighborhood: "ORTHOGONAL",
            baseYields: { wood: 2 },
            perRelationYields: { wood: 1 }
        }
    };
    const resolver = new SpecialBlockProductionResolver({
        definitionResolver: () => resolvedLoggingDefinition
    });
    const productionState = {
        grid: [[cell(0, 0), cell(0, 1), cell(0, 2)]]
    };
    productionState.grid[0][0].specialBlock = {
        definitionId: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        state: "ACTIVE"
    };
    productionState.grid[0][1].specialBlock = {
        definitionId: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        state: "ACTIVE"
    };
    productionState.grid[0][2].specialBlock = {
        definitionId: SPECIAL_BLOCK_TYPES.FARM,
        state: "ACTIVE"
    };

    const resolved = resolver.resolveCell(
        productionState,
        productionState.grid[0][0],
        { r: 0, c: 0 }
    );
    assert.equal(resolved.status, "RESOLVED");
    assert.deepEqual(resolved.yields, {
        food: 0,
        wood: 3,
        defense: 0,
        mystic: 0
    });
}

console.log("  connected GL2+ pair -> adjacent empty-grid Logging Camp geometry is canonical");
console.log("  resolved Board quote exposes Logging Camp and charges atomically");
console.log("  resolved Board quote pays atomically and forwards paidCost");
console.log("  stale Special Block quote rolls payment back");
console.log("  same-definition orthogonal adjacency scales production without counting other facilities");
console.log("✅ Stage1 Logging Camp Domain Bridge v2 PASS");

// Settled sawmill semantics: mixed, unzoned forest; automatic maximum E;
// dynamic cell-count production; shared forests; immutable persisted axes.
{
    const state = { turn: 6, stage: { id: 1, size: 5 }, food: 50, wood: 100,
        material: 100, defense: 5, mystic: 0, ember: 10,
        grid: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => cell(r, c))),
        handOffering: [], reserveSlots: [null], activeBuffs: [], consumedUniqueCards: [], usedUniqueCards: [], addLog() {} };
    const setForest = (r, c, gl, e) => {
        const id = gl === 3 ? 'GL3_DEEP_FOREST' : 'GL2_FOREST';
        state.grid[r][c] = cell(r, c, { ...forest, id, terrainId: id, gl, e });
    };
    setForest(1, 2, 2, 1);
    setForest(1, 3, 3, 1);
    setForest(2, 3, 3, 2);
    const service = new SpecialBlockService(state);
    const board = new BoardDomainAdapter({ state, specialBlockService: service });
    const engine = { state, boardDomainAdapter: board };
    engine.cardDomainActionExecutor = createCardDomainActionExecutor(engine);
    const deck = new DeckManager(state, engine);
    engine.deckManager = deck;
    attachCardRuntimePolicy(deck);
    const type = SPECIAL_BLOCK_TYPES.LOGGING_CAMP;
    const target = { source: { r: 1, c: 2 }, destination: { r: 2, c: 2 } };
    const checked = service.validateTarget(type, target);
    assert.equal(checked.valid, true, 'mixed GL2/GL3, no zoning, can build beside GL3');
    assert.equal(checked.adjacencyProfile.e, 2, 'maximum adjacent E overrides supplied source');
    assert.deepEqual(checked.source, { r: 2, c: 3 });
    assert.equal(service.enumerateLegalTargets(type).filter(t => t.destination.r === 2 && t.destination.c === 2).length, 1);
    assert.equal(deck.offeringEligibility.evaluate(loggingCard, { boardQuery: board }).eligible, true);
    assert.equal(service.validateTarget(type, { r: 2, c: 2 }).valid, true, 'destination alone selects its source automatically');
    const ui = { engine: { getCommandCardExecutionTargets: card => deck.enumerateCardExecutionTargets(card) } };
    ui.getCommandCardExecutionTargets = UIController.prototype.getCommandCardExecutionTargets;
    assert.equal(UIController.prototype.isCommandExecutionTarget.call(ui, loggingCard, 2, 2), true,
        'production UI can highlight and select the destination');


    // The automatically inherited maximum E must pass every adjacent edge.
    state.grid[3][2] = cell(3, 2, { id: 'E0_WETLAND', terrainId: 'E0_WETLAND', gl: 1, e: 0 });
    const blocked = service.validateTarget(type, target);
    assert.equal(blocked.valid, false);
    assert.equal(blocked.adjacencyProfile.e, 2);
    assert.ok(blocked.reasons.includes('WETLAND_HILL_NEIGHBOR'));
    state.grid[3][2] = cell(3, 2);

    const payment = { paymentConfirmed: true, paidCost: { wood: 20 } };
    state.handOffering = [loggingCard];
    state.hasPickedThisTurn = false;
    const beforePayment = state.wood;
    const created = deck.playCommandCard(loggingCard, { r: 2, c: 2 }, 0, -1);
    assert.equal(state.wood, beforePayment - 20, 'UI destination-only path pays once');
    assert.equal(created.success, true);
    const resolver = new SpecialBlockProductionResolver();
    const yieldAt = () => resolver.resolveCell(state, state.grid[2][2], { r: 2, c: 2 }).yields.wood;
    assert.equal(yieldAt(), 4, 'two adjacent forest cells, not the whole source cluster');
    setForest(3, 2, 2, 2);
    assert.equal(yieldAt(), 6);
    setForest(2, 1, 3, 2);
    assert.equal(yieldAt(), 8, 'four orthogonal qualifying cells give maximum output');
    assert.equal(service.createSpecialBlock(type, {
        source: { r: 2, c: 3 }, destination: { r: 3, c: 3 }
    }, payment).success, true, 'forest can serve multiple sawmills');
    assert.equal(resolver.sum(state).yields.wood, 12);
    state.grid[2][1].terrain.gl = 1;
    assert.equal(yieldAt(), 6, 'GL1 no longer contributes');
    state.grid[3][2] = cell(3, 2);
    assert.equal(yieldAt(), 4, 'removing a source cell updates output');
    const axes = readSpecialBlockAdjacencyProfile(state.grid[2][2]);
    assert.equal(axes.e, 2);
    assert.equal(axes.gl, 1);
    assert.equal(validateTerrainAgainstSpecialBlockAdjacency({ ...forest, gl: 3, terrainId: 'GL3_DEEP_FOREST' }, axes).valid, true);
    assert.equal(validateTerrainAgainstSpecialBlockAdjacency({ ...forest, gl: 3, terrainId: 'GL3_DEEP_FOREST' }, { e: 2, gl: 1 }).valid, false,
        'other facilities keep the GL rule');
    const gridEngine = new GridEngine(state);
    assert.equal(gridEngine.canPlaceShape(3, 2, [[1]], { ...forest, e: 2, gl: 3, id: 'GL3_DEEP_FOREST', terrainId: 'GL3_DEEP_FOREST' }, null).can, true,
        'future GL3 LAND placement honors the same sawmill edge exception');
    const trial = createBattleContext({ interceptCell: state.grid[2][2], approachCell: state.grid[2][3] });
    assert.equal(trial.interceptCell.elevation, 2);
    assert.equal(trial.interceptCell.growthLevel, 1);
    assert.equal(board.readTrialDeploymentFacts({ r: 2, c: 2 }).terrain.growthLevel, 1);
    const overlay = cell(0, 0, { ...forest, e: 2, gl: 3 });
    overlay.specialBlock = { definitionId: 'MINE', terrainAdjacencyProfile: { e: 2, gl: 1 }, state: 'ACTIVE' };
    const overlayTrial = createBattleContext({ interceptCell: overlay });
    assert.equal(overlayTrial.interceptCell.elevation, 2);
    assert.equal(overlayTrial.interceptCell.growthLevel, 1, 'overlay Trial uses facility GL1, not base terrain GL3');

    const restored = {};
    hydrateGameState(restored, serializeGameState(state));
    assert.deepEqual(readSpecialBlockAdjacencyProfile(restored.grid[2][2]), axes);
    assert.equal(resolver.sum(restored).yields.wood, resolver.sum(state).yields.wood);

    // A qualifying pair alone must not expose an unplaceable Offering.
    for (const row of state.grid) for (const entry of row) {
        if (!entry.placed && !entry.specialBlock) Object.assign(entry, cell(entry.r, entry.c, { ...forest, gl: 1 }));
    }
    assert.equal(board.hasConnectedTerrainGLAtLeast(2), true);
    assert.equal(deck.offeringEligibility.evaluate(loggingCard, { boardQuery: board }).eligible, false);
    assert.equal(service.enumerateLegalTargets(type).length, 0);
}
console.log('✅ Sawmill mixed forest / max E / legal Offering / dynamic yield / Trial / restore PASS');
