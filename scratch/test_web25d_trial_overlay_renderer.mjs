import assert from 'node:assert/strict';
import {
    drawWeb25DTrialOverlay,
    resolveWeb25DBattleMarkerVisual,
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


const pendingBattleVisual = resolveWeb25DBattleMarkerVisual({
    cell: { r: 0, c: 0 },
    status: 'PENDING',
    isCurrent: false
});
assert.equal(pendingBattleVisual.status, 'PENDING');
assert.equal(pendingBattleVisual.radius, 3.5);
assert.equal(pendingBattleVisual.fillStyle, 'rgba(210, 109, 79, 0.24)');

const activeBattleVisual = resolveWeb25DBattleMarkerVisual({
    cell: { r: 0, c: 1 },
    status: 'ACTIVE',
    isCurrent: true
});
assert.equal(activeBattleVisual.status, 'ACTIVE');
assert.equal(activeBattleVisual.radius, 6);
assert.equal(activeBattleVisual.fillStyle, 'rgba(255, 196, 96, 0.96)');
assert.equal(activeBattleVisual.lineWidth, 1.5);

const resolvedBattleVisual = resolveWeb25DBattleMarkerVisual({
    cell: { r: 0, c: 2 },
    status: 'RESOLVED',
    isCurrent: false
});
assert.equal(resolvedBattleVisual.status, 'RESOLVED');
assert.equal(resolvedBattleVisual.radius, 3.5);
assert.equal(resolvedBattleVisual.fillStyle, 'rgba(151, 156, 149, 0.28)');

const currentResolvedBattleVisual = resolveWeb25DBattleMarkerVisual({
    cell: { r: 1, c: 0 },
    status: 'RESOLVED',
    isCurrent: true
});
assert.equal(
    currentResolvedBattleVisual.radius,
    5,
    'resolved current battle remains visibly tied to the traversal context'
);
assert.equal(currentResolvedBattleVisual.lineWidth, 1.1);

assert.equal(
    resolveWeb25DBattleMarkerVisual({ cell: { r: 1, c: 1 } }).status,
    'PENDING',
    'missing status follows the semantic adapter pending fallback'
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
            battleMarkers: [
                { cell: { r: 1, c: 1 }, status: 'ACTIVE', isCurrent: true },
                { cell: { r: 1, c: 2 }, status: 'PENDING', isCurrent: false },
                { cell: { r: 0, c: 2 }, status: 'RESOLVED', isCurrent: false }
            ]
        }
    }
});

assert.equal(
    ctx.ops.some(op => op[0] === 'arc' && op[3] === 6),
    true,
    'active current battle keeps the strongest marker'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(210, 109, 79, 0.24)'),
    true,
    'pending battle remains visible as a subdued future marker'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(151, 156, 149, 0.28)'),
    true,
    'resolved battle remains visible as a neutral historical marker'
);
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

const activePlanFillIndex = ctx.ops.findIndex(
    op => op[0] === 'fill' && op[1] === 'rgba(245, 199, 92, 0.94)'
);
const activeBattleFillIndex = ctx.ops.findIndex(
    op => op[0] === 'fill' && op[1] === 'rgba(255, 196, 96, 0.96)'
);
assert.ok(
    activeBattleFillIndex > activePlanFillIndex,
    'battle markers stay above planned interception markers'
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
