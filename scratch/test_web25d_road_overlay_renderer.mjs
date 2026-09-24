import assert from 'node:assert/strict';

import { BOARD_VISIBILITY } from '../game/src/presentation/board_presentation_profile.js';
import {
    collectWeb25DRoadSegments,
    drawWeb25DRoadOverlay,
    resolveWeb25DRoadOpacity
} from '../game/src/presentation/web25d_road_overlay_renderer.js';

const projection = {
    projectCellView(cell) {
        return {
            screenCenter: {
                x: cell.c * 40 + 20,
                y: cell.r * 20 + 10
            }
        };
    }
};

const cells = [[
    {
        r: 0, c: 0, placed: true, elevation: 1,
        edges: [
            { direction: 'EAST', neighbor: { r: 0, c: 1 }, road: true },
            { direction: 'SOUTH', neighbor: { r: 1, c: 0 }, road: false }
        ]
    },
    {
        r: 0, c: 1, placed: true, elevation: 1,
        edges: [
            { direction: 'WEST', neighbor: { r: 0, c: 0 }, road: true }
        ]
    }
]];

const segments = collectWeb25DRoadSegments({
    projection,
    readModel: { cells }
});
assert.equal(segments.length, 1, 'shared road edge renders exactly once');
assert.deepEqual(segments[0].fromCell, { r: 0, c: 0 });
assert.deepEqual(segments[0].toCell, { r: 0, c: 1 });

assert.equal(resolveWeb25DRoadOpacity(BOARD_VISIBILITY.VISIBLE), 1);
assert.equal(resolveWeb25DRoadOpacity(BOARD_VISIBILITY.PRIMARY), 1);
assert.equal(resolveWeb25DRoadOpacity(BOARD_VISIBILITY.SECONDARY), 0.55);
assert.equal(resolveWeb25DRoadOpacity(BOARD_VISIBILITY.SUPPRESSED), 0.24);
assert.equal(resolveWeb25DRoadOpacity(BOARD_VISIBILITY.HIDDEN), 0);

function createContext() {
    const ops = [];
    return {
        ops,
        globalAlpha: 1,
        beginPath() { ops.push(['beginPath']); },
        moveTo(x, y) { ops.push(['moveTo', x, y]); },
        lineTo(x, y) { ops.push(['lineTo', x, y]); },
        stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth, this.globalAlpha]); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; }
    };
}

const ctx = createContext();
drawWeb25DRoadOverlay({
    ctx,
    projection,
    readModel: {
        profile: { roads: BOARD_VISIBILITY.SECONDARY },
        cells
    }
});
assert.equal(
    ctx.ops.some(op => op[0] === 'stroke' && op[2] === 5 && op[3] === 0.55),
    true,
    'road base stroke consumes SECONDARY profile opacity'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'stroke' && op[2] === 1.6 && op[3] === 0.55),
    true,
    'road center stroke consumes SECONDARY profile opacity'
);
assert.equal(ctx.globalAlpha, 1, 'road overlay restores canvas alpha');

const hiddenCtx = createContext();
drawWeb25DRoadOverlay({
    ctx: hiddenCtx,
    projection,
    readModel: {
        profile: { roads: BOARD_VISIBILITY.HIDDEN },
        cells
    }
});
assert.equal(hiddenCtx.ops.length, 0, 'HIDDEN road profile emits no Web 2.5D drawing');

console.log('WEB25D_ROAD_OVERLAY_OK');
