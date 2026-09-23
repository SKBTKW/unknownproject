import assert from "node:assert/strict";
import fs from "node:fs";
import {
    resolvePlacementGeometry,
    rotatePlacementClockwise,
    validatePlacementAttributeMap
} from "../placement_geometry.js";
import { serializeGameState } from "../state_serializer.js";
import { hydrateGameState } from "../hydrate_game_state.js";
import { GridEngine } from "../../systems/grid_engine.js";
import { GameState } from "../../v2_unity_ready_main.js";
import { ConditionEvaluator } from "../condition_evaluator.js";
import { ProductionCalculator } from "../../systems/production_calculator.js";
import { DefenseSystem } from "../../systems/defense_system.js";
import { ZoneConversionService } from "../../systems/zone_conversion_service.js";
import { UndoLandSystem } from "../../systems/undo_land_system.js";
import { CellViewDataService } from "../../services/cell_view_data_service.js";
import { DeckManager, OFFERING_GENERATION_REASONS } from "../../systems/deck_manager.js";
import { LAND_CARDS_MASTER } from "../../data/land_cards_data.js";
import {
    LAND_SYSTEM_DATA,
    isCanonicalTerrainId
} from "../../data/land_system.js";
import { PlacementPreviewResolver } from "../../presentation/placement_preview_resolver.js";
import { drawWeb25DPlacementPreview } from "../../presentation/web25d_placement_preview_renderer.js";
import { resolveWeb25DTerrainTopFill } from "../../presentation/web25d_canvas_renderer.js";
import {
    resolveBoardDisplayProduction,
    resolveBoardDisplayRole
} from "../../presentation/board_presentation_semantic_service.js";
import {
    resolveLandCardCellTerrainId,
    resolveLandCardDisplayName,
    resolveLandCardRarity
} from "../../presentation/land_card_presentation.js";
import { TrialPlanningDraftService } from "../../trial/domain/trial_planning_draft_service.js";
import { TrialTerrainEffectResolver } from "../../trial/systems/trial_terrain_effect_resolver.js";
import { TRIAL_PLAN_REASONS } from "../../trial/domain/trial_types.js";
import { ZONE_CONVERSION_COST_STATUS } from "../zone_conversion_domain.js";
import {
    LAND_CELL_YIELD_SOURCE,
    LAND_PRODUCTION_SCOPE,
    LAND_PRODUCTION_STATUS,
    normalizeProductionContract,
    resolveCardProductionPreview,
    sumPlacedBlockProduction
} from "../land_production_contract.js";

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
        placedBlockProduction: {},
        isHQVicinity(r, c) {
            const center = Math.floor(size / 2);
            return !(r === center && c === center)
                && Math.abs(r - center) <= 1
                && Math.abs(c - center) <= 1;
        },
        // This diagnostic isolates Multi-Attribute production eligibility.
        // Offering now always asks the Placement Domain, so the fixture must
        // explicitly model a board with at least one legal placement.
        canPlaceShape() {
            return { can: true, reasons: [] };
        },
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

const landSystemJson = JSON.parse(
    fs.readFileSync(new URL("../../data/land_system.json", import.meta.url), "utf8")
);

{
    assert.ok(actualMultiCards.every(Boolean));
    assert.deepEqual(actualMultiCards.map(card => card.rarity), ["R", "R", "R"]);
    assert.deepEqual(actualMultiCards.map(card => card.weight), [0.08, 0.08, 0.05]);
    assert.deepEqual(actualMultiCards.map(card => card.minStage), [1, 1, 2]);
    assert.ok(actualMultiCards.every(card =>
        card.productionContract?.status === LAND_PRODUCTION_STATUS.RESOLVED
        && card.productionContract?.scope === LAND_PRODUCTION_SCOPE.CELL
        && card.productionContract?.cellYieldSource === LAND_CELL_YIELD_SOURCE.CANONICAL_TERRAIN
    ));
    assert.deepEqual(
        actualMultiCards.map(card => resolveCardProductionPreview({ terrain: card }).totalYields),
        [
            { food: 6, wood: 1, defense: 1, mystic: 0 },
            { food: 6, wood: 2, defense: 2, mystic: 0 },
            { food: 2, wood: 4, defense: 6, mystic: 1 }
        ]
    );
    for (const card of actualMultiCards) {
        const mapValidation = validatePlacementAttributeMap(card.shape, card.cells);
        assert.equal(mapValidation.valid, true);
        assert.ok(card.cells.every(cell => isCanonicalTerrainId(cell.terrainId)));
    }

    const referencedTerrainIds = new Set(
        actualMultiCards.flatMap(card => card.cells.map(cell => cell.terrainId))
    );
    const semanticFields = [
        "id",
        "terrainId",
        "nameKey",
        "e",
        "gl",
        "category",
        "zoneCategory",
        "trialTerrainCategory",
        "isSpecialBlock",
        "isArtificialTerrain"
    ];
    for (const terrainId of referencedTerrainIds) {
        const runtimeTerrain = LAND_SYSTEM_DATA.terrains[terrainId];
        const jsonTerrain = landSystemJson.terrains?.[terrainId];
        assert.ok(runtimeTerrain, `runtime canonical terrain missing: ${terrainId}`);
        assert.ok(jsonTerrain, `json canonical terrain missing: ${terrainId}`);

        for (const field of semanticFields) {
            assert.deepEqual(
                runtimeTerrain[field] ?? null,
                jsonTerrain[field] ?? null,
                `land_system.js/json semantic drift: ${terrainId}.${field}`
            );
        }
        assert.deepEqual(
            runtimeTerrain.baseYieldsPerTile || null,
            jsonTerrain.baseYieldsPerTile || null,
            `land_system.js/json yield drift: ${terrainId}`
        );
    }

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

    const staleOverlayCard = {
        ...actualMultiCards[0],
        cells: [
            { ...actualMultiCards[0].cells[0], nameKey: "STALE_PLAINS_NAME" },
            actualMultiCards[0].cells[1]
        ]
    };
    assert.equal(
        resolveLandCardDisplayName({ terrain: staleOverlayCard }, fakeI18n),
        "草原（複数）"
    );
}

{
    for (const card of actualMultiCards) {
        for (const cell of card.cells || []) {
            assert.deepEqual(
                Object.keys(cell).sort(),
                ["c", "r", "terrainId"]
            );
        }
    }

    const state = createState();
    placeExisting(state, 2, 0, PLAINS, "existing");
    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });

    const plainsHill = actualMultiCards[0];
    const placed = grid.placeShape(
        1,
        0,
        plainsHill.shape,
        plainsHill,
        -1,
        plainsHill.cells
    );
    assert.equal(placed.success, true);
    assert.equal(state.placedBlockCount, 1);

    const plainsCell = state.grid[1][0];
    const hillCell = state.grid[1][1];
    assert.equal(plainsCell.terrain.terrainId, "GL1_PLAINS");
    assert.equal(plainsCell.terrain.nameKey, "TERRAIN_PLAINS");
    assert.equal(plainsCell.terrain.e, 1);
    assert.equal(plainsCell.terrain.gl, 1);
    assert.equal(plainsCell.terrain.zoneCategory, "PLAINS");
    assert.equal(plainsCell.terrain.trialTerrainCategory, "STANDARD_E1");
    assert.equal(hillCell.terrain.terrainId, "E2_HILL");
    assert.equal(hillCell.terrain.nameKey, "TERRAIN_HILL");
    assert.equal(hillCell.terrain.e, 2);
    assert.equal(hillCell.terrain.gl, 1);

    assert.ok(plainsCell.mergeGroupId);
    assert.notEqual(hillCell.mergeGroupId, plainsCell.mergeGroupId);
    assert.equal(state.mergeLinks.size, 0);
}

{
    // Socket resolution must use each occupied cell's actual terrain semantic,
    // never the card representative terrain.
    const previousSocketMaster = globalThis.SOCKET_RESOURCE_MASTER;
    globalThis.SOCKET_RESOURCE_MASTER = [
        {
            id: "SOCKET_TEST_PLAINS",
            nameKey: "SOCKET_TEST_PLAINS",
            category: "TEST",
            icon: "P",
            reqTerrains: ["GL1_PLAINS"],
            bonusYields: { food: 1, wood: 0, defense: 0, mystic: 0 }
        },
        {
            id: "SOCKET_TEST_HILL",
            nameKey: "SOCKET_TEST_HILL",
            category: "TEST",
            icon: "H",
            reqTerrains: ["E2_HILL"],
            bonusYields: { food: 0, wood: 1, defense: 0, mystic: 0 }
        }
    ];

    try {
        const state = createState();
        state.grid[1][0].hasSocket = true;
        state.grid[1][1].hasSocket = true;
        placeExisting(state, 2, 0, PLAINS, "existing");

        const grid = new GridEngine(state, {
            gameplayRandom: { nextFloat: () => 0 },
            deckManager: { consumeCardIfUnique() {} }
        });
        const plainsHill = actualMultiCards[0];
        const placed = grid.placeShape(
            1,
            0,
            plainsHill.shape,
            plainsHill,
            -1,
            plainsHill.cells
        );

        assert.equal(placed.success, true);
        assert.equal(state.grid[1][0].socketResource?.id, "SOCKET_TEST_PLAINS");
        assert.equal(state.grid[1][1].socketResource?.id, "SOCKET_TEST_HILL");
    } finally {
        if (previousSocketMaster === undefined) {
            delete globalThis.SOCKET_RESOURCE_MASTER;
        } else {
            globalThis.SOCKET_RESOURCE_MASTER = previousSocketMaster;
        }
    }
}

{
    const state = createState();
    const grid = new GridEngine(state);
    const hillMountain = actualMultiCards[2];
    const check = grid.canPlaceShape(
        1,
        1,
        hillMountain.shape,
        hillMountain,
        hillMountain.cells
    );
    assert.equal(check.can, false);
    assert.ok(check.reasons.includes("MOUNTAIN_NEAR_HQ_FORBIDDEN"));
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
    }), true);

    const productionReadyPlainsHill = {
        ...actualMultiCards[0],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2, defense: 1 } }
            ]
        }
    };
    const productionReadyHillMountain = {
        ...actualMultiCards[2],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { wood: 4, defense: 3 }
        }
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
    const productionReadyMulti = {
        ...actualMultiCards[0],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2, defense: 1 } }
            ]
        }
    };
    const allowedUniform = LAND_CARDS_MASTER.find(card => card.id === "CARD_FOREST_1X1");
    assert.ok(allowedUniform);

    const makeOfferingState = () => {
        const state = createState();
        state.handOfferingSize = 1;
        state.canPlaceShape = (_r, _c, _shape, definition, attributeCells) => {
            if (definition?.id === productionReadyMulti.id) {
                assert.ok(Array.isArray(attributeCells));
                assert.equal(attributeCells.length, 2);
                return { can: false, reasons: ["NO_LEGAL_MULTI_POSITION"] };
            }
            return { can: definition?.id === allowedUniform.id, reasons: [] };
        };
        return state;
    };

    // Stage 1: ordinary weighted draw.
    {
        const state = makeOfferingState();
        const manager = new DeckManager(state, {
            gameplayRandom: {
                nextFloat: () => 0,
                nextId: () => "placeability-stage1"
            }
        });
        manager.getLandCardMaster = () => [productionReadyMulti, allowedUniform];
        const drawn = manager.drawSingleCard([]);
        assert.equal(drawn?.cardMasterId, allowedUniform.id);
    }

    // Stage 2: cooldown-relaxation fallback.
    {
        const state = makeOfferingState();
        const manager = new DeckManager(state, {
            gameplayRandom: {
                nextFloat: () => 0,
                nextId: () => "placeability-stage2"
            }
        });
        manager.getLandCardMaster = () => [productionReadyMulti, allowedUniform];
        manager.drawSingleCard = () => null;
        manager.cycleSystem = {
            findMinAvailableTurnCard(cards) {
                assert.deepEqual(cards.map(card => card.id), [allowedUniform.id]);
                return cards[0] || null;
            },
            registerOffering() {}
        };
        const offering = manager.generateOfferingCards();
        assert.equal(offering.length, 1);
        assert.equal(offering[0].cardMasterId, allowedUniform.id);
    }

    // Stage 3: final relaxed fallback.
    {
        const state = makeOfferingState();
        const manager = new DeckManager(state, {
            gameplayRandom: {
                nextFloat: () => 0,
                nextId: () => "placeability-stage3"
            }
        });
        manager.getLandCardMaster = () => [productionReadyMulti, allowedUniform];
        manager.drawSingleCard = () => null;
        manager.cycleSystem = null;
        const offering = manager.generateOfferingCards();
        assert.equal(offering.length, 1);
        assert.equal(offering[0].cardMasterId, allowedUniform.id);
    }
}

{
    const mountain = LAND_CARDS_MASTER.find(card => card.id === "CARD_MOUNTAIN_1X1");
    assert.ok(mountain);
    assert.equal(mountain.reqE2, 3);

    const state = createState();
    state.stage = { id: 2, size: state.stage.size };

    state.grid[0][0] = createCell(0, 0, {
        placed: true,
        terrain: {
            id: "CARD_HILL_1X1",
            terrainId: "E2_HILL",
            e: 2,
            gl: 1
        },
        placementGroupId: "hill_normal_1"
    });
    state.grid[0][1] = createCell(0, 1, {
        placed: true,
        terrain: {
            id: "CARD_HILL_1X2",
            terrainId: "E2_HILL",
            e: 2,
            gl: 1
        },
        placementGroupId: "hill_normal_2"
    });

    const grid = new GridEngine(state);
    assert.equal(grid.countE2HillsOnBoard(), 2);

    // A Multi-Attribute hill cell contributes one hill tile, not one whole block.
    state.grid[0][2] = createCell(0, 2, {
        placed: true,
        terrain: { ...HILL },
        placementGroupId: "place_multi_hill"
    });
    assert.equal(grid.countE2HillsOnBoard(), 3);

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "mountain-gate"
        }
    });

    assert.equal(manager.isCardEligible(mountain, 2, 2, { ignoreCooldown: true }), false);
    assert.equal(manager.isCardEligible(mountain, 2, 3, { ignoreCooldown: true }), true);

    // Stage-3 fallback must not bypass reqE2: 3.
    const fallbackState = createState();
    fallbackState.stage = { id: 2, size: fallbackState.stage.size };
    fallbackState.handOfferingSize = 1;
    fallbackState.canPlaceShape = () => ({ can: true, reasons: [] });

    const blockedManager = new DeckManager(fallbackState, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "mountain-fallback-blocked"
        }
    });
    blockedManager.getLandCardMaster = () => [mountain];
    blockedManager.drawSingleCard = () => null;
    blockedManager.cycleSystem = null;

    const blockedOffering = blockedManager.generateOfferingCards();
    assert.equal(blockedOffering.length, 0);

    fallbackState.countE2HillsOnBoard = () => 3;
    const allowedManager = new DeckManager(fallbackState, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "mountain-fallback-allowed"
        }
    });
    allowedManager.getLandCardMaster = () => [mountain];
    allowedManager.drawSingleCard = () => null;
    allowedManager.cycleSystem = null;

    const allowedOffering = allowedManager.generateOfferingCards();
    assert.equal(allowedOffering.length, 1);
    assert.equal(allowedOffering[0].cardMasterId, mountain.id);
}

{
    const plains = LAND_CARDS_MASTER.find(card => card.id === "CARD_PLAINS_1X1");
    assert.ok(plains);

    const state = createState();
    state.handOfferingSize = 1;
    let placementChecks = 0;
    state.canPlaceShape = () => {
        placementChecks += 1;
        return { can: true, reasons: [] };
    };

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "minimum-cache"
        },
        offeringMinimumRequirementProvider: {
            getMinimumRequirements() {
                return [{
                    id: "TEST_PLAYABLE_LAND",
                    category: "LAND",
                    minCount: 1,
                    requirePlaceable: true
                }];
            }
        }
    });
    manager.getLandCardMaster = () => [plains];
    manager.cycleSystem = {
        isInCooldown() { return false; },
        registerOffering() {}
    };

    const offering = manager.generateOfferingCards({
        reason: OFFERING_GENERATION_REASONS.INITIAL
    });
    assert.equal(offering.length, 1);
    assert.equal(offering[0].cardMasterId, plains.id);
    assert.equal(placementChecks, 1);
    assert.equal(manager.lastOfferingGeneration.appliedMinimums.length, 0);
}

{
    const plains = LAND_CARDS_MASTER.find(card => card.id === "CARD_PLAINS_1X1");
    assert.ok(plains);

    const state = createState();
    for (const row of state.grid) {
        for (const cell of row) {
            cell.placed = false;
            cell.isHQ = false;
            cell.terrain = null;
        }
    }
    state.handOfferingSize = 1;
    let placementChecks = 0;
    state.canPlaceShape = () => {
        placementChecks += 1;
        return { can: false, reasons: ["NOT_ADJACENT"] };
    };

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "unrooted-cycle-fixture"
        }
    });
    manager.getLandCardMaster = () => [plains];
    manager.cycleSystem = {
        isInCooldown() { return false; },
        registerOffering() {}
    };

    const offering = manager.generateOfferingCards();
    assert.equal(offering.length, 0);
    assert.ok(placementChecks > 0);
}

{
    const wetland = LAND_CARDS_MASTER.find(card => card.id === "CARD_WETLAND_1X1");
    const plains = LAND_CARDS_MASTER.find(card => card.id === "CARD_PLAINS_1X1");
    assert.ok(wetland);
    assert.ok(plains);

    const state = createState();
    state.handOfferingSize = 1;
    const grid = new GridEngine(state, {
        gameplayRandom: {
            nextFloat: () => 0.99
        },
        deckManager: { consumeCardIfUnique() {} }
    });
    state.canPlaceShape = (...args) => grid.canPlaceShape(...args);

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "verse1-placeability"
        }
    });
    manager.getLandCardMaster = () => [wetland, plains];

    assert.equal(manager._isCardPlaceableNow(wetland), false);
    assert.equal(manager._isCardPlaceableNow(plains), true);

    const drawn = manager.drawSingleCard([]);
    assert.equal(drawn?.cardMasterId, plains.id);
}

{
    const previewCard = {
        ...actualMultiCards[0],
        id: "CARD_MULTI_PREVIEW_ROTATION_ONLY",
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2 } }
            ]
        }
    };
    const state = createState();
    state.canPlaceShape = (_r, _c, shape, definition, attributeCells) => {
        if (definition?.id !== previewCard.id) return { can: false, reasons: [] };
        const vertical = shape.length === 2 && shape[0]?.length === 1;
        if (!vertical) return { can: false, reasons: ["ROTATE_REQUIRED"] };
        assert.deepEqual(
            attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]),
            [
                [0, 0, "GL1_PLAINS"],
                [1, 0, "E2_HILL"]
            ]
        );
        return { can: true, reasons: [] };
    };

    const resolver = new PlacementPreviewResolver();
    const before = resolver.resolveCandidates(previewCard, state);
    assert.equal(before.some(candidate => candidate.valid), false);

    const rotated = rotatePlacementClockwise(
        previewCard.shape,
        previewCard.anchor,
        previewCard.cells
    );
    const rotatedCard = {
        ...previewCard,
        currentShape: rotated.shape,
        currentAnchor: rotated.anchor,
        currentCells: rotated.attributeCells
    };
    const after = resolver.resolveCandidates(rotatedCard, state);
    assert.equal(after.some(candidate => candidate.valid), true);
}

{
    const rotatableMulti = {
        ...actualMultiCards[0],
        id: "CARD_MULTI_ROTATION_ONLY",
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2 } }
            ]
        }
    };

    const state = createState();
    state.handOfferingSize = 1;
    let sawDefaultOrientation = false;
    let sawRotatedOrientation = false;
    state.canPlaceShape = (_r, _c, shape, definition, attributeCells) => {
        if (definition?.id !== rotatableMulti.id) return { can: false, reasons: [] };

        const isHorizontal = shape.length === 1 && shape[0]?.length === 2;
        const isVertical = shape.length === 2 && shape[0]?.length === 1;
        if (isHorizontal) {
            sawDefaultOrientation = true;
            return { can: false, reasons: ["HORIZONTAL_BLOCKED"] };
        }
        if (isVertical) {
            sawRotatedOrientation = true;
            assert.deepEqual(
                attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]),
                [
                    [0, 0, "GL1_PLAINS"],
                    [1, 0, "E2_HILL"]
                ]
            );
            return { can: true, reasons: [] };
        }
        return { can: false, reasons: [] };
    };

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "rotation-only"
        }
    });
    manager.getLandCardMaster = () => [rotatableMulti];

    const drawn = manager.drawSingleCard([]);
    assert.equal(drawn?.cardMasterId, rotatableMulti.id);
    assert.equal(sawDefaultOrientation, true);
    assert.equal(sawRotatedOrientation, true);
}

{
    // The final relaxed fallback must still keep explicitly UNRESOLVED
    // Multi-Attribute content out even though the shipped v1 cards are resolved.
    const state = createState();
    state.stage.id = 2;
    const unresolvedSynthetic = {
        ...actualMultiCards[0],
        id: "CARD_TEST_UNRESOLVED_MULTI",
        productionContract: { status: LAND_PRODUCTION_STATUS.UNRESOLVED }
    };
    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0,
            nextId: () => "fallback-card"
        }
    });

    assert.equal(manager.isCardEligible(unresolvedSynthetic, 2, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);
}

{
    const missingCellCard = {
        ...actualMultiCards[0],
        cells: [
            { r: 0, c: 0, terrainId: "GL1_PLAINS" }
        ],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } }
            ]
        }
    };
    const unknownTerrainCard = {
        ...actualMultiCards[0],
        cells: [
            { r: 0, c: 0, terrainId: "GL1_PLAINS" },
            { r: 0, c: 1, terrainId: "E2_HIL_TYPO" }
        ],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2 } }
            ]
        }
    };

    const duplicateCellCard = {
        ...actualMultiCards[0],
        cells: [
            { r: 0, c: 0, terrainId: "GL1_PLAINS" },
            { r: 0, c: 0, terrainId: "E2_HILL" }
        ],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2 } }
            ]
        }
    };

    const missingValidation = validatePlacementAttributeMap(
        missingCellCard.shape,
        missingCellCard.cells
    );
    assert.equal(missingValidation.valid, false);
    assert.ok(missingValidation.reasons.includes("ATTRIBUTE_CELL_COVERAGE_MISSING"));

    const duplicateValidation = validatePlacementAttributeMap(
        duplicateCellCard.shape,
        duplicateCellCard.cells
    );
    assert.equal(duplicateValidation.valid, false);
    assert.ok(duplicateValidation.reasons.includes("ATTRIBUTE_CELL_DUPLICATE"));
    assert.ok(duplicateValidation.reasons.includes("ATTRIBUTE_CELL_COVERAGE_MISSING"));

    assert.equal(
        normalizeProductionContract(missingCellCard).status,
        LAND_PRODUCTION_STATUS.UNRESOLVED
    );
    assert.equal(
        normalizeProductionContract(duplicateCellCard).status,
        LAND_PRODUCTION_STATUS.UNRESOLVED
    );

    const state = createState();
    const grid = new GridEngine(state);
    const malformedPlacement = grid.canPlaceShape(
        0,
        0,
        duplicateCellCard.shape,
        duplicateCellCard,
        duplicateCellCard.cells
    );
    assert.equal(malformedPlacement.can, false);
    assert.equal(malformedPlacement.reason, "INVALID_ATTRIBUTE_MAP");

    const manager = new DeckManager(state, {
        gameplayRandom: {
            nextFloat: () => 0.5,
            nextId: () => "malformed-card"
        }
    });
    assert.equal(manager.isCardEligible(missingCellCard, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);
    assert.equal(manager.isCardEligible(duplicateCellCard, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);
    assert.equal(manager.isCardEligible(unknownTerrainCard, 1, 0, {
        ignoreCooldown: true,
        ignoreHold: true
    }), false);

    const unknownPlacement = grid.canPlaceShape(
        0,
        0,
        unknownTerrainCard.shape,
        unknownTerrainCard,
        unknownTerrainCard.cells
    );
    assert.equal(unknownPlacement.can, false);
    assert.equal(unknownPlacement.reason, "UNKNOWN_ATTRIBUTE_TERRAIN");
}

{
    const canonicalContract = normalizeProductionContract(actualMultiCards[0]);
    assert.equal(canonicalContract.status, LAND_PRODUCTION_STATUS.RESOLVED);
    assert.equal(canonicalContract.scope, LAND_PRODUCTION_SCOPE.CELL);
    assert.deepEqual(canonicalContract.cellYields, [
        { r: 0, c: 0, yields: { food: 4, wood: 0, defense: 0, mystic: 0 } },
        { r: 0, c: 1, yields: { food: 2, wood: 1, defense: 1, mystic: 0 } }
    ]);
    assert.deepEqual(resolveCardProductionPreview({ terrain: actualMultiCards[0] }).totalYields, {
        food: 6, wood: 1, defense: 1, mystic: 0
    });

    const unresolvedSynthetic = {
        ...actualMultiCards[0],
        productionContract: { status: LAND_PRODUCTION_STATUS.UNRESOLVED }
    };
    assert.equal(
        normalizeProductionContract(unresolvedSynthetic).status,
        LAND_PRODUCTION_STATUS.UNRESOLVED
    );
    assert.equal(resolveCardProductionPreview({ terrain: unresolvedSynthetic }).totalYields, null);

    const cellCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2, defense: 1 } }
            ]
        }
    };
    const blockCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { food: 1, wood: 4, defense: 3, mystic: 2 }
        }
    };
    const hybridCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.HYBRID,
            cellYields: [
                { r: 0, c: 0, yields: { food: 2 } },
                { r: 0, c: 1, yields: { wood: 1 } }
            ],
            blockYields: { mystic: 2 }
        }
    };

    assert.deepEqual(resolveCardProductionPreview({ terrain: cellCard }).totalYields, {
        food: 3, wood: 2, defense: 1, mystic: 0
    });
    assert.deepEqual(resolveCardProductionPreview({ terrain: blockCard }).totalYields, {
        food: 1, wood: 4, defense: 3, mystic: 2
    });
    assert.deepEqual(resolveCardProductionPreview({ terrain: hybridCard }).totalYields, {
        food: 2, wood: 1, defense: 0, mystic: 2
    });

    const state = createState();
    placeExisting(state, 3, 0, PLAINS, "existing");
    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const geometry = resolvePlacementGeometry(cellCard, 1, 0);
    const rotated = rotatePlacementClockwise(geometry.shape, geometry.anchor, geometry.attributeCells);
    const placed = grid.placeShape(1, 0, rotated.shape, cellCard, -1, rotated.attributeCells);
    assert.equal(placed.success, true);

    const firstCell = state.grid[1][0];
    const secondCell = state.grid[2][0];
    assert.equal(Object.prototype.hasOwnProperty.call(firstCell.terrain, "sourceR"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(firstCell.terrain, "sourceC"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(secondCell.terrain, "sourceR"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(secondCell.terrain, "sourceC"), false);
    assert.deepEqual(firstCell.production.cellYields, { food: 3, wood: 0, defense: 0, mystic: 0 });
    assert.deepEqual(secondCell.production.cellYields, { food: 0, wood: 2, defense: 1, mystic: 0 });

    const firstBreakdown = ProductionCalculator.calculateCellYieldBreakdown(state, 1, 0);
    const secondBreakdown = ProductionCalculator.calculateCellYieldBreakdown(state, 2, 0);
    assert.equal(firstBreakdown.productionScope, LAND_PRODUCTION_SCOPE.CELL);
    assert.deepEqual(firstBreakdown.baseYields, { food: 3, wood: 0, defense: 0, mystic: 0 });
    assert.deepEqual(secondBreakdown.baseYields, { food: 0, wood: 2, defense: 1, mystic: 0 });
}

{
    const state = createState();
    placeExisting(state, 2, 0, PLAINS, "existing");
    const blockCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { food: 1, wood: 4, defense: 3, mystic: 2 }
        }
    };
    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const result = grid.placeShape(1, 0, blockCard.shape, blockCard, -1, blockCard.cells);
    assert.equal(result.success, true);

    const groupId = state.grid[1][0].placementGroupId;
    assert.deepEqual(sumPlacedBlockProduction(state), {
        food: 1, wood: 4, defense: 3, mystic: 2
    });
    assert.equal(state.grid[1][0].production.scope, LAND_PRODUCTION_SCOPE.BLOCK);
    assert.deepEqual(
        ProductionCalculator.calculateCellYieldBreakdown(state, 1, 0).baseYields,
        { food: 0, wood: 0, defense: 0, mystic: 0 }
    );
    assert.equal(state.placedBlockProduction[groupId].yields.defense, 3);
    assert.equal(DefenseSystem.calculateMaxDefense(state), 13);
}

{
    // AoT260922 irrigation integration:
    // cell-owned food uses the placed cell's actual board position, while
    // block-owned food is not duplicated into cells and therefore does not
    // receive adjacency irrigation as a cell modifier.
    const irrigationTerrain = terrain("TEST_IRRIGATION_SOURCE", 1, 1, "TEST_IRRIGATION_SOURCE");

    const cellCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: [
                { r: 0, c: 0, yields: { food: 3 } },
                { r: 0, c: 1, yields: { wood: 2 } }
            ]
        }
    };

    const cellState = createState();
    placeExisting(cellState, 0, 0, irrigationTerrain, "irrigation_source");
    cellState.grid[0][0].irrigationSource = true;

    const cellGrid = new GridEngine(cellState, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const geometry = resolvePlacementGeometry(cellCard, 1, 0);
    const rotated = rotatePlacementClockwise(geometry.shape, geometry.anchor, geometry.attributeCells);
    const placed = cellGrid.placeShape(1, 0, rotated.shape, cellCard, -1, rotated.attributeCells);
    assert.equal(placed.success, true);

    const irrigated = ProductionCalculator.calculateCellYieldBreakdown(cellState, 1, 0);
    const nonFoodCell = ProductionCalculator.calculateCellYieldBreakdown(cellState, 2, 0);
    assert.deepEqual(irrigated.baseYields, { food: 3, wood: 0, defense: 0, mystic: 0 });
    assert.deepEqual(irrigated.totalYields, { food: 4, wood: 0, defense: 0, mystic: 0 });
    assert.ok(irrigated.modifiers.some(modifier =>
        modifier.type === "IRRIGATION"
        && modifier.resource === "food"
        && modifier.amount === 1
    ));
    assert.deepEqual(nonFoodCell.totalYields, { food: 0, wood: 2, defense: 0, mystic: 0 });

    const blockCard = {
        ...multiCard,
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { food: 4 }
        }
    };

    const blockState = createState();
    placeExisting(blockState, 0, 0, irrigationTerrain, "irrigation_source");
    blockState.grid[0][0].irrigationSource = true;

    const blockGrid = new GridEngine(blockState, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const blockGeometry = resolvePlacementGeometry(blockCard, 1, 0);
    const blockRotated = rotatePlacementClockwise(
        blockGeometry.shape,
        blockGeometry.anchor,
        blockGeometry.attributeCells
    );
    const blockPlaced = blockGrid.placeShape(
        1,
        0,
        blockRotated.shape,
        blockCard,
        -1,
        blockRotated.attributeCells
    );
    assert.equal(blockPlaced.success, true);

    const blockCell = ProductionCalculator.calculateCellYieldBreakdown(blockState, 1, 0);
    assert.deepEqual(blockCell.baseYields, { food: 0, wood: 0, defense: 0, mystic: 0 });
    assert.ok(!blockCell.modifiers.some(modifier => modifier.type === "IRRIGATION"));

    const blockTotal = ProductionCalculator.calculateTotalProduction(blockState);
    assert.equal(blockTotal.blockProduction.food, 4);
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
    // Partial Zone membership inside one placementGroup must not merge
    // presentation aggregates back together.
    const state = createState();
    const zoneCell = createCell(0, 0, {
        placed: true,
        merged: true,
        mergeGroupId: "zone_plains",
        placementGroupId: "place_multi",
        terrain: { ...PLAINS },
        production: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: { food: 2, wood: 0, defense: 0, mystic: 0 }
        }
    });
    const remainderCell = createCell(0, 1, {
        placed: true,
        merged: false,
        mergeGroupId: null,
        placementGroupId: "place_multi",
        terrain: { ...HILL },
        production: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: { food: 0, wood: 3, defense: 0, mystic: 0 }
        }
    });
    const sameZoneOtherBlock = createCell(1, 0, {
        placed: true,
        merged: true,
        mergeGroupId: "zone_plains",
        placementGroupId: "place_other",
        terrain: { ...PLAINS },
        production: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: { food: 4, wood: 0, defense: 0, mystic: 0 }
        }
    });

    state.grid[0][0] = zoneCell;
    state.grid[0][1] = remainderCell;
    state.grid[1][0] = sameZoneOtherBlock;
    state.mergedBlocks.zone_plains = { yieldMultiplier: 1.2 };
    state.placedBlockProduction.place_multi = {
        status: LAND_PRODUCTION_STATUS.RESOLVED,
        scope: LAND_PRODUCTION_SCOPE.BLOCK,
        yields: { food: 0, wood: 0, defense: 0, mystic: 5 }
    };

    const cellViewDataService = new CellViewDataService();
    const zoneFacts = cellViewDataService.getCellViewData(state, 0, 0);
    const remainderFacts = cellViewDataService.getCellViewData(state, 0, 1);
    const sameZoneFacts = cellViewDataService.getCellViewData(state, 1, 0);

    assert.equal(resolveBoardDisplayRole(state, zoneFacts), "LAND_PRIMARY");
    assert.equal(resolveBoardDisplayRole(state, remainderFacts), "LAND_PRIMARY");
    assert.equal(resolveBoardDisplayRole(state, sameZoneFacts), "CLEAN");

    const zoneProduction = resolveBoardDisplayProduction(state, zoneFacts, cellViewDataService);
    const remainderProduction = resolveBoardDisplayProduction(state, remainderFacts, cellViewDataService);

    assert.equal(zoneProduction.food, 7);
    assert.equal(zoneProduction.wood, 0);
    assert.equal(zoneProduction.mystic, 5);
    assert.equal(remainderProduction.food, 0);
    assert.equal(remainderProduction.wood, 3);
    assert.equal(remainderProduction.mystic, 0);
}

{
    const ctx = {
        fills: [],
        strokes: [],
        currentPath: null,
        globalAlpha: 1,
        beginPath() { this.currentPath = []; },
        moveTo(x, y) { this.currentPath.push(["M", x, y]); },
        lineTo(x, y) { this.currentPath.push(["L", x, y]); },
        closePath() {},
        save() { this.savedAlpha = this.globalAlpha; },
        restore() { this.globalAlpha = this.savedAlpha ?? 1; },
        fill() { this.fills.push({ fillStyle: this.fillStyle, alpha: this.globalAlpha }); },
        stroke() { this.strokes.push({ strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); }
    };
    const projection = {
        halfW: 20,
        halfH: 10,
        projectCell(r, c) { return { x: c * 40, y: r * 20 }; }
    };
    const readModel = {
        placementPreview: {
            active: true,
            candidates: [],
            hover: {
                valid: true,
                anchor: { r: 1, c: 1 },
                placement: {
                    cells: [
                        { r: 1, c: 1, terrainId: "GL1_PLAINS" },
                        { r: 1, c: 2, terrainId: "E2_HILL" }
                    ]
                }
            }
        }
    };

    drawWeb25DPlacementPreview({ ctx, projection, readModel });

    assert.equal(ctx.fills.length, 2);
    assert.equal(ctx.fills[0].fillStyle, resolveWeb25DTerrainTopFill({ terrainId: "GL1_PLAINS" }));
    assert.equal(ctx.fills[1].fillStyle, resolveWeb25DTerrainTopFill({ terrainId: "E2_HILL" }));
    assert.notEqual(ctx.fills[0].fillStyle, ctx.fills[1].fillStyle);
}

{
    const geometry = resolvePlacementGeometry(multiCard, 1, 1);
    assert.deepEqual(geometry.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]), [
        [0, 0, "GL1_PLAINS"],
        [0, 1, "E2_HILL"]
    ]);
    assert.deepEqual(geometry.attributeCells.map(cell => [cell.sourceR, cell.sourceC]), [
        [0, 0],
        [0, 1]
    ]);

    const once = rotatePlacementClockwise(geometry.shape, geometry.anchor, geometry.attributeCells);
    assert.deepEqual(once.shape, [[1], [1]]);
    assert.deepEqual(once.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId]), [
        [0, 0, "GL1_PLAINS"],
        [1, 0, "E2_HILL"]
    ]);
    assert.deepEqual(once.attributeCells.map(cell => [cell.sourceR, cell.sourceC]), [
        [0, 0],
        [0, 1]
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

    // Deserialized/legacy draft shape: block ids are absent. Validation must
    // rederive identity from the live board and still reject double-use.
    const drafts = new Map([
        ["R1", {
            routeId: "R1",
            status: "INTERCEPT",
            interceptCell: { r: 1, c: 0 },
            interceptBlockId: null,
            defenseAllocation: 1
        }],
        ["R2", {
            routeId: "R2",
            status: "INTERCEPT",
            interceptCell: { r: 1, c: 1 },
            interceptBlockId: null,
            defenseAllocation: 1
        }]
    ]);
    const routes = [
        { id: "R1", cells: [{ r: 1, c: 0 }] },
        { id: "R2", cells: [{ r: 1, c: 1 }] }
    ];
    const validation = TrialPlanningDraftService.validateDraft(drafts, {
        routes,
        availableDefense: 10,
        cellResolver: (r, c) => state.grid[r][c]
    });

    assert.equal(validation.valid, false);
    assert.ok(validation.errors.includes(TRIAL_PLAN_REASONS.BLOCK_ALREADY_PLANNED));
}

{
    const state = createState();
    placeExisting(state, 0, 0, PLAINS, "existing");

    const restoredTrialCard = {
        id: "CARD_TEST_HILL_MOUNTAIN",
        nameKey: "CARD_TEST_HILL_MOUNTAIN",
        category: "LAND",
        representativeTerrainId: "E2_HILL",
        shape: [[1, 1]],
        anchor: { r: 0, c: 0 },
        cells: [
            { r: 0, c: 0, ...HILL },
            { r: 0, c: 1, ...MOUNTAIN }
        ],
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { defense: 3 }
        }
    };

    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const placed = grid.placeShape(
        0,
        1,
        restoredTrialCard.shape,
        restoredTrialCard,
        -1,
        restoredTrialCard.cells
    );
    assert.equal(placed.success, true);

    const placedGroupId = state.grid[0][1].placementGroupId;
    assert.equal(state.grid[0][2].placementGroupId, placedGroupId);
    assert.equal(state.grid[0][1].terrain.terrainId, "E2_HILL");
    assert.equal(state.grid[0][2].terrain.terrainId, "E3_MOUNTAIN");
    assert.equal(state.placedBlockProduction[placedGroupId].yields.defense, 3);

    const serialized = serializeGameState(state);
    const restored = {};
    hydrateGameState(restored, serialized, {
        resolveCardMaster: () => restoredTrialCard
    });

    assert.equal(restored.grid[0][1].placementGroupId, placedGroupId);
    assert.equal(restored.grid[0][2].placementGroupId, placedGroupId);
    assert.equal(restored.grid[0][1].terrain.terrainId, "E2_HILL");
    assert.equal(restored.grid[0][2].terrain.terrainId, "E3_MOUNTAIN");
    assert.equal(restored.placedBlockProduction[placedGroupId].yields.defense, 3);

    const terrainResolver = new TrialTerrainEffectResolver();
    assert.equal(terrainResolver.canInterceptAt(restored.grid[0][1]), true);
    assert.equal(terrainResolver.canInterceptAt(restored.grid[0][2]), false);
}

{
    const unresolvedCard = {
        ...actualMultiCards[0],
        id: "CARD_TEST_LIVE_UNRESOLVED_MULTI",
        productionContract: { status: LAND_PRODUCTION_STATUS.UNRESOLVED }
    };
    const resolvedCard = actualMultiCards[0];

    const state = new GameState();
    let canDelegateCalls = 0;
    let placeDelegateCalls = 0;
    state.gridEngine = {
        canPlaceShape() {
            canDelegateCalls++;
            return { can: true, reasons: [] };
        },
        placeShape() {
            placeDelegateCalls++;
            return { can: true, success: true };
        }
    };

    const unresolvedCan = state.canPlaceShape(
        0,
        0,
        unresolvedCard.shape,
        unresolvedCard,
        unresolvedCard.cells
    );
    assert.equal(unresolvedCan.can, false);
    assert.equal(unresolvedCan.reason, "MULTI_ATTRIBUTE_PRODUCTION_UNRESOLVED");
    assert.equal(canDelegateCalls, 0);

    const livePreviewResolver = new PlacementPreviewResolver();
    const unresolvedPreview = livePreviewResolver.resolveHover(unresolvedCard, state, 0, 0);
    assert.equal(unresolvedPreview.valid, false);
    assert.deepEqual(
        unresolvedPreview.reasons,
        ["MULTI_ATTRIBUTE_PRODUCTION_UNRESOLVED"]
    );
    assert.equal(canDelegateCalls, 0);

    const unresolvedPlace = state.placeShape(
        0,
        0,
        unresolvedCard.shape,
        unresolvedCard,
        -1,
        unresolvedCard.cells
    );
    assert.equal(unresolvedPlace.success, false);
    assert.equal(unresolvedPlace.reason, "MULTI_ATTRIBUTE_PRODUCTION_UNRESOLVED");
    assert.equal(placeDelegateCalls, 0);

    const resolvedCan = state.canPlaceShape(
        0,
        0,
        resolvedCard.shape,
        resolvedCard,
        resolvedCard.cells
    );
    assert.equal(resolvedCan.can, true);
    assert.equal(canDelegateCalls, 1);

    const resolvedPlace = state.placeShape(
        0,
        0,
        resolvedCard.shape,
        resolvedCard,
        -1,
        resolvedCard.cells
    );
    assert.equal(resolvedPlace.success, true);
    assert.equal(placeDelegateCalls, 1);

    const uniformCard = {
        id: "CARD_TEST_UNIFORM",
        category: "LAND",
        terrainId: "GL1_PLAINS",
        shape: [[1]]
    };
    const uniformCan = state.canPlaceShape(
        0,
        0,
        uniformCard.shape,
        uniformCard,
        null
    );
    assert.equal(uniformCan.can, true);
    assert.equal(canDelegateCalls, 2);

    const explicitHomogeneous = {
        id: "CARD_TEST_EXPLICIT_HOMOGENEOUS",
        category: "LAND",
        shape: [[1, 1]],
        cells: [
            { r: 0, c: 0, terrainId: "GL1_PLAINS" },
            { r: 0, c: 1, terrainId: "GL1_PLAINS" }
        ]
    };
    const homogeneousCan = state.canPlaceShape(
        0,
        0,
        explicitHomogeneous.shape,
        explicitHomogeneous,
        explicitHomogeneous.cells
    );
    assert.equal(homogeneousCan.can, true);
    assert.equal(canDelegateCalls, 3);
}

{
    const state = new GameState();
    state.engine = null;
    state.gridEngine = null;

    state.grid[0][0] = {
        ...state.grid[0][0],
        placed: true,
        isHQ: false,
        terrain: { ...PLAINS },
        placementGroupId: "place_multi_fallback"
    };
    state.grid[0][1] = {
        ...state.grid[0][1],
        placed: true,
        isHQ: false,
        terrain: { ...HILL },
        placementGroupId: "place_multi_fallback"
    };

    assert.equal(state.countPlacedBlocks(), 1);
    assert.equal(
        ConditionEvaluator.evaluate(
            { type: "PLACED_BLOCKS_AT_MOST", value: 1 },
            { state }
        ),
        true
    );
    assert.equal(
        ConditionEvaluator.evaluate(
            { type: "PLACED_BLOCKS_AT_MOST", value: 0 },
            { state }
        ),
        false
    );
}

{
    const state = createState();
    placeExisting(state, 1, 1, PLAINS, "existing");

    const undoCard = {
        ...multiCard,
        id: "CARD_TEST_UNDO_MULTI",
        productionContract: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.BLOCK,
            blockYields: { defense: 3 }
        }
    };
    const rotated = rotatePlacementClockwise(
        undoCard.shape,
        undoCard.anchor,
        undoCard.cells
    );
    const handCard = {
        terrain: undoCard,
        cardMasterId: undoCard.id,
        currentShape: rotated.shape,
        currentAnchor: rotated.anchor,
        currentCells: rotated.attributeCells
    };
    state.handOffering = [handCard];

    const undo = new UndoLandSystem(state);
    undo.captureSnapshot([
        { r: 0, c: 0 },
        { r: 1, c: 0 }
    ]);

    const grid = new GridEngine(state, {
        gameplayRandom: { nextFloat: () => 0.99 },
        deckManager: { consumeCardIfUnique() {} }
    });
    const placed = grid.placeShape(
        0,
        0,
        rotated.shape,
        undoCard,
        -1,
        rotated.attributeCells
    );
    assert.equal(placed.success, true);

    const groupId = state.grid[0][0].placementGroupId;
    assert.ok(groupId);
    assert.equal(state.grid[1][0].placementGroupId, groupId);
    assert.equal(state.placedBlockProduction[groupId].yields.defense, 3);

    // Simulate post-placement hand consumption before Undo restores snapshot.
    state.handOffering = [];
    state.hasPickedThisTurn = true;

    assert.equal(undo.undo(), true);
    assert.equal(state.grid[0][0].placed, false);
    assert.equal(state.grid[1][0].placed, false);
    assert.deepEqual(state.placedBlockProduction, {});
    assert.equal(state.handOffering.length, 1);
    assert.deepEqual(state.handOffering[0].currentShape, rotated.shape);
    assert.deepEqual(state.handOffering[0].currentAnchor, rotated.anchor);
    assert.deepEqual(
        state.handOffering[0].currentCells.map(cell => [cell.r, cell.c, cell.terrainId]),
        rotated.attributeCells.map(cell => [cell.r, cell.c, cell.terrainId])
    );
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

    const restoredCoverage = validatePlacementAttributeMap(
        restored.handOffering[0].currentShape,
        restored.handOffering[0].currentCells
    );
    assert.equal(restoredCoverage.valid, true);

    const placementState = createState();
    placeExisting(placementState, 3, 0, PLAINS, "existing");
    const restoredGrid = new GridEngine(placementState);
    const restoredPlaceability = restoredGrid.canPlaceShape(
        1,
        0,
        restored.handOffering[0].currentShape,
        restored.handOffering[0].terrain,
        restored.handOffering[0].currentCells
    );
    assert.equal(restoredPlaceability.can, true);
}


// Block-count fallback must stay canonical for placement cost and save snapshots.
{
    const state = createState();
    state.placedBlockCount = undefined;
    placeExisting(state, 0, 0, PLAINS, "multi-a");
    placeExisting(state, 0, 1, HILL, "multi-a");
    placeExisting(state, 0, 2, PLAINS, "single-b");
    placeExisting(state, 0, 3, PLAINS, "single-c");
    placeExisting(state, 0, 4, PLAINS, "single-d");
    placeExisting(state, 1, 0, PLAINS, "single-e");
    placeExisting(state, 1, 1, PLAINS, "single-f");

    const grid = new GridEngine(state);
    state.gridEngine = grid;
    assert.equal(grid.getPlacedBlockCount(), 6);
    assert.equal(grid.getPlacementEmberCost(), 1);

    const serialized = serializeGameState(state);
    assert.equal(serialized.placedBlockCount, 6);
}

// Zone Conversion decorates only the completed mergeGroup, not the whole
// Multi-Attribute placementGroup. A remainder cell outside the Zone must keep
// its terrain, merge membership, and production ownership unchanged.
{
    const state = createState();
    const placementGroupId = "multi-zone-boundary";
    const zoneGroupId = "zone-multi-plains";
    const zoneCells = [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 1, c: 0 },
        { r: 1, c: 1 }
    ];

    const makeZonePlains = (r, c, groupId) => createCell(r, c, {
        placed: true,
        merged: true,
        mergeGroupId: zoneGroupId,
        mergeType: "2x2",
        placementGroupId: groupId,
        terrain: { ...PLAINS, zoneCategory: "PLAINS" },
        production: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: { food: 4, wood: 0, defense: 0, mystic: 0 }
        }
    });

    state.grid[0][0] = makeZonePlains(0, 0, "plain-a");
    state.grid[0][1] = makeZonePlains(0, 1, placementGroupId);
    state.grid[1][0] = makeZonePlains(1, 0, "plain-b");
    state.grid[1][1] = makeZonePlains(1, 1, "plain-c");
    state.grid[0][2] = createCell(0, 2, {
        placed: true,
        merged: false,
        mergeGroupId: null,
        mergeType: null,
        placementGroupId,
        terrain: { ...HILL },
        production: {
            status: LAND_PRODUCTION_STATUS.RESOLVED,
            scope: LAND_PRODUCTION_SCOPE.CELL,
            cellYields: { food: 2, wood: 1, defense: 1, mystic: 0 }
        }
    });

    state.mergedBlocks[zoneGroupId] = {
        groupId: zoneGroupId,
        terrainId: "GL1_PLAINS",
        zoneCategory: "PLAINS",
        mergeType: "2x2",
        cells: zoneCells.map(cell => ({ ...cell })),
        yieldMultiplier: 1.2
    };

    const beforeZoneCell = JSON.parse(JSON.stringify(state.grid[0][1]));
    const beforeRemainder = JSON.parse(JSON.stringify(state.grid[0][2]));
    const beforeZoneCells = JSON.parse(JSON.stringify(state.mergedBlocks[zoneGroupId].cells));

    const service = new ZoneConversionService({
        state,
        definitions: {
            MULTI_ZONE_BOUNDARY_TEST: {
                id: "MULTI_ZONE_BOUNDARY_TEST",
                eligibleZoneAttributes: ["PLAINS"],
                requirements: { resources: {} },
                creationCost: {
                    status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
                    base: {}
                },
                maintenance: {
                    status: ZONE_CONVERSION_COST_STATUS.RESOLVED,
                    resources: {}
                },
                capabilities: []
            }
        }
    });

    assert.equal(service.validateCandidate("MULTI_ZONE_BOUNDARY_TEST", zoneGroupId).valid, true);
    const created = service.createConversion("MULTI_ZONE_BOUNDARY_TEST", zoneGroupId, {
        paymentConfirmed: true,
        createdVerse: 10
    });
    assert.equal(created.success, true);
    assert.equal(
        state.mergedBlocks[zoneGroupId].conversion.definitionId,
        "MULTI_ZONE_BOUNDARY_TEST"
    );
    assert.deepEqual(state.mergedBlocks[zoneGroupId].cells, beforeZoneCells);
    assert.deepEqual(state.grid[0][1], beforeZoneCell);
    assert.deepEqual(state.grid[0][2], beforeRemainder);
    assert.equal(state.grid[0][1].placementGroupId, placementGroupId);
    assert.equal(state.grid[0][2].placementGroupId, placementGroupId);
    assert.equal(state.grid[0][2].mergeGroupId, null);
    assert.equal(state.grid[0][2].terrain.terrainId, "E2_HILL");
}

console.log("diagnose_multi_attribute_land_block: PASS");
