import assert from 'node:assert/strict';
import {
    resolveWeb25DElevationPixels,
    resolveWeb25DGreeneryDensity
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

console.log('WEB25D_PHASE_B_VISUAL_VALIDATION_OK');
