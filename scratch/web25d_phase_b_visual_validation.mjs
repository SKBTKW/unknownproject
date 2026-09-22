import assert from 'node:assert/strict';
import {
    WEB25D_TERRAIN_VISUAL_FAMILIES,
    resolveWeb25DElevationPixels,
    resolveWeb25DGreeneryDensity,
    resolveWeb25DTerrainTopFill,
    resolveWeb25DTerrainVisualFamily
} from '../game/src/presentation/web25d_canvas_renderer.js';

assert.deepEqual([
    resolveWeb25DElevationPixels(0),
    resolveWeb25DElevationPixels(1),
    resolveWeb25DElevationPixels(2),
    resolveWeb25DElevationPixels(3)
], [0, 6, 14, 24]);

assert.deepEqual([
    resolveWeb25DGreeneryDensity(0),
    resolveWeb25DGreeneryDensity(1),
    resolveWeb25DGreeneryDensity(2),
    resolveWeb25DGreeneryDensity(3)
], [0, 2, 5, 8]);

assert.equal(resolveWeb25DElevationPixels(null), 0);
assert.equal(resolveWeb25DGreeneryDensity(null), 0);

const terrainFamilies = new Map([
    ['E0_WETLAND', WEB25D_TERRAIN_VISUAL_FAMILIES.WETLAND],
    ['GL1_PLAINS', WEB25D_TERRAIN_VISUAL_FAMILIES.PLAINS],
    ['E1_RECLAIMED_LAND', WEB25D_TERRAIN_VISUAL_FAMILIES.RECLAIMED_LAND],
    ['GL2_FOREST', WEB25D_TERRAIN_VISUAL_FAMILIES.FOREST],
    ['GL3_DEEP_FOREST', WEB25D_TERRAIN_VISUAL_FAMILIES.DEEP_FOREST],
    ['E2_HILL', WEB25D_TERRAIN_VISUAL_FAMILIES.HILL],
    ['E3_MOUNTAIN', WEB25D_TERRAIN_VISUAL_FAMILIES.MOUNTAIN],
    ['GL0_DESERT', WEB25D_TERRAIN_VISUAL_FAMILIES.DESERT],
    ['E2_DESERT_HILL', WEB25D_TERRAIN_VISUAL_FAMILIES.DESERT_HILL],
    ['E2_FOREST_HILL', WEB25D_TERRAIN_VISUAL_FAMILIES.FOREST_HILL],
    ['E2_DEEP_HILL', WEB25D_TERRAIN_VISUAL_FAMILIES.DEEP_HILL]
]);

for (const [terrainId, expectedFamily] of terrainFamilies) {
    assert.equal(resolveWeb25DTerrainVisualFamily(terrainId), expectedFamily, terrainId);
}

assert.equal(
    resolveWeb25DTerrainVisualFamily('UNKNOWN_TERRAIN'),
    WEB25D_TERRAIN_VISUAL_FAMILIES.UNKNOWN
);

const terrainFills = [...terrainFamilies.keys()].map(terrainId =>
    resolveWeb25DTerrainTopFill({ terrainId, greenery: 1 })
);
assert.equal(new Set(terrainFills).size, terrainFills.length);
assert.equal(
    resolveWeb25DTerrainTopFill({ terrainId: 'UNKNOWN_TERRAIN', greenery: 2 }),
    'rgba(72, 106, 72, 0.86)'
);

console.log('WEB25D_PHASE_B_VISUAL_VALIDATION_OK');
