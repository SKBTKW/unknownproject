import assert from "node:assert/strict";
import {
    resolvePlacementGeometry,
    rotatePlacementClockwise
} from "../placement_geometry.js";
import { serializeGameState } from "../state_serializer.js";
import { hydrateGameState } from "../hydrate_game_state.js";
import { GridEngine } from "../../systems/grid_engine.js";
import { CellViewDataService } from "../../services/cell_view_data_service.js";
import { DeckManager } from "../../systems/deck_manager.js";
import { LAND_CARDS_MASTER } from "../../data/land_cards_data.js";
import { PlacementPreviewResolver } from "../../presentation/placement_preview_resolver.js";
import {
    resolveLandCardCellTerrainId,
    resolveLandCardDisplayName,
    resolveLandCardRarity
} from "../../presentation/land_card_presentation.js";
import { TrialPlanningDraftService } from "../../trial/domain/trial_planning_draft_service.js";
import { TRIAL_PLAN_REASONS } from "../../trial/domain/trial_types.js";

const terrain = (id, e, gl, nameKey = id) => ({
    id,
    terrainId: id,
    nameKey,
    category: "LAND",
    e,
    gl
});

const PLAINS = terrain("GL1_PLAINS", 1, 1, "TERRAIN_PLAINS");
const HILL = terrain("E2_HILL", 2, 1, "TERRAIN_HILL");
const DESERT = terrain("GL0_DESERT", 1, 0, "TERRAIN_DESERT");
const FOREST = terrain("GL2_FOREST", 1, 2, "TERRAIN_FOREST");
const MOUNTAIN = terrain("E3_MOUNTAIN", 3, 0, "TERRAIN_MOUNTAIN");

function createCell(r, c, extra = {}) {
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
        ...extra
    };
}

function createState(size = 5) {
    const center = Math.floor(size / 2);
    const grid = Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) =>
            createCell(r, c, r === center && c === center ? {
                placed: true,
                isHQ: true,
                terrain: { id: "HQ", nameKey: "TERRAIN_HQ", food: 10, wood: 10, defense: 10, mystic: 1 }
            } : {})
        )
    );

    return {
        turn: 1,
        stage: { id: 1, name: "TEST", size },
        grid,
        handOffering: [],
        reserveSlots: [null],
        placementGroupCounter: 1,
        mergeGroupCounter: 1,
        placedBlockCount: 0,
        mergedBlocks: {},
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        cardCooldowns: {},
        usedUniqueCards: [],
        consumedUniqueCards: [],
        ember: 20,
        maxEmber: 20,
        food: 0,
        wood: 0,
        defense: 10,
        currentDefense: 10,
        maxDefense: 10,
        mystic: 0,
        hasPickedThisTurn: false,
        hasReservedThisTurn: false,
        hasMulliganedThisTurn: false,
        addLog() {},
        toastQueue: []
    };
}

function placeExisting(state, r, c, t, placementGroupId = null) {
    Object.assign(state.grid[r][c], {
        placed: true,
        terrain: { ...t },
        placementGroupId
    });
}

const multiCard = {
    id: "CARD_TEST_PLAINS_HILL",
    nameKey: "CARD_TEST_PLAINS_HILL",
    category: "LAND",
    representativeTerrainId: "GL1_PLAINS",
    shape: [[1, 1]],
    anchor: { r: 0, c: 0 },
    cells: [
        { r: 0, c: 0, ...PLAINS },
        { r: 0, c: 1, ...HILL }
    ]
};

const actualMultiCards = [
    LAND_CARDS_MASTER.find(card => card.id === "CARD_MULTI_PLAINS_HILL_1X2"),
    LAND_CARDS_MASTER.find(card => card.id === "CARD_MULTI_PLAINS_FOREST_1X2"),
    LAND_CARDS_MASTER.find(card => card.id === "CARD_MULTI_HILL_MOUNTAIN_1X2")
];

{
    assert.ok(actualMultiCards.every(Boolean));
    assert.deepEqual(actualMultiCards.map(card => card.rarity), ["R", "R", "R"]);
    assert.deepEqual(actualMultiCards.map(card => card.weight), [0.08, 0.08, 0.05]);
    assert.deepEqual(actualMultiCards.map(card => card.minStage), [1, 1, 2]);
    assert.ok(actualMultiCards.every(card => card.multiAttributeProductionReady === false));

    const fakeI18n = {
        t(key) {
            return {
                TERRAIN_PLAINS: "草原",
                TERRAIN_HILL: "丘陵",
                TERRAIN_FOREST: "森",
                TERRAIN_MOUNTAIN: "山岳",
                CARD_MULTI_ATTRIBUTE_SUFFIX: "（複数）"
            }[key] || key;
        }
    };

    assert.equal(resolveLandCardDisplayName({ terrain: actualMultiCards[0] }, fakeI18n), "草原（複数）");
    assert.equal(resolveLandCardDisplayName({ terrain: actualMultiCards[1] }, fakeI18n), "草原（複数）");
    assert.equal(resolveLandCardDisplayName({ terrain: actualMultiCards[2] }, fakeI18n), "丘陵（複数）");
    assert.ok(actualMultiCards.every(card => resolveLandCardRarity({ terrain: card }) === "R"));
}

{
    const state = createState();
    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0.5,
            nextId: () => "diagnostic-card"
        }
    });

    assert.equal(manager.isCardEligible(actualMultiCards[0], 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);

    const productionReadyPlainsHill = {
        ...actualMultiCards[0],
        multiAttributeProductionReady: true
    };
    const productionReadyHillMountain = {
        ...actualMultiCards[2],
        multiAttributeProductionReady: true
    };

    assert.equal(manager.isCardEligible(productionReadyPlainsHill, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), true);
    assert.equal(manager.isCardEligible(productionReadyHillMountain, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);
    assert.equal(manager.isCardEligible(productionReadyHillMountain, 2, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), true);
}

{
    const previewResolver = new PlacementPreviewResolver();
    const previewCard = {
        terrain: actualMultiCards[0],
        currentShape: actualMultiCards[0].shape,
        currentAnchor: actualMultiCards[0].anchor
    };
    const previewState = {
        stage: { size: 5 },
        grid: createState().grid,
        hasPickedThisTurn: false,
        canPlaceShape: () => ({ can: true, reasons: [] })
    };
    const preview = previewResolver.resolveHover(previewCard, previewState, 1, 1);
    assert.deepEqual(
        preview.placement.cells.map(cell => [cell.r, cell.c, cell.terrainId]),
        [[1, 1, "GL1_PLAINS"], [1, 2, "E2_HILL"]]
    );
}

{
    const geometry = resolvePlacementGeometry(multiCard, 1, 1);
    assert.deepEqual(geometry.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]), [
        [0, 0, "GL1_PLAINS"],
        [0, 1, "E2_HILL"]
    ]);

    const once = rotatePlacementClockwise(geometry.shape, geometry.anchor, geometry.attributeCells);
    assert.deepEqual(once.shape, [[1], [1]]);
    assert.deepEqual(once.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]), [
        [0, 0, "GL1_PLAINS"],
        [1, 0, "E2_HILL"]
    ]);

    const twice = rotatePlacementClockwise(once.shape, once.anchor, once.attributeCells);
    assert.deepEqual(twice.shape, [[1, 1]]);
    assert.deepEqual(twice.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]), [
        [0, 1, "GL1_PLAINS"],
        [0, 0, "E2_HILL"]
    ]);
}

{
    const state = createState();
    const grid = new GridEngine(state);
    placeExisting(state, 2, 0, PLAINS, "existing");
    const check = grid.canPlaceShape(1, 0, [[1, 1]], multiCard, [
        { r: 0, c: 0, ...DESERT },
        { r: 0, c: 1, ...FOREST }
    ]);
    assert.equal(check.can, true);
}

{
    const state = createState();
    const grid = new GridEngine(state);
    placeExisting(state, 2, 0, FOREST, "existing");
    const check = grid.canPlaceShape(1, 0, [[1, 1]], multiCard, [
        { r: 0, c: 0, ...DESERT },
        { r: 0, c: 1, ...HILL }
    ]);
    assert.equal(check.can, false);
    assert.ok(check.reasons.includes("INVALID_GL_NEIGHBOR"));
}

{
    const state = createState();
    placeExisting(state, 2, 0, PLAINS, "existing");
    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const cardWithUnresolvedBlockYield = {
        ...multiCard,
        yields: { food: 99, material: 99, defense: 99, mystic: 99 }
    };
    const result = grid.placeShape(1, 0, [[1, 1]], cardWithUnresolvedBlockYield, -1, multiCard.cells);
    assert.equal(result.success, true);

    const plainsCell = state.grid[1][0];
    const hillCell = state.grid[1][1];
    assert.equal(plainsCell.terrain.terrainId, "GL1_PLAINS");
    assert.equal(hillCell.terrain.terrainId, "E2_HILL");
    assert.equal(plainsCell.terrain.yields, undefined);
    assert.equal(hillCell.terrain.yields, undefined);
    assert.equal(plainsCell.placementGroupId, hillCell.placementGroupId);
    assert.ok(plainsCell.placementGroupId);
    assert.ok(plainsCell.mergeGroupId);
    assert.notEqual(hillCell.mergeGroupId, plainsCell.mergeGroupId);
    assert.equal(state.mergeLinks.size, 0);
    assert.equal(state.placedBlockCount, 1);
    assert.equal(grid.getPlacedBlockCount(), 1);
}

{
    const state = createState();
    state.grid[1][0] = createCell(1, 0, {
        placed: true,
        placementGroupId: "place_multi",
        terrain: { ...PLAINS }
    });
    state.grid[1][1] = createCell(1, 1, {
        placed: true,
        placementGroupId: "place_multi",
        terrain: { ...HILL }
    });

    const drafts = new Map();
    const routes = [
        { id: "R1", cells: [{ r: 1, c: 0 }] },
        { id: "R2", cells: [{ r: 1, c: 1 }] }
    ];
    const cellResolver = (r, c) => state.grid[r][c];

    const first = TrialPlanningDraftService.setIntercept(drafts, {
        routeId: "R1",
        interceptCell: { r: 1, c: 0 },
        defenseAllocation: 1,
        availableDefense: 10,
        routes,
        cellResolver
    });
    assert.equal(first.success, true);

    const second = TrialPlanningDraftService.setIntercept(drafts, {
        routeId: "R2",
        interceptCell: { r: 1, c: 1 },
        defenseAllocation: 1,
        availableDefense: 10,
        routes,
        cellResolver
    });
    assert.equal(second.success, false);
    assert.equal(second.reason, TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED);
}

{
    const state = createState();
    const rotated = rotatePlacementClockwise(multiCard.shape, multiCard.anchor, multiCard.cells);
    state.handOffering = [{
        id: "runtime_multi",
        cardMasterId: multiCard.id,
        terrain: multiCard,
        currentShape: rotated.shape,
        currentAnchor: rotated.anchor,
        currentCells: rotated.attributeCells
    }];

    const serialized = serializeGameState(state);
    assert.equal(serialized.handOffering[0].terrainId, null);
    assert.deepEqual(
        serialized.handOffering[0].currentCells.map(cell => [cell.r, cell.c, cell.terrainId]),
        [[0, 0, "GL1_PLAINS"], [1, 0, "E2_HILL"]]
    );

    const restored = {};
    hydrateGameState(restored, serialized, {
        resolveCardMaster: id => id === multiCard.id ? multiCard : null
    });
    assert.deepEqual(
        restored.handOffering[0].currentCells.map(cell => [cell.r, cell.c, cell.terrainId]),
        [[0, 0, "GL1_PLAINS"], [1, 0, "E2_HILL"]]
    );
}

console.log("diagnose_multi_attribute_land_block: PASS");
