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
import { TrialCombatResolver } from '../../trial/systems/trial_combat_resolver.js';
import { createBattleContext } from '../../trial/domain/battle_context.js';
import { TrialController } from '../../trial/flow/trial_controller_base.js';
import { TRIAL_TERRAIN_EFFECTS } from '../../trial/domain/trial_types.js';
import { serializeGameState } from '../state_serializer_base.js';
import { hydrateGameState } from '../hydrate_game_state_base.js';
import { GameEngine } from '../game_engine.js';
import { GameFactHub, GAME_FACT_TYPES } from '../game_fact.js';
import { BoardBattleSiteRecorder } from '../board_battle_site_recorder.js';
import { BoardHistoryQuery } from '../board_history_query.js';
import {
    SPECIAL_BLOCK_PRODUCTION_KINDS,
    SPECIAL_BLOCK_PRODUCTION_STATUS,
    SPECIAL_BLOCK_RELATION_NEIGHBORHOODS,
    SPECIAL_BLOCK_SOURCE_SIZE_SOURCES,
    SpecialBlockProductionResolver,
    sumSpecialBlockProduction
} from '../special_block_production.js';
import { CellViewDataService } from '../../services/cell_view_data_service.js';
import {
    DISPLAY_ROLE,
    BoardPresentationSemanticService,
    resolveBoardDisplayProduction
} from '../../presentation/board_presentation_semantic_service.js';

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

    const normalized = createBattleContext({
        interceptCell: state.grid[1][2],
        approachCell: cell(0, 2, { placed: true, terrain: { ...PLAINS } }),
        allocatedDefense: 1,
        baseInterceptionPower: 5,
        enemySuppression: 5
    });
    assert.equal(
        normalized.interceptCell.specialBlock?.type,
        SPECIAL_BLOCK_TYPES.PALISADE,
        'BattleContext preserves Special Block identity'
    );
    assert.equal(normalized.interceptCell.row, 1);
    assert.equal(normalized.interceptCell.column, 2);

    const directional = new TrialTerrainEffectResolver({
        palisadeDirectionalMultiplier: 1.25
    }).resolve(normalized);
    const palisadeTactic = directional.specialTactics.find(
        tactic => tactic.id === 'PALISADE_DIRECTIONAL_DEFENSE'
    );
    assert.equal(palisadeTactic?.active, true);
    assert.equal(palisadeTactic?.orientation, 'N');
    assert.equal(palisadeTactic?.approachDirection, 'N');
    assert.equal(palisadeTactic?.defenseMultiplier, 1.25);
    assert.equal(
        directional.modifiers.some(modifier =>
            modifier.source === 'PALISADE_DIRECTIONAL_DEFENSE'
            && modifier.target === 'HUMAN_INTERCEPTION'
            && modifier.value === 1.25
        ),
        true,
        'injected PALISADE multiplier becomes a normal Trial modifier'
    );

    const combat = new TrialCombatResolver({
        terrainResolver: new TrialTerrainEffectResolver({
            palisadeDirectionalMultiplier: 1.25
        })
    }).resolve(normalized);
    assert.equal(combat.success, true);
    assert.equal(combat.human.basePower, 5);
    assert.equal(combat.human.finalPower, 6.25);
    assert.equal(
        combat.appliedModifiers.some(modifier =>
            modifier.source === 'PALISADE_DIRECTIONAL_DEFENSE'
        ),
        true,
        'PALISADE direction modifier reaches combat calculation'
    );

    const wrongDirection = new TrialTerrainEffectResolver({
        palisadeDirectionalMultiplier: 1.25
    }).resolve(createBattleContext({
        interceptCell: state.grid[1][2],
        approachCell: cell(1, 1, { placed: true, terrain: { ...PLAINS } }),
        allocatedDefense: 1,
        baseInterceptionPower: 5,
        enemySuppression: 5
    }));
    assert.equal(
        wrongDirection.specialTactics.find(
            tactic => tactic.id === 'PALISADE_DIRECTIONAL_DEFENSE'
        )?.active,
        false,
        'PALISADE does not apply from a non-facing approach'
    );
    assert.equal(
        wrongDirection.modifiers.some(modifier => modifier.source === 'PALISADE_DIRECTIONAL_DEFENSE'),
        false
    );
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[0][0] = cell(0, 0, {
        placed: true,
        placementGroupId: 'forest-earthwork',
        terrain: { ...FOREST }
    });
    state.grid[0][1] = cell(0, 1, {
        placed: true,
        placementGroupId: 'approach',
        terrain: { ...PLAINS }
    });

    const service = new SpecialBlockService(state);
    const earthwork = service.createSpecialBlock(
        SPECIAL_BLOCK_TYPES.EARTHWORK,
        { r: 0, c: 0 }
    );
    assert.equal(earthwork.success, true);
    assert.equal(earthwork.trialTraits.interceptionAllowed, true);
    assert.equal(
        earthwork.trialTraits.suppressTerrainTactic,
        false,
        'EARTHWORK preserves Base Terrain tactics'
    );

    const unresolvedEarthwork = new TrialTerrainEffectResolver().resolve(
        createBattleContext({
            interceptCell: state.grid[0][0],
            approachCell: state.grid[0][1],
            allocatedDefense: 1,
            baseInterceptionPower: 5,
            enemySuppression: 5
        })
    );
    assert.equal(
        unresolvedEarthwork.specialTactics.find(
            tactic => tactic.id === 'EARTHWORK_DEFENSE'
        )?.active,
        true
    );
    assert.equal(
        unresolvedEarthwork.modifiers.some(
            modifier => modifier.source === 'EARTHWORK_DEFENSE'
        ),
        false,
        'EARTHWORK adds no numeric modifier until a balance value is provided'
    );
    assert.equal(
        unresolvedEarthwork.modifiers.some(
            modifier => modifier.source === TRIAL_TERRAIN_EFFECTS.FOREST_DEPLOYMENT
        ),
        true,
        'EARTHWORK does not erase the underlying forest tactic'
    );

    const injectedEarthwork = new TrialCombatResolver({
        terrainResolver: new TrialTerrainEffectResolver({
            earthworkDefenseMultiplier: 1.2
        })
    }).resolve(createBattleContext({
        interceptCell: state.grid[0][0],
        approachCell: state.grid[0][1],
        allocatedDefense: 1,
        baseInterceptionPower: 5,
        enemySuppression: 5
    }));
    assert.equal(injectedEarthwork.success, true);
    assert.equal(
        injectedEarthwork.appliedModifiers.some(
            modifier => modifier.source === 'EARTHWORK_DEFENSE'
        ),
        true
    );
}

{
    const watchtower = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.WATCHTOWER);
    assert.deepEqual(
        watchtower.capabilities,
        [BOARD_CAPABILITIES.OBSERVATION_SITE],
        'WATCHTOWER exports observation only; Investigation decides how to consume it'
    );
    assert.equal(watchtower.trialTraits.interceptionAllowed, null);
    assert.equal(watchtower.trialTraits.specialTactics.length, 0);
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
        terrain: { ...PLAINS, capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE] },
        socketResource: {
            id: 'TEST_MYSTIC_SOCKET',
            capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE],
            bonusMystic: 2
        }
    });
    state.grid[0][2] = cell(0, 2, { placed: true, terrain: { ...PLAINS } });

    const serializedCapabilities = serializeGameState(state);
    const restoredCapabilities = {};
    hydrateGameState(restoredCapabilities, serializedCapabilities);
    const restoredService = new SpecialBlockService(restoredCapabilities);
    assert.equal(
        restoredService.readCapabilities({ r: 0, c: 1 }).has(BOARD_CAPABILITIES.MYSTIC_SOURCE),
        true,
        'terrain/socket capability survives save/restore'
    );

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
    state.grid[1][1] = cell(1, 1, {
        placed: true,
        placementGroupId: 'isolated-plains',
        terrain: { ...PLAINS }
    });
    const service = new SpecialBlockService(state);
    const farmTargets = service.enumerateLegalTargets(SPECIAL_BLOCK_TYPES.FARM);
    assert.ok(
        farmTargets.some(entry =>
            entry.source.r === 1 && entry.source.c === 1
            && entry.destination.r === 1 && entry.destination.c === 2
        ),
        'isolated 1x1 plains exposes adjacent empty FARM destination'
    );
    assert.equal(
        service.validateTarget(SPECIAL_BLOCK_TYPES.FARM, {
            source: { r: 1, c: 1 },
            destination: { r: 1, c: 2 }
        }).valid,
        true
    );
    const farmCreated = service.createSpecialBlock(SPECIAL_BLOCK_TYPES.FARM, {
        source: { r: 1, c: 1 },
        destination: { r: 1, c: 2 }
    });
    assert.equal(farmCreated.success, true);
    assert.equal(farmCreated.specialOnly, true);
    assert.equal(state.grid[1][2].placed, false, 'FARM does not become base terrain');
    assert.equal(state.grid[1][2].terrain, null, 'FARM does not invent terrain semantics');
    assert.equal(state.grid[1][2].specialBlock.type, SPECIAL_BLOCK_TYPES.FARM);

    const occupiedLandCheck = grid.canPlaceShape(
        1, 2, [[1]], { ...PLAINS }, null
    );
    assert.equal(
        occupiedLandCheck.can,
        false,
        'LAND placement cannot overwrite a Special-only cell'
    );
    assert.ok(occupiedLandCheck.reasons.includes('ALREADY_PLACED'));

    const farmView = new CellViewDataService().getCellViewData(state, 1, 2);
    assert.equal(farmView.placed, false);
    assert.equal(farmView.occupied, true);
    assert.equal(farmView.occupancy, 'SPECIAL_ONLY');
    assert.equal(farmView.specialBlock?.type, SPECIAL_BLOCK_TYPES.FARM);
    assert.equal(farmView.terrainId, null);

    const semanticService = new BoardPresentationSemanticService({
        cellViewDataService: new CellViewDataService()
    });
    assert.equal(
        semanticService.getDisplayRole(state, farmView),
        DISPLAY_ROLE.SPECIAL_BLOCK,
        'Special-only FARM is a first-class presentation role'
    );
    assert.deepEqual(
        semanticService.getDisplayProduction(state, farmView),
        { food: 0, wood: 0, defense: 0, mystic: 0, primaryYield: null },
        'unresolved FARM production stays neutral in presentation'
    );

    const serializedFarm = serializeGameState(state);
    const restoredFarm = {};
    hydrateGameState(restoredFarm, serializedFarm);
    assert.equal(restoredFarm.grid[1][2].placed, false);
    assert.equal(restoredFarm.grid[1][2].terrain, null);
    assert.equal(restoredFarm.grid[1][2].specialBlock.type, SPECIAL_BLOCK_TYPES.FARM);

    const farmTrial = new TrialTerrainEffectResolver().resolve({
        interceptCell: {
            ...state.grid[1][2],
            elevation: null,
            cellId: '1:2'
        },
        approachCell: {
            ...cell(1, 1, { placed: true, terrain: { ...PLAINS } }),
            elevation: 1,
            cellId: '1:1'
        }
    });
    assert.equal(
        farmTrial.canIntercept,
        false,
        'Special-only FARM does not gain interception permission implicitly'
    );

    const controller = new TrialController();
    controller.state = {
        routes: [{
            id: 'farm-route',
            cells: [{ r: 1, c: 1 }, { r: 1, c: 2 }]
        }]
    };
    controller.cellResolver = (r, c) => state.grid?.[r]?.[c] || null;
    const farmInterceptionInput = controller.createRouteInterceptionInput(
        'farm-route',
        { r: 1, c: 2 },
        1
    );
    assert.equal(
        farmInterceptionInput.success,
        false,
        'Special-only FARM remains non-interceptable without an explicit Trial trait'
    );

    const specialOnlyMilitary = cell(1, 2, {
        specialBlock: {
            type: SPECIAL_BLOCK_TYPES.PALISADE,
            definitionId: SPECIAL_BLOCK_TYPES.PALISADE,
            orientation: 'N',
            state: 'ACTIVE'
        }
    });
    controller.cellResolver = (r, c) => {
        if (r === 1 && c === 2) return specialOnlyMilitary;
        return state.grid?.[r]?.[c] || null;
    };
    const explicitSpecialInterception = controller.createRouteInterceptionInput(
        'farm-route',
        { r: 1, c: 2 },
        1
    );
    assert.equal(
        explicitSpecialInterception.success,
        true,
        'TrialController honors an explicit Special Block interception trait'
    );
    assert.equal(
        farmTrial.modifiers.some(modifier => modifier.source === TRIAL_TERRAIN_EFFECTS.HIGH_GROUND),
        false,
        'Special-only FARM never invents a terrain elevation tactic'
    );

    state.grid[1][2] = cell(1, 2, {
        placed: true,
        placementGroupId: 'connected-plains',
        terrain: { ...PLAINS }
    });
    assert.equal(
        service.validateTarget(SPECIAL_BLOCK_TYPES.FARM, {
            source: { r: 1, c: 1 },
            destination: { r: 0, c: 1 }
        }).reason,
        'SOURCE_TERRAIN_NOT_ISOLATED',
        'connected 1x2+ plains cannot be a FARM source'
    );
}

{
    const state = state5();
    state.grid[0][0] = cell(0, 0, {
        placed: true,
        merged: true,
        mergeGroupId: 'zone-special',
        placementGroupId: 'land-special',
        terrain: { ...PLAINS }
    });
    state.mergedBlocks = {
        'zone-special': {
            cells: [{ r: 0, c: 0 }],
            yieldMultiplier: 1.2
        }
    };
    const facts = {
        r: 0,
        c: 0,
        placed: true,
        isHQ: false,
        terrainId: PLAINS.terrainId,
        mergeGroupId: 'zone-special',
        placementGroupId: 'land-special'
    };
    const fakeCellView = {
        getCellViewData() {
            return {
                baseYields: { food: 10, wood: 0, defense: 0, mystic: 0 },
                modifiers: [
                    { type: 'SPECIAL_BLOCK', resource: 'food', amount: 5 }
                ],
                specialBlock: {
                    yields: { food: 5, wood: 0, defense: 0, mystic: 0 }
                }
            };
        }
    };
    const shown = resolveBoardDisplayProduction(state, facts, fakeCellView);
    assert.equal(
        shown.food,
        17,
        'Special Block production is added after Zone multiplier: floor(10*1.2)+5'
    );
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
    assert.equal(target?.sourceGroupKind, 'CONNECTED_TERRAIN_CLUSTER');
    assert.equal(target?.sourceGroupId, null);

    const logging = service.createSpecialBlock(SPECIAL_BLOCK_TYPES.LOGGING_CAMP, { r: 1, c: 2 });
    assert.equal(logging.success, true);
    assert.equal(logging.sourceGroup.kind, 'CONNECTED_TERRAIN_CLUSTER');
    assert.equal(logging.sourceGroup.size, 2);
    assert.equal(
        state.grid[1][2].terrain.gl,
        2,
        'LOGGING_CAMP preserves canonical Base Terrain GL'
    );
    assert.equal(
        state.grid[1][2].terrain.terrainId,
        'GL2_FOREST',
        'LOGGING_CAMP preserves canonical Base Terrain identity'
    );
    assert.deepEqual(
        state.grid[1][2].specialBlock.baseTerrainEffect,
        { glDelta: -1, sourceGL: 2 }
    );
    const board = new BoardDomainAdapter({ state, gridEngine: grid, specialBlockService: service });
    assert.equal(
        board.readEffectiveGreenery({ r: 1, c: 2 }),
        1,
        'Board effective greenery reflects LOGGING_CAMP GL-1'
    );
    assert.equal(
        new CellViewDataService().getCellViewData(state, 1, 2).greenery,
        1,
        'presentation reads effective greenery without rewriting terrain'
    );
    assert.equal(state.grid[1][1].terrain.gl, 2, 'selected-cell effect does not destroy source cluster');

    const legacyLoggingCell = cell(0, 0, {
        placed: true,
        terrain: { ...FOREST, gl: 1 },
        specialBlock: {
            type: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
            definitionId: SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
            state: 'ACTIVE'
        }
    });
    assert.equal(
        new BoardDomainAdapter({
            state: { grid: [[legacyLoggingCell]] },
            gridEngine: null
        }).readEffectiveGreenery({ r: 0, c: 0 }),
        1,
        'legacy saves with already-materialized GL-1 are not decremented twice'
    );
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);

    state.grid[0][0] = cell(0, 0, {
        placed: true,
        merged: true,
        mergeGroupId: 'forest-zone',
        placementGroupId: 'forest-zone-a',
        terrain: { ...FOREST }
    });
    state.grid[0][1] = cell(0, 1, {
        placed: true,
        merged: true,
        mergeGroupId: 'forest-zone',
        placementGroupId: 'forest-zone-b',
        terrain: { ...FOREST }
    });
    state.grid[1][0] = cell(1, 0, {
        placed: true,
        merged: true,
        mergeGroupId: 'forest-zone',
        placementGroupId: 'forest-zone-c',
        terrain: { ...FOREST }
    });
    state.grid[1][1] = cell(1, 1, {
        placed: true,
        merged: true,
        mergeGroupId: 'forest-zone',
        placementGroupId: 'forest-zone-d',
        terrain: { ...FOREST }
    });

    // Deliberately stale/incomplete summary data: source membership must follow
    // live cell.mergeGroupId, not mergedBlocks[group].cells.
    state.mergedBlocks = {
        'forest-zone': {
            groupId: 'forest-zone',
            terrainId: 'GL2_FOREST',
            mergeType: '2x2',
            cells: [{ r: 0, c: 0 }]
        }
    };

    const service = new SpecialBlockService(state);
    const group = service.resolveSourceGroup(
        { r: 0, c: 0 },
        getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.LOGGING_CAMP)
    );
    assert.equal(group.kind, 'MERGE_GROUP');
    assert.equal(group.groupId, 'forest-zone');
    assert.equal(group.cells.length, 4, 'live mergeGroupId membership is canonical');

    const zoneLogging = service.createSpecialBlock(
        SPECIAL_BLOCK_TYPES.LOGGING_CAMP,
        { r: 0, c: 0 }
    );
    assert.equal(zoneLogging.success, true);
    assert.equal(zoneLogging.entity.sourceGroupReference.kind, 'MERGE_GROUP');
    assert.equal(zoneLogging.entity.sourceGroupReference.groupId, 'forest-zone');
    assert.equal(zoneLogging.entity.sourceGroupReference.initialSize, 4);
    assert.equal(zoneLogging.entity.sourceGroupReference.cells.length, 4);

    const serializedLogging = serializeGameState(state);
    const restoredLogging = {};
    hydrateGameState(restoredLogging, serializedLogging);
    assert.equal(
        restoredLogging.grid[0][0].specialBlock.sourceGroupReference.initialSize,
        4,
        'source group reference survives save/restore'
    );
    assert.equal(
        restoredLogging.grid[0][0].terrain.gl,
        2,
        'save/restore keeps canonical Base Terrain GL'
    );
    assert.equal(
        new BoardDomainAdapter({ state: restoredLogging, gridEngine: null })
            .readEffectiveGreenery({ r: 0, c: 0 }),
        1,
        'save/restore preserves effective LOGGING_CAMP GL modifier'
    );

    // An unzoned forest adjacent to a zoned forest stays in its own fallback
    // connected cluster instead of silently joining the Zone source.
    state.grid[2][0] = cell(2, 0, {
        placed: true,
        placementGroupId: 'raw-forest',
        terrain: { ...FOREST }
    });
    const raw = service.resolveSourceGroup(
        { r: 2, c: 0 },
        getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.LOGGING_CAMP)
    );
    assert.equal(raw.kind, 'CONNECTED_TERRAIN_CLUSTER');
    assert.equal(raw.groupId, null);
    assert.equal(raw.cells.length, 1);
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
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[0][0] = cell(0, 0, {
        placed: true,
        placementGroupId: 'mine-prod',
        terrain: { ...HILL }
    });
    const service = new SpecialBlockService(state);
    const created = service.createSpecialBlock(SPECIAL_BLOCK_TYPES.MINE, { r: 0, c: 0 });
    assert.equal(created.success, true);
    const production = sumSpecialBlockProduction(state);
    assert.deepEqual(
        production.yields,
        { food: 0, wood: 0, defense: 0, mystic: 0 },
        'unresolved Special Block production never invents numeric output'
    );
    assert.equal(production.unresolved.length, 1);
    assert.equal(production.unresolved[0].type, SPECIAL_BLOCK_TYPES.MINE);
}

{
    const state = state5();
    const grid = new GridEngine(state);
    state.isHQVicinity = grid.isHQVicinity.bind(grid);
    state.grid[0][0] = cell(0, 0, {
        placed: true,
        placementGroupId: 'battle-site-special',
        terrain: { ...PLAINS }
    });

    const service = new SpecialBlockService(state);
    const earthwork = service.createSpecialBlock(
        SPECIAL_BLOCK_TYPES.EARTHWORK,
        { r: 0, c: 0 }
    );
    assert.equal(earthwork.success, true);

    const specialBefore = JSON.stringify(state.grid[0][0].specialBlock);
    const hub = new GameFactHub();
    const recorder = new BoardBattleSiteRecorder({ gameFactHub: hub, state });
    const history = new BoardHistoryQuery({ state });

    hub.emit(GAME_FACT_TYPES.TRIAL_BATTLE_RESOLVED, {
        scenarioId: 'SPECIAL_BLOCK_BATTLE',
        trialIndex: 1,
        battleIndex: 0,
        routeId: 'ROUTE_SPECIAL',
        interceptCell: { r: 0, c: 0 },
        outcome: 'REPEL',
        playerActualPower: 10,
        enemyActualPower: 8,
        margin: 2
    });
    hub.emit(GAME_FACT_TYPES.TRIAL_RESULT_SETTLED, {
        scenarioId: 'SPECIAL_BLOCK_BATTLE',
        trialIndex: 1,
        turn: 15,
        outcome: 'SURVIVED'
    });

    assert.equal(history.hasBattleSite({ trialIndex: 1 }), true);
    assert.equal(
        JSON.stringify(state.grid[0][0].specialBlock),
        specialBefore,
        'settled Battle Site history coexists with Special Block without mutating facility state'
    );
    assert.equal(state.grid[0][0].entities?.length, 1);
    recorder.dispose();
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

{
    const definitions = new Map([
        ['TEST_SOURCE_SIZE', {
            id: 'TEST_SOURCE_SIZE',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_SIZE,
                sourceSizeSource: SPECIAL_BLOCK_SOURCE_SIZE_SOURCES.INITIAL_SNAPSHOT,
                perSourceYields: { wood: 2 }
            }
        }],
        ['TEST_RELATION', {
            id: 'TEST_RELATION',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT,
                relationCapability: BOARD_CAPABILITIES.MYSTIC_SOURCE,
                relationNeighborhood: SPECIAL_BLOCK_RELATION_NEIGHBORHOODS.ORTHOGONAL,
                perRelationYields: { mystic: 1 },
                maxRelations: 3
            }
        }],
        ['TEST_RELATION_INCOMPLETE', {
            id: 'TEST_RELATION_INCOMPLETE',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT,
                relationCapability: BOARD_CAPABILITIES.MYSTIC_SOURCE,
                perRelationYields: { mystic: 1 }
            }
        }],
        ['TEST_CONDITIONAL', {
            id: 'TEST_CONDITIONAL',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.CONDITIONAL,
                strategyKey: 'HILL_BONUS'
            }
        }],
        ['TEST_FIXED_INVALID', {
            id: 'TEST_FIXED_INVALID',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.FIXED,
                yields: { wood: '4' }
            }
        }],
        ['TEST_FIXED_NEGATIVE', {
            id: 'TEST_FIXED_NEGATIVE',
            production: {
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                kind: SPECIAL_BLOCK_PRODUCTION_KINDS.FIXED,
                yields: { wood: -1 }
            }
        }]
    ]);
    const resolver = new SpecialBlockProductionResolver({
        definitionResolver: id => definitions.get(id) || null,
        strategies: {
            HILL_BONUS: ({ cell }) => ({
                status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
                yields: cell?.terrain?.terrainId === 'E2_HILL'
                    ? { wood: 4 }
                    : { wood: 0 }
            })
        }
    });

    const sourceState = state5();
    sourceState.grid[0][0] = cell(0, 0, {
        specialBlock: {
            type: 'TEST_SOURCE_SIZE',
            definitionId: 'TEST_SOURCE_SIZE',
            sourceGroupReference: { initialSize: 4 }
        }
    });
    assert.deepEqual(
        resolver.resolveCell(sourceState, sourceState.grid[0][0], { r: 0, c: 0 }),
        {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: { food: 0, wood: 8, defense: 0, mystic: 0 },
            kind: SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_SIZE
        },
        'SOURCE_SIZE resolves only from explicit per-source yields and source snapshot size'
    );

    definitions.set('TEST_SOURCE_SIZE_UNSPECIFIED', {
        id: 'TEST_SOURCE_SIZE_UNSPECIFIED',
        production: {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            kind: SPECIAL_BLOCK_PRODUCTION_KINDS.SOURCE_SIZE,
            perSourceYields: { wood: 2 }
        }
    });
    sourceState.grid[0][1] = cell(0, 1, {
        specialBlock: {
            type: 'TEST_SOURCE_SIZE_UNSPECIFIED',
            definitionId: 'TEST_SOURCE_SIZE_UNSPECIFIED',
            sourceGroupReference: { initialSize: 4 }
        }
    });
    assert.equal(
        resolver.resolveCell(sourceState, sourceState.grid[0][1], { r: 0, c: 1 }).status,
        SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
        'SOURCE_SIZE fails closed until the source-size authority is explicit'
    );

    const relationState = state5();
    relationState.grid[1][1] = cell(1, 1, {
        specialBlock: {
            type: 'TEST_RELATION',
            definitionId: 'TEST_RELATION'
        }
    });
    relationState.grid[0][1] = cell(0, 1, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    relationState.grid[2][1] = cell(2, 1, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    relationState.grid[1][0] = cell(1, 0, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    relationState.grid[1][2] = cell(1, 2, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    assert.deepEqual(
        resolver.resolveCell(relationState, relationState.grid[1][1], { r: 1, c: 1 }),
        {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            yields: { food: 0, wood: 0, defense: 0, mystic: 3 },
            kind: SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT
        },
        'RELATION_COUNT respects explicit neighborhood, capability and maxRelations'
    );

    definitions.set('TEST_RELATION_NULL_CAP', {
        id: 'TEST_RELATION_NULL_CAP',
        production: {
            status: SPECIAL_BLOCK_PRODUCTION_STATUS.RESOLVED,
            kind: SPECIAL_BLOCK_PRODUCTION_KINDS.RELATION_COUNT,
            relationCapability: BOARD_CAPABILITIES.MYSTIC_SOURCE,
            relationNeighborhood: SPECIAL_BLOCK_RELATION_NEIGHBORHOODS.ORTHOGONAL,
            perRelationYields: { mystic: 1 },
            maxRelations: null
        }
    });
    relationState.grid[3][1] = cell(3, 1, {
        specialBlock: {
            type: 'TEST_RELATION_NULL_CAP',
            definitionId: 'TEST_RELATION_NULL_CAP'
        }
    });
    relationState.grid[2][1] = cell(2, 1, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    relationState.grid[4][1] = cell(4, 1, {
        capabilities: [BOARD_CAPABILITIES.MYSTIC_SOURCE]
    });
    assert.equal(
        resolver.resolveCell(relationState, relationState.grid[3][1], { r: 3, c: 1 }).yields.mystic,
        2,
        'null maxRelations means no explicit cap rather than a zero cap'
    );

    relationState.grid[3][3] = cell(3, 3, {
        specialBlock: {
            type: 'TEST_RELATION_INCOMPLETE',
            definitionId: 'TEST_RELATION_INCOMPLETE'
        }
    });
    assert.equal(
        resolver.resolveCell(relationState, relationState.grid[3][3], { r: 3, c: 3 }).status,
        SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
        'RELATION_COUNT fails closed when neighborhood semantics are unspecified'
    );

    relationState.grid[0][0] = cell(0, 0, {
        placed: true,
        terrain: { ...HILL },
        specialBlock: {
            type: 'TEST_CONDITIONAL',
            definitionId: 'TEST_CONDITIONAL'
        }
    });
    assert.equal(
        resolver.resolveCell(relationState, relationState.grid[0][0], { r: 0, c: 0 }).yields.wood,
        4,
        'CONDITIONAL remains an injected strategy boundary rather than facility-id branching'
    );

    const runtimeState = state5();
    runtimeState.grid[0][0] = cell(0, 0, {
        placed: true,
        terrain: { ...HILL },
        specialBlock: {
            type: 'TEST_CONDITIONAL',
            definitionId: 'TEST_CONDITIONAL'
        }
    });
    runtimeState.specialBlockProductionResolver = resolver;
    assert.deepEqual(
        sumSpecialBlockProduction(runtimeState).yields,
        { food: 0, wood: 4, defense: 0, mystic: 0 },
        'ProductionCalculator-facing helper honors an injected runtime resolver'
    );

    relationState.grid[0][3] = cell(0, 3, {
        specialBlock: {
            type: 'TEST_FIXED_INVALID',
            definitionId: 'TEST_FIXED_INVALID'
        }
    });
    assert.equal(
        resolver.resolveCell(relationState, relationState.grid[0][3], { r: 0, c: 3 }).status,
        SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
        'numeric strings in production definitions fail closed instead of being coerced'
    );

    relationState.grid[0][4] = cell(0, 4, {
        specialBlock: {
            type: 'TEST_FIXED_NEGATIVE',
            definitionId: 'TEST_FIXED_NEGATIVE'
        }
    });
    assert.equal(
        resolver.resolveCell(relationState, relationState.grid[0][4], { r: 0, c: 4 }).status,
        SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
        'negative production definitions fail closed'
    );

    sourceState.grid[0][2] = cell(0, 2, {
        specialBlock: {
            type: 'TEST_SOURCE_SIZE',
            definitionId: 'TEST_SOURCE_SIZE',
            sourceGroupReference: { initialSize: 2.5 }
        }
    });
    assert.equal(
        resolver.resolveCell(sourceState, sourceState.grid[0][2], { r: 0, c: 2 }).status,
        SPECIAL_BLOCK_PRODUCTION_STATUS.UNRESOLVED,
        'SOURCE_SIZE requires an integer source snapshot size'
    );
}

{
    const logging = getSpecialBlockDefinition(SPECIAL_BLOCK_TYPES.LOGGING_CAMP);
    assert.equal(Object.isFrozen(logging), true);
    assert.equal(Object.isFrozen(logging.placement), true);
    assert.equal(Object.isFrozen(logging.placement.terrainIds), true);
    assert.equal(Object.isFrozen(logging.production), true);
    assert.equal(Object.isFrozen(logging.lifecycle), true);
    assert.equal(Object.isFrozen(logging.capabilities), true);
    assert.equal(Object.isFrozen(logging.trialTraits), true);
    assert.equal(Object.isFrozen(logging.trialTraits.specialTactics), true);
}

console.log('diagnose_board_special_block_defense_v1: PASS');
