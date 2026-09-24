import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Web25DPhaseERenderer } from '../game/src/presentation/web25d_phase_e_renderer.js';
import { Web25DProjectionAdapter } from '../game/src/presentation/web25d_projection_adapter.js';

function createContext() {
    const ops = [];
    return {
        ops,
        clearRect() { ops.push(['clearRect']); },
        beginPath() { ops.push(['beginPath']); },
        moveTo(x, y) { ops.push(['moveTo', x, y]); },
        lineTo(x, y) { ops.push(['lineTo', x, y]); },
        closePath() { ops.push(['closePath']); },
        arc() { ops.push(['arc']); },
        ellipse() { ops.push(['ellipse']); },
        fillRect(x, y, width, height) {
            ops.push(['fillRect', this.fillStyle, x, y, width, height]);
        },
        strokeRect(x, y, width, height) {
            ops.push(['strokeRect', this.strokeStyle, x, y, width, height]);
        },
        fill() { ops.push(['fill', this.fillStyle]); },
        stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth]); },
        fillText(text, x, y) { ops.push(['fillText', text, x, y]); },
        save() { ops.push(['save']); },
        restore() { ops.push(['restore']); },
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; },
        set font(value) { this._font = value; },
        get font() { return this._font; },
        set textAlign(value) { this._textAlign = value; },
        set textBaseline(value) { this._textBaseline = value; }
    };
}

const ctx = createContext();
const canvas = {
    width: 240,
    height: 180,
    getContext() { return ctx; }
};
const projection = new Web25DProjectionAdapter({
    tileWidth: 60,
    tileHeight: 30,
    originX: 120,
    originY: 60
});
const renderer = new Web25DPhaseERenderer({
    canvas,
    bridge: { dispatch() {} },
    projectionAdapter: projection,
    showCoordinates: false
});

renderer.readModel = {
    board: { rows: 1, columns: 1 },
    cells: [[{
        r: 0,
        c: 0,
        placed: true,
        isHQ: true,
        elevation: 0,
        greenery: 0,
        terrainId: 'E0_PLAINS',
        interaction: {},
        display: { role: 'CLEAN', production: { primaryYield: null } },
        zone: { zoneId: 'zone:hq' },
        links: [{ linkId: 'zone:hq::zone:front' }],
        edges: [{
            direction: 'SOUTH',
            sameZone: false,
            zoneBoundary: true,
            linked: true,
            neighbor: { r: 1, c: 0 }
        }]
    }]]
};

renderer.render();

const flameStyle = 'rgba(245, 116, 48, 0.96)';
const linkStyle = 'rgba(255, 211, 128, 0.94)';
const ruinStyle = 'rgba(82, 79, 70, 0.98)';

const flameIndices = ctx.ops
    .map((op, index) => op[0] === 'fill' && op[1] === flameStyle ? index : -1)
    .filter(index => index >= 0);
const linkIndex = ctx.ops.findIndex(
    op => op[0] === 'stroke' && op[1] === linkStyle && op[2] === 1.5
);
const ruinDrawCount = ctx.ops.filter(
    op => op[0] === 'fillRect' && op[1] === ruinStyle
).length;

assert.equal(flameIndices.length, 2, 'HQ beacon must draw once with the HQ and once after Zone/Link');
assert.ok(linkIndex > flameIndices[0], 'Zone/Link overlay must remain above the base HQ draw');
assert.ok(flameIndices[1] > linkIndex, 'Last Ember beacon must be restored above Zone/Link marks');
assert.equal(
    ruinDrawCount,
    3,
    'priority pass must not redraw the HQ ruin; only the three base ruin rectangles should use the main ruin fill'
);

const phaseFSource = fs.readFileSync(
    new URL('../game/src/presentation/web25d_phase_f_renderer.js', import.meta.url),
    'utf8'
);
assert.match(
    phaseFSource,
    /render\(\)\s*\{\s*super\.render\(\);\s*drawWeb25DTrialOverlay/s,
    'Trial overlay must remain above the HQ priority beacon pass'
);

console.log('WEB25D_HQ_BEACON_PRIORITY_VALIDATION_OK');
