import assert from 'node:assert/strict';

import { BoardDomainAdapter } from '../board_domain_adapter.js';
import {
    BASE_TERRAIN_INTERACTIONS,
    BOARD_CAPABILITIES,
    SPECIAL_BLOCK_TYPES,
    getSpecialBlockDefinition
} from '../special_block_domain.js';
import { GridEngine } from '../../systems/grid_engine.js';
import { SpecialBlockService } from '../../systems/special_block_service.js';
import { TrialTerrainEffectResolver } from '../../trial/systems/trial_terrain_effect_resolver.js';
import { TRIAL_TERRAIN_EFFECTS } from '../../trial/domain/trial_types.js';
import { serializeGameState } from '../state_serializer_base.js';
import { hydrateGameState } from '../hydrate_game_state_base.js';
import { GameEngine } from '../game_engine.js';

function cell(r, c, overrides = {}) {
    return {
        r,
        c,
        placed: false,
        isHQ: false,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId: null,
        terrain: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {},
        ...overrides
    };
}

function state5() {
    const grid = Array.from({ length: 5 }, (_, r) =>
        Array.from({ length: 5 }, (_, c) => cell(r, c))
    );
    grid[2][2] = cell(2, 2, {
        placed: true,
        isHQ: true,
        terrain: {
            id: 'HQ',
            terrainId: 'HQ',
            food: 10,
            wood: 10,
            defense: 10,
            mystic: 1,
            e: 1,
            gl: 1
        }
    });
    const state = {
        turn: 4,
        grid,
        stage: { id: 1, name: 'Stage 1', size: 5, maxTiles: 24 },
        placementGroupCounter: 1,
        mergeGroupCounter: 1,
        placedBlockCount: 0,
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        roadEdges: new Set(),
        handOffering: [],
        reserveSlots: [],
        placedBlockProduction: {},
        food: 50,
        wood: 30,
        material: 30,
        ember: 20,
        maxEmber: 20,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 0
    };
    return state;
}

const PLAINS = {
    id: 'GL1_PLAINS',
    terrainId: 'GL1_PLAINS',
    category: 'LAND',
    e: 1,
    gl: 1,
    shape: [[1]]
};
const HILL = {
    id: 'E2_HILL',
    terrainId: 'E2_HILL',
    category: 'LAND',
    e: 2,
    gl: 1,
    shape: [[1]]
};
const WETLAND = {
    id: 'E0_WETLAND',
    terrainId: 'E0_WETLAND',
    category: 'LAND',
    e: 0,
    gl: 2,
    shape: [[1]]
};
const FOREST = {
    id: 'GL2_FOREST',
    terrainId: 'GL2_FOREST',
    category: 'LAND',
    e: 1,
    gl: 2,
    shape: [[1]]
};
const MOUNTAIN = {
    id: 'E3_MOUNTAIN',
    terrainId: 'E3_MOUNTAIN',
    category: 'LAND',
    e: 3,
    gl: 1,
    shape: [[1]]
};

console.log('Board / Special Block / Defense v1 contract');

{
    let rngCalls = 0;
    const state = state5();
    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => { rngCalls += 1; return 0.5; } }
    });
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    const board = new BoardDomainAdapter({ state, gridEngine: grid });

    const before = JSON.stringify(serializeGameState(state));
    assert.equal(board.hasAnyLegalLandPlacement(WETLAND), false);
    const after = JSON.stringify(serializeGameState(state));
    assert.equal(after, before, 'LAND legality query must not mutate board state');
    assert.equal(rngCalls, 0, 'LAND legality query must not consume gameplay RNG');
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    const board = new BoardDomainAdapter({ state, gridEngine: grid });
    const multi = {
        id: 'TEST_MULTI',
        category: 'LAND',
        currentShape: [[1, 1]],
        currentAnchor: { r: 0, c: 1 },
        currentCells: [
            { r: 0, c: 0, ...PLAINS },
            { r: 0, c: 1, ...HILL }
        ]
    };
    assert.equal(board.hasAnyLegalLandPlacement(multi), true);
    const legal = board.enumerateLegalLandPlacements(multi);
    assert.ok(legal.some(entry => entry.placement.attributeCells?.length === 2));
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[1][2] = cell(1, 2, {
        placed: true,
        placementGroupId: 'mountain-base',
        terrain: { ...MOUNTAIN }
    });

    const service = new SpecialBlockService(state);
    const validation = service.validateTarget(SPECIAL_BLOCK_TYPES.PALISADE, { r: 1, c: 2 });
    assert.equal(validation.valid, true);

    const beforeTerrain = JSON.stringify(state.grid[1][2].terrain);
    const created = service.createSpecialBlock(
        SPECIAL_BLOCK_TYPES.PALISADE,
        { r: 1, c: 2 },
        { orientation: 'N', verse: 4 }
    );
    assert.equal(created.success, true);
    assert.equal(JSON.stringify(state.grid[1][2].terrain), beforeTerrain, 'terrain-using overlay keeps Base Terrain');
    assert.ok(created.capabilities.includes(BOARD_CAPABILITIES.MILITARY_SITE));
    assert.equal(created.trialTraits.interceptionAllowed, true);
    assert.equal(created.trialTraits.suppressTerrainTactic, true);

    const trial = new TrialTerrainEffectResolver();
    const resolved = trial.resolve({
        interceptCell: {
            ...state.grid[1][2],
            elevation: 3,
            cellId: '1:2'
        },
        approachCell: {
            ...cell(1, 1, { placed: true, terrain: { ...PLAINS } }),
            elevation: 1,
            cellId: '1:1'
        }
    });
    assert.equal(resolved.canIntercept, true, 'Special Block may make its cell interceptable');
    assert.equal(
        resolved.modifiers.some(modifier => modifier.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND),
        false,
        'suppressTerrainTactic prevents Base Terrain high-ground tactic'
    );
    assert.equal(state.grid[1][2].terrain.terrainId, 'E3_MOUNTAIN', 'Trial trait read does not rewrite terrain');
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    const service = new SpecialBlockService(state);

    state.grid[0][0] = cell(0, 0, { placed: true, terrain: { ...WETLAND } });
    assert.equal(
        service.readCapabilities({ r: 0, c: 0 }).has(BOARD_CAPABILITIES.WATER_SOURCE),
        true
    );
    assert.equal(
        service.readCapabilities({ r: 2, c: 2 }).has(BOARD_CAPABILITIES.MYSTIC_SOURCE),
        false,
        'HQ mystic production is not MYSTIC_SOURCE'
    );

    state.grid[0][1] = cell(0, 1, {
        placed: true,
        terrain: { ...PLAINS, capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE] }
    });
    state.grid[0][2] = cell(0, 2, { placed: true, terrain: { ...PLAINS } });
    const altar = service.createSpecialBlock(SPECIAL_BLOCK_TYPES.ALTAR, { r: 0, c: 2 });
    assert.equal(altar.success, true);
    assert.equal(
        service.readCapabilities({ r: 0, c: 2 }).has(BOARD_CAPABILITIES.MYSTIC_SOURCE),
        false,
        'ALTAR never becomes its own MYSTIC_SOURCE'
    );
}

{
    const farm = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.FARM);
    assert.equal(farm.baseTerrainInteraction.kind, BASE_TERRAIN_INTERACTIONS.INDEPENDENT);
    assert.deepEqual(farm.placement.sourceTerrainIds, ['GL1_PLAINS']);
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[1][2] = cell(1, 2, {
        placed: true,
        placementGroupId: 'forest-a',
        terrain: { ...FOREST }
    });
    state.grid[1][1] = cell(1, 1, {
        placed: true,
        placementGroupId: 'forest-b',
        terrain: { ...FOREST }
    });
    const service = new SpecialBlockService(state);
    const targets = service.enumerateLegalTargets(SPECIAL_BLOCK_TYPES.LOGGING_CAMP);
    const target = targets.find(entry => entry.r === 1 && entry.c === 2);
    assert.equal(target?.sourceClusterSize, 2);
    const logging = service.createSpecialBlock(SPECIAL_BLOCK_TYPES.LOGGING_CAMP, { r: 1, c: 2 });
    assert.equal(logging.success, true);
    assert.equal(state.grid[1][2].terrain.gl, 1);
    assert.equal(state.grid[1][1].terrain.gl, 2, 'selected-cell transform does not destroy source cluster');
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[1][2] = cell(1, 2, {
        placed: true,
        placementGroupId: 'pal-save',
        terrain: { ...PLAINS }
    });
    const service = new SpecialBlockService(state);
    assert.equal(
        service.createSpecialBlock(SPECIAL_BLOCK_TYPES.PALISADE, { r: 1, c: 2 }, { orientation: 'E' }).success,
        true
    );

    const serialized = serializeGameState(state);
    assert.equal(serialized.grid[1][2].specialBlock.type, SPECIAL_BLOCK_TYPES.PALISADE);
    const restored = {};
    hydrateGameState(restored, serialized);
    assert.equal(restored.grid[1][2].specialBlock.orientation, 'E');
    assert.equal(restored.grid[1][2].terrain.terrainId, 'GL1_PLAINS');
}

{
    const engine = GameEngine.createGame({ runSeed: 260923 });
    assert.ok(engine.specialBlockService, 'GameEngine exposes SpecialBlockService');
    assert.ok(engine.boardDomainAdapter, 'GameEngine exposes BoardDomainAdapter');
    assert.equal(engine.state.specialBlockService, engine.specialBlockService);
    assert.equal(engine.state.boardDomainAdapter, engine.boardDomainAdapter);
    assert.equal(
        typeof engine.boardDomainAdapter.hasAnyLegalLandPlacement,
        'function',
        'Card Core can consume the live Board query boundary'
    );
    assert.equal(
        typeof engine.boardDomainAdapter.readCapabilities,
        'function',
        'other domains can consume the live Board capability read boundary'
    );
}

console.log('diagnose_board_special_block_defense_v1: PASS');
