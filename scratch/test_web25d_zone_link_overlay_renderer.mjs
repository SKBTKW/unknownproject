import assert from 'node:assert/strict';
import { drawWeb25DZoneLinkOverlay } from '../game/src/presentation/web25d_zone_link_overlay_renderer.js';

function createContext() {
    const ops = [];
    return {
        ops,
        beginPath() { ops.push(['beginPath']); },
        moveTo(x, y) { ops.push(['moveTo', x, y]); },
        lineTo(x, y) { ops.push(['lineTo', x, y]); },
        closePath() { ops.push(['closePath']); },
        stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth]); },
        fill() { ops.push(['fill', this.fillStyle]); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; }
    };
}

const projection = {
    projectCellView(cell) {
        return {
            projectedEdges: {
                EAST: [{ x: 10, y: 0 }, { x: 20, y: 5 }],
                SOUTH: [{ x: 20, y: 5 }, { x: 10, y: 10 }]
            }
        };
    }
};

const ctx = createContext();
drawWeb25DZoneLinkOverlay({
    ctx,
    projection,
    resolveTerrainTopFill: () => 'terrain-fill',
    readModel: {
        cells: [[{
            r: 0,
            c: 0,
            placed: true,
            elevation: 0,
            zone: { zoneId: 'zone:1' },
            links: [{ linkId: 'zone:1::zone:2' }],
            edges: [
                { direction: 'EAST', sameZone: true, zoneBoundary: false, linked: false, neighbor: { r: 0, c: 1 } },
                { direction: 'SOUTH', sameZone: false, zoneBoundary: true, linked: true, neighbor: { r: 1, c: 0 } }
            ]
        }]]
    }
});

assert.equal(ctx.ops.some(op => op[0] === 'stroke' && op[1] === 'terrain-fill' && op[2] === 3.4), true);
assert.equal(ctx.ops.some(op => op[0] === 'stroke' && String(op[1]).includes('255, 211, 128') && op[2] === 1.5), true);
assert.equal(ctx.ops.some(op => op[0] === 'fill' && String(op[1]).includes('255, 205, 112')), true);

console.log('web25d zone/link overlay renderer ok');
