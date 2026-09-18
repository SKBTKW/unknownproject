import assert from 'node:assert/strict';
import { drawWeb25DZoneLinkOverlay } from '../game/src/presentation/web25d_zone_link_overlay_renderer.js';

function createContext() {
    const strokes = [];
    return {
        strokes,
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {},
        stroke() { strokes.push({ strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; }
    };
}

const left = {
    r: 0,
    c: 0,
    placed: true,
    elevation: 0,
    zone: { zoneId: 'zone:a' },
    links: [],
    edges: [{ direction: 'EAST', sameZone: true, neighbor: { r: 0, c: 1 } }]
};
const right = {
    r: 0,
    c: 1,
    placed: true,
    elevation: 0,
    zone: { zoneId: 'zone:a' },
    links: [],
    edges: [{ direction: 'WEST', sameZone: true, neighbor: { r: 0, c: 0 } }]
};
const readModel = { cells: [[left, right]] };
const projection = {
    projectCellView(cell) {
        return {
            projectedEdges: {
                EAST: [{ x: 10, y: 0 }, { x: 20, y: 10 }],
                WEST: [{ x: 0, y: 10 }, { x: 10, y: 20 }]
            }
        };
    }
};

const visibleCtx = createContext();
drawWeb25DZoneLinkOverlay({ ctx: visibleCtx, projection, readModel });
assert.equal(visibleCtx.strokes.length > 0, true, 'shared zone edge should normally render');

const suppressedCtx = createContext();
drawWeb25DZoneLinkOverlay({
    ctx: suppressedCtx,
    projection,
    readModel,
    shouldDrawEdge: (_cell, edge) => !(edge.neighbor?.r === 0 && edge.neighbor?.c === 1)
});
assert.equal(
    suppressedCtx.strokes.length,
    0,
    'shared edge owned by a stable neighbor must be suppressible while the opposite cell materializes'
);

console.log('web25d zone-link materialization edge suppression ok');
