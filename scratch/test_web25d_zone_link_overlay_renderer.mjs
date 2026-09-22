import assert from 'node:assert/strict';
import {
    drawWeb25DZoneLinkOverlay,
    resolveWeb25DZoneLinkEdgeStyle
} from '../game/src/presentation/web25d_zone_link_overlay_renderer.js';
import { ZONE_LINK_EDGE_KINDS } from '../game/src/presentation/board_zone_link_visual_contract.js';
import { BOARD_VISIBILITY } from '../game/src/presentation/board_presentation_profile.js';

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


const secondaryZone = resolveWeb25DZoneLinkEdgeStyle(
    ZONE_LINK_EDGE_KINDS.ZONE_BOUNDARY,
    { zoneVisibility: BOARD_VISIBILITY.SECONDARY }
);
assert.equal(secondaryZone.strokes[0].width, 1.0);
assert.equal(secondaryZone.strokes[0].style, 'rgba(221, 209, 174, 0.28)');

const secondaryLink = resolveWeb25DZoneLinkEdgeStyle(
    ZONE_LINK_EDGE_KINDS.LINK,
    { linkVisibility: BOARD_VISIBILITY.SECONDARY }
);
assert.equal(secondaryLink.strokes[0].width, 2.4);
assert.equal(secondaryLink.strokes[1].width, 1.0);
assert.equal(secondaryLink.marker.halfW, 3);
assert.equal(secondaryLink.marker.fillStyle, 'rgba(255, 205, 112, 0.42)');

assert.equal(
    resolveWeb25DZoneLinkEdgeStyle(
        ZONE_LINK_EDGE_KINDS.LINK,
        { linkVisibility: BOARD_VISIBILITY.HIDDEN }
    ),
    null
);

const secondaryCtx = createContext();
drawWeb25DZoneLinkOverlay({
    ctx: secondaryCtx,
    projection,
    resolveTerrainTopFill: () => 'terrain-fill',
    readModel: {
        profile: {
            zones: BOARD_VISIBILITY.SECONDARY,
            links: BOARD_VISIBILITY.SECONDARY
        },
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

assert.equal(
    secondaryCtx.ops.some(op => op[0] === 'stroke' && op[1] === 'terrain-fill' && op[2] === 3.4),
    false,
    'secondary Trial zone rendering must not keep the full-strength terrain-colored internal seam'
);
assert.equal(
    secondaryCtx.ops.some(op => op[0] === 'stroke' && op[1] === 'rgba(212, 220, 202, 0.16)' && op[2] === 1.2),
    true
);
assert.equal(
    secondaryCtx.ops.some(op => op[0] === 'stroke' && op[1] === 'rgba(255, 211, 128, 0.56)' && op[2] === 1.0),
    true
);
assert.equal(
    secondaryCtx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(255, 205, 112, 0.42)'),
    true
);

console.log('web25d zone/link overlay renderer ok');
