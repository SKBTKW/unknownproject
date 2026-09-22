import assert from 'node:assert/strict';
import {
    drawWeb25DTrialOverlay,
    resolveWeb25DPlannedInterceptVisual,
    resolveWeb25DTrialCandidateVisual
} from '../game/src/presentation/web25d_trial_overlay_renderer.js';

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

assert.equal(
    resolveWeb25DTrialCandidateVisual({ cell: { r: 0, c: 0 }, canIntercept: false }),
    null,
    'blocked route cells must not render as interception candidates'
);
assert.equal(
    resolveWeb25DTrialCandidateVisual({ cell: { r: 0, c: 0 } }),
    null,
    'candidate rendering requires explicit legal interception semantics'
);

const passiveVisual = resolveWeb25DTrialCandidateVisual({
    cell: { r: 0, c: 0 },
    canIntercept: true
});
assert.equal(passiveVisual.lineWidth, 1.2);
assert.ok(passiveVisual.fillStyle.endsWith('0.03)'));
assert.ok(passiveVisual.strokeStyle.endsWith('0.62)'));

const selectedVisual = resolveWeb25DTrialCandidateVisual(
    { cell: { r: 0, c: 0 }, canIntercept: true },
    {
        selected: { r: 0, c: 0 },
        hovered: { r: 0, c: 0 }
    }
);
assert.equal(selectedVisual.isSelected, true);
assert.equal(selectedVisual.isHovered, false, 'selected state has priority over hover');
assert.equal(selectedVisual.lineWidth, 2.5);


const activePlanVisual = resolveWeb25DPlannedInterceptVisual(
    { cell: { r: 0, c: 0 }, routeId: 'route:a' },
    { activeRouteId: 'route:a' }
);
assert.equal(activePlanVisual.isActiveRoute, true);
assert.equal(activePlanVisual.isOtherRoute, false);
assert.equal(activePlanVisual.fillStyle, 'rgba(245, 199, 92, 0.94)');
assert.equal(activePlanVisual.lineWidth, 1);

const otherPlanVisual = resolveWeb25DPlannedInterceptVisual(
    { cell: { r: 0, c: 1 }, routeId: 'route:b' },
    { activeRouteId: 'route:a' }
);
assert.equal(otherPlanVisual.isActiveRoute, false);
assert.equal(otherPlanVisual.isOtherRoute, true);
assert.equal(otherPlanVisual.fillStyle, 'rgba(245, 199, 92, 0.12)');
assert.equal(otherPlanVisual.lineWidth, 0.8);

const neutralPlanVisual = resolveWeb25DPlannedInterceptVisual(
    { cell: { r: 0, c: 2 }, routeId: 'route:b' },
    { activeRouteId: null }
);
assert.equal(
    neutralPlanVisual.fillStyle,
    'rgba(245, 199, 92, 0.94)',
    'when there is no active route, planned intercepts retain their existing primary visibility'
);

const ctx = createContext();
drawWeb25DTrialOverlay({
    ctx,
    projection,
    readModel: {
        cells: [
            [{ elevation: 0 }, { elevation: 1 }, { elevation: 0 }],
            [{ elevation: 0 }, { elevation: 0 }, { elevation: 0 }]
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
                { cell: { r: 0, c: 1 }, canIntercept: true },
                { cell: { r: 1, c: 1 }, canIntercept: true },
                { cell: { r: 1, c: 2 }, canIntercept: true },
                {
                    cell: { r: 0, c: 2 },
                    canIntercept: false,
                    isBlockPlannedByOther: true,
                    reason: 'BLOCK_ALREADY_PLANNED'
                }
            ],
            plannedIntercepts: [
                { cell: { r: 1, c: 0 }, routeId: 'route:a' },
                { cell: { r: 0, c: 2 }, routeId: 'route:b' }
            ],
            battleMarkers: [{ cell: { r: 1, c: 1 }, isCurrent: true }]
        }
    }
});

assert.equal(ctx.ops.some(op => op[0] === 'arc' && op[3] === 6), true);
assert.equal(ctx.ops.some(op => op[0] === 'stroke' && op[2] === 7), true);
assert.equal(
    ctx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(245, 199, 92, 0.94)'),
    true,
    'active-route planned intercept keeps primary emphasis'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(245, 199, 92, 0.12)'),
    true,
    'other-route planned intercept stays visible but secondary'
);

const candidateStrokes = ctx.ops.filter(
    op => op[0] === 'stroke'
        && (
            String(op[1]).includes('255, 226, 132')
            || String(op[1]).includes('204, 247, 250')
            || String(op[1]).includes('141, 223, 239')
        )
);
assert.equal(
    candidateStrokes.length,
    3,
    'selected, hovered, and passive legal candidates render; blocked route cells stay out of the candidate layer'
);
assert.equal(
    candidateStrokes.some(op => op[2] === 1.2),
    true,
    'passive legal candidates keep a quieter outline'
);

console.log('web25d trial overlay renderer ok');
