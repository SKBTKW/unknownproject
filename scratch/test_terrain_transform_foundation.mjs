import assert from "node:assert/strict";

import { BoardDomainAdapter } from "../game/src/core/board_domain_adapter.js";
import { TerrainTransformService } from "../game/src/systems/terrain_transform_service.js";

console.log("\nTerrain Transform Board foundation");

function cell({
    r,
    c,
    terrainId = "E0_WETLAND",
    isHQ = false,
    merged = false,
    mergeGroupId = null,
    socketResource = null
} = {}) {
    return {
        r,
        c,
        placed: true,
        isHQ,
        merged,
        mergeGroupId,
        mergeType: merged ? "2x2" : null,
        placementGroupId: null,
        terrain: {
            id: terrainId,
            terrainId,
            nameKey: terrainId,
            e: terrainId === "E0_WETLAND" ? 0 : 1,
            gl: 1,
            food: terrainId === "E0_WETLAND" ? 2 : 4,
            wood: 0,
            material: 0,
            defense: terrainId === "E0_WETLAND" ? 1 : 0,
            mystic: 0
        },
        production: { status: "LEGACY_TEST_SNAPSHOT" },
        specialBlock: null,
        socketResource
    };
}

const empty = (r, c) => ({
    r,
    c,
    placed: false,
    isHQ: false,
    merged: false,
    mergeGroupId: null,
    mergeType: null,
    placementGroupId: null,
    terrain: null,
    production: null,
    specialBlock: null,
    socketResource: null
});

const grid = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => empty(r, c))
);
grid[0][0] = cell({ r: 0, c: 0 });
grid[0][1] = cell({
    r: 0,
    c: 1,
    socketResource: { id: "SOCKET_LAKE", isLake: true }
});
grid[1][0] = cell({
    r: 1,
    c: 0,
    socketResource: { id: "SOCKET_WILD_RICE" }
});
grid[1][1] = cell({ r: 1, c: 1, isHQ: true });
grid[2][0] = cell({
    r: 2,
    c: 0,
    merged: true,
    mergeGroupId: "merge_true"
});
grid[2][1] = cell({ r: 2, c: 1, terrainId: "GL2_FOREST" });

let mergeChecks = 0;
let linkChecks = 0;
let defenseReconciles = 0;
let conditionalReconciles = 0;

const state = {
    grid,
    mergedBlocks: {
        merge_true: {
            groupId: "merge_true",
            mergeType: "2x2",
            cells: [
                { r: 2, c: 0 },
                { r: 2, c: 1 },
                { r: 1, c: 0 },
                { r: 1, c: 1 }
            ]
        }
    },
    defenseSystem: {
        reconcileWithMax() {
            defenseReconciles += 1;
        }
    },
    checkConditionalBuffs() {
        conditionalReconciles += 1;
    }
};

const gridEngine = {
    state,
    checkMergePatterns(points) {
        mergeChecks += 1;
        assert.deepEqual(points, [{ r: 1, c: 0 }]);
        return { merge2x2: true };
    },
    checkNewMergeLinks() {
        linkChecks += 1;
        return { count: 1, links: ["merge_a::merge_b"] };
    }
};

const spec = {
    fromTerrainIds: ["E0_WETLAND"],
    toTerrainId: "E1_RECLAIMED_LAND",
    excludeHQ: true,
    forbidTrueMerge: true,
    forbiddenSocketIds: ["SOCKET_LAKE"]
};

const service = new TerrainTransformService({ state, gridEngine });

assert.equal(service.validateTarget(spec, { r: 0, c: 0 }).valid, true);
assert.equal(service.validateTarget(spec, { r: 0, c: 1 }).reason, "SOCKET_FORBIDDEN");
assert.equal(service.validateTarget(spec, { r: 1, c: 1 }).reason, "HQ_FORBIDDEN");
assert.equal(service.validateTarget(spec, { r: 2, c: 0 }).reason, "TRUE_MERGE_FORBIDDEN");
assert.equal(service.validateTarget(spec, { r: 2, c: 1 }).reason, "SOURCE_TERRAIN_NOT_ALLOWED");
assert.equal(
    service.validateTarget({ ...spec, toTerrainId: "NOT_CANONICAL" }, { r: 0, c: 0 }).reason,
    "DESTINATION_TERRAIN_UNKNOWN"
);

const targets = service.enumerateTargets(spec);
assert.deepEqual(
    targets.map(({ r, c }) => ({ r, c })),
    [{ r: 0, c: 0 }, { r: 1, c: 0 }],
    "only explicit legal wetland targets are exposed"
);

const result = service.transform(spec, { r: 1, c: 0 });
assert.equal(result.success, true);
assert.equal(result.sourceTerrainId, "E0_WETLAND");
assert.equal(result.destinationTerrainId, "E1_RECLAIMED_LAND");
assert.equal(state.grid[1][0].terrain.terrainId, "E1_RECLAIMED_LAND");
assert.equal(state.grid[1][0].terrain.zoneCategory, "PLAINS");
assert.equal(state.grid[1][0].terrain.food, 4);
assert.equal(state.grid[1][0].terrain.wood, 1);
assert.equal(state.grid[1][0].production, null, "old terrain production snapshot is discarded");
assert.equal(
    state.grid[1][0].socketResource.id,
    "SOCKET_WILD_RICE",
    "non-forbidden resource socket survives the terrain transform"
);
assert.equal(mergeChecks, 1);
assert.equal(linkChecks, 1);
assert.equal(defenseReconciles, 1);
assert.equal(conditionalReconciles, 1);

const adapter = new BoardDomainAdapter({
    state,
    gridEngine,
    terrainTransformService: service
});
assert.equal(
    adapter.validateTerrainTransform(spec, { r: 0, c: 0 }).valid,
    true,
    "Board adapter exposes the same legality authority"
);
assert.equal(
    adapter.enumerateTerrainTransformTargets(spec).some(target => target.r === 0 && target.c === 0),
    true
);

console.log("  explicit target legality PASS");
console.log("  HQ / true merge / Lake socket fail closed");
console.log("  canonical E1_RECLAIMED_LAND mutation PASS");
console.log("  Zone/Link + defense reconciliation hooks PASS");
console.log("✅ Terrain Transform Board foundation PASS");
