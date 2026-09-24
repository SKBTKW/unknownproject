import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveWeb25DViewportProjection } from '../game/src/ui/web25d_validation_runtime_bridge.js';

const standardViewport = { width: 584, height: 584 };

assert.deepEqual(
    resolveWeb25DViewportProjection({ ...standardViewport, rows: 5, columns: 5 }),
    { tileWidth: 76, tileHeight: 38, originX: 292, originY: 216 },
    'Stage 1 should use the compact-board visual density and center vertically'
);

assert.deepEqual(
    resolveWeb25DViewportProjection({ ...standardViewport, rows: 7, columns: 7 }),
    { tileWidth: 76, tileHeight: 38, originX: 292, originY: 178 },
    'Stage 2 should preserve the compact-board visual density'
);

assert.deepEqual(
    resolveWeb25DViewportProjection({ ...standardViewport, rows: 9, columns: 9 }),
    { tileWidth: 60, tileHeight: 30, originX: 292, originY: 172 },
    'Stage 3 should retain the established dense-board 60x30 geometry'
);

for (const dimension of [5, 7, 9]) {
    const fit = resolveWeb25DViewportProjection({
        ...standardViewport,
        rows: dimension,
        columns: dimension
    });
    const spanFactor = dimension;
    const boardWidth = spanFactor * fit.tileWidth;
    const boardHeight = spanFactor * fit.tileHeight;

    assert.ok(boardWidth + 44 <= standardViewport.width, `${dimension}x${dimension} keeps coordinate gutters horizontally`);
    assert.ok(boardHeight + 44 <= standardViewport.height, `${dimension}x${dimension} keeps coordinate gutters vertically`);
    assert.equal(fit.tileWidth, fit.tileHeight * 2, `${dimension}x${dimension} preserves the 2:1 isometric ratio`);

    const top = fit.originY - fit.tileHeight / 2;
    const bottom = top + boardHeight;
    assert.equal(
        Math.abs(top - (standardViewport.height - bottom)) < 0.001,
        true,
        `${dimension}x${dimension} is vertically centered in the stable viewport`
    );
}

const narrowFit = resolveWeb25DViewportProjection({
    width: 400,
    height: 584,
    rows: 9,
    columns: 9
});
assert.equal(narrowFit.tileWidth, 38, 'narrow viewports shrink below the Stage 3 60px cap');
assert.equal(narrowFit.tileHeight, 19);
assert.equal(narrowFit.tileWidth, narrowFit.tileHeight * 2);
assert.ok(9 * narrowFit.tileWidth + 44 <= 400, 'narrow Stage 3 keeps horizontal coordinate gutters');

const runtimeSource = fs.readFileSync(
    new URL('../game/src/ui/web25d_validation_runtime_bridge.js', import.meta.url),
    'utf8'
);
assert.match(
    runtimeSource,
    /viewportSize:\s*Object\.freeze\(\{ \.\.\.initialSize \}\)/,
    '2.5D viewport size must remain stable across stage/view toggles'
);
assert.doesNotMatch(
    runtimeSource,
    /this\.lastBoardSize\s*=\s*resolveCanvasSize/,
    '2.5D viewport must not be re-sized from the hidden/visible 2D board history'
);
assert.match(runtimeSource, /rows:\s*presentation\?\.board\?\.rows/);
assert.match(runtimeSource, /columns:\s*presentation\?\.board\?\.columns/);

console.log('WEB25D_VIEWPORT_FIT_VALIDATION_OK');
