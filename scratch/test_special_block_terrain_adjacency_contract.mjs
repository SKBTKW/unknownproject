import assert from "node:assert/strict";

import {
    SPECIAL_BLOCK_ADJACENCY_GL,
    createSpecialBlockAdjacencyProfile,
    readSpecialBlockAdjacencyProfile
} from "../game/src/core/special_block_domain.js";
import { GridEngine } from "../game/src/systems/grid_engine.js";
import { SpecialBlockService } from "../game/src/systems/special_block_service.js";

function emptyCell(r, c) {
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
        specialBlock: null,
        searched: false,
        hasSocket: false,
        socketResource: null,
        cachedSocketSeeds: {}
    };
}

function terrain(id, e, gl) {
    return { id, terrainId: id, e, gl, food: 0, wood: 0, defense: 0, mystic: 0 };
}

function makeState(size = 5) {
    return {
        turn: 5,
        stage: { id: 1, size },
        grid: Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => emptyCell(r, c))
        ),
        mergedBlocks: {},
        mergeLinks: new Set(),
        grantedConnectionPairs: new Set(),
        hasPickedThisTurn: false
    };
}

function placeTerrain(state, r, c, value) {
    const cell = state.grid[r][c];
    cell.placed = true;
    cell.terrain = value;
    return cell;
}

function landCheckWithNeighbor(neighborCell, targetTerrain) {
    const state = makeState();
    state.grid[0][0] = {
        ...emptyCell(0, 0),
        ...neighborCell,
        r: 0,
        c: 0
    };
    const gridEngine = new GridEngine(state);
    return gridEngine.canPlaceShape(0, 1, [[1]], targetTerrain);
}

// Canonical terrain-to-terrain GL step: a difference of 2 or more is illegal.
{
    const result = landCheckWithNeighbor(
        { placed: true, terrain: terrain("GL1_PLAINS", 1, 1) },
        terrain("GL3_DEEP_FOREST", 1, 3)
    );
    assert.equal(result.can, false);
    assert.equal(result.reasons.includes("INVALID_GL_NEIGHBOR"), true);
}

// GL1 <-> GL2 remains legal.
{
    const result = landCheckWithNeighbor(
        { placed: true, terrain: terrain("GL1_PLAINS", 1, 1) },
        terrain("GL2_FOREST", 1, 2)
    );
    assert.equal(result.can, true);
}

// Special-only cells participate in Land placement adjacency as GL1.
{
    const result = landCheckWithNeighbor(
        {
            specialBlock: {
                type: "TEST_SPECIAL",
                definitionId: "TEST_SPECIAL",
                state: "ACTIVE",
                terrainAdjacencyProfile: { e: 1, gl: SPECIAL_BLOCK_ADJACENCY_GL }
            }
        },
        terrain("GL2_FOREST", 1, 2)
    );
    assert.equal(result.can, true, "GL2 may border a GL1 Special Block proxy");
}

// Deep forest cannot use a Special Block to bypass GL1 <-> GL3.
{
    const result = landCheckWithNeighbor(
        {
            specialBlock: {
                type: "TEST_SPECIAL",
                definitionId: "TEST_SPECIAL",
                state: "ACTIVE",
                terrainAdjacencyProfile: { e: 1, gl: SPECIAL_BLOCK_ADJACENCY_GL }
            }
        },
        terrain("GL3_DEEP_FOREST", 1, 3)
    );
    assert.equal(result.can, false);
    assert.equal(result.reasons.includes("INVALID_GL_NEIGHBOR"), true);
}

// Desert and mountain have explicit Special Block edge bans.
{
    const special = {
        specialBlock: {
            type: "TEST_SPECIAL",
            definitionId: "TEST_SPECIAL",
            state: "ACTIVE",
            terrainAdjacencyProfile: { e: 1, gl: SPECIAL_BLOCK_ADJACENCY_GL }
        }
    };
    const desert = landCheckWithNeighbor(special, terrain("GL0_DESERT", 1, 0));
    assert.equal(desert.can, false);
    assert.equal(desert.reasons.includes("SPECIAL_BLOCK_DESERT_NEIGHBOR_FORBIDDEN"), true);

    const mountain = landCheckWithNeighbor(special, terrain("E3_MOUNTAIN", 3, 0));
    assert.equal(mountain.can, false);
    assert.equal(mountain.reasons.includes("SPECIAL_BLOCK_MOUNTAIN_NEIGHBOR_FORBIDDEN"), true);
}

// Construction validation applies the same rules in the opposite direction.
{
    const definition = {
        id: "TEST_OVERLAY",
        placement: {
            mode: "OVERLAY",
            requirePlacedTerrain: true,
            excludeHQ: true,
            requireEmptySpecialBlock: true
        },
        lifecycle: { initialState: "ACTIVE" }
    };

    const state = makeState(3);
    placeTerrain(state, 1, 1, terrain("GL1_PLAINS", 1, 1));
    placeTerrain(state, 1, 2, terrain("GL0_DESERT", 1, 0));
    let service = new SpecialBlockService(state);
    let result = service.validateTarget(definition, { r: 1, c: 1 });
    assert.equal(result.valid, false);
    assert.equal(result.reasons.includes("SPECIAL_BLOCK_DESERT_NEIGHBOR_FORBIDDEN"), true);

    state.grid[1][2].terrain = terrain("E3_MOUNTAIN", 3, 0);
    result = service.validateTarget(definition, { r: 1, c: 1 });
    assert.equal(result.valid, false);
    assert.equal(result.reasons.includes("SPECIAL_BLOCK_MOUNTAIN_NEIGHBOR_FORBIDDEN"), true);

    state.grid[1][2].terrain = terrain("GL3_DEEP_FOREST", 1, 3);
    result = service.validateTarget(definition, { r: 1, c: 1 });
    assert.equal(result.valid, false);
    assert.equal(result.reasons.includes("INVALID_GL_NEIGHBOR"), true);

    state.grid[1][2].terrain = terrain("GL2_FOREST", 1, 2);
    result = service.validateTarget(definition, { r: 1, c: 1 });
    assert.equal(result.valid, true);
    assert.deepEqual(result.adjacencyProfile, { e: 1, gl: 1, source: { r: 1, c: 1 } });
}

// Reference E is copied while GL remains canonical 1, including E2 sources.
{
    const state = makeState(3);
    const hill = placeTerrain(state, 0, 0, terrain("E2_HILL", 2, 1));
    const profile = createSpecialBlockAdjacencyProfile(hill, { r: 0, c: 0 });
    assert.deepEqual(profile, { e: 2, gl: 1, source: { r: 0, c: 0 } });

    const service = new SpecialBlockService(state);
    const created = service.createSpecialBlock("MINE", { r: 0, c: 0 });
    assert.equal(created.success, true);
    assert.deepEqual(
        readSpecialBlockAdjacencyProfile(state.grid[0][0]),
        { e: 2, gl: 1, source: { r: 0, c: 0 } }
    );
}

console.log("test_special_block_terrain_adjacency_contract: PASS");
