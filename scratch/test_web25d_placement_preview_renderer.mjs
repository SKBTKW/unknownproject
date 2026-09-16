import assert from 'node:assert/strict';
import { drawWeb25DPlacementPreview } from '../game/src/presentation/web25d_placement_preview_renderer.js';

function createContext() {
    const ops = [];
    return {
        ops,
        beginPath() { ops.push(['beginPath']); },
        moveTo(x, y) { ops.push(['moveTo', x, y]); },
        lineTo(x, y) { ops.push(['lineTo', x, y]); },
        closePath() { ops.push(['closePath']); },
        stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth]); },
        save() { ops.push(['save']); },
        restore() { ops.push(['restore']); },
        clip() { ops.push(['clip']); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
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
drawWeb25DPlacementPreview({
    ctx,
    projection,
    readModel: {
        placementPreview: {
            active: true,
            candidates: [
                { valid: true, anchor: { r: 0, c: 0 } },
                { valid: false, anchor: { r: 0, c: 1 } }
            ],
            hover: {
                valid: false,
                anchor: { r: 1, c: 1 },
                placement: { cells: [{ r: 1, c: 1 }] }
            }
        }
    }
});

assert.equal(ctx.ops.some(op => op[0] === 'clip'), true);
assert.equal(ctx.ops.some(op => op[0] === 'stroke' && String(op[1]).includes('224, 225, 218')), true);
assert.equal(ctx.ops.some(op => op[0] === 'fill'), false);

console.log('web25d placement preview renderer ok');
