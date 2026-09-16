import assert from 'node:assert/strict';
import { drawWeb25DTrialOverlay } from '../game/src/presentation/web25d_trial_overlay_renderer.js';

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
        arc(x, y, radius) { ops.push(['arc', x, y, radius]); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; }
    };
}

const projection = {
    halfW: 20,
    halfH: 10,
    projectCell(r, c) { return { x: c * 40 + 20, y: r * 20 + 10 }; }
};

const ctx = createContext();
drawWeb25DTrialOverlay({
    ctx,
    projection,
    readModel: {
        cells: [
            [{ elevation: 0 }, { elevation: 1 }],
            [{ elevation: 0 }, { elevation: 0 }]
        ],
        trial: {
            available: true,
            activeRouteId: 'route:a',
            selectedInterceptCell: { r: 0, c: 1 },
            hoveredInterceptCell: { r: 1, c: 1 },
            routes: [{
                routeId: 'route:a',
                cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
                entryCell: { r: 0, c: 0 },
                entrySide: 'north'
            }],
            interceptionCandidates: [
                { cell: { r: 0, c: 1 } },
                { cell: { r: 1, c: 1 } }
            ],
            plannedIntercepts: [{ cell: { r: 1, c: 0 } }],
            battleMarkers: [{ cell: { r: 1, c: 1 }, isCurrent: true }]
        }
    }
});

assert.equal(ctx.ops.some(op => op[0] === 'arc' && op[3] === 6), true);
assert.equal(ctx.ops.some(op => op[0] === 'stroke' && op[2] === 7), true);
assert.equal(ctx.ops.some(op => op[0] === 'fill' && String(op[1]).includes('245, 199, 92')), true);

console.log('web25d trial overlay renderer ok');
