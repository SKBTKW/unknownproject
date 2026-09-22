import assert from 'node:assert/strict';
import { BOARD_VISIBILITY } from '../game/src/presentation/board_presentation_profile.js';
import {
    drawWeb25DTrialOverlay,
    hitWeb25DTrialRouteSelector,
    resolveWeb25DBattleMarkerVisual,
    resolveWeb25DDefenseAllocationMarkers,
    resolveWeb25DDefenseAllocationMetrics,
    resolveWeb25DPlannedInterceptVisual,
    resolveWeb25DTacticalEffectMarkers,
    resolveWeb25DTrialCandidateVisual,
    resolveWeb25DTrialOverlayAlpha,
    resolveWeb25DTrialRouteSelectors
} from '../game/src/presentation/web25d_trial_overlay_renderer.js';

function createContext() {
    const ops = [];
    return {
        ops,
        beginPath() { ops.push(['beginPath']); },
        moveTo(x, y) { ops.push(['moveTo', x, y]); },
        lineTo(x, y) { ops.push(['lineTo', x, y]); },
        closePath() { ops.push(['closePath']); },
        globalAlpha: 1,
        stroke() { ops.push(['stroke', this.strokeStyle, this.lineWidth, this.globalAlpha]); },
        fill() { ops.push(['fill', this.fillStyle, this.globalAlpha]); },
        arc(x, y, radius) { ops.push(['arc', x, y, radius, this.globalAlpha]); },
        fillRect(x, y, width, height) { ops.push(['fillRect', x, y, width, height, this.fillStyle, this.globalAlpha]); },
        strokeRect(x, y, width, height) { ops.push(['strokeRect', x, y, width, height, this.strokeStyle, this.globalAlpha]); },
        fillText(value, x, y) { ops.push(['fillText', value, x, y, this.fillStyle, this.globalAlpha]); },
        set strokeStyle(value) { this._strokeStyle = value; },
        get strokeStyle() { return this._strokeStyle; },
        set fillStyle(value) { this._fillStyle = value; },
        get fillStyle() { return this._fillStyle; },
        set lineWidth(value) { this._lineWidth = value; },
        get lineWidth() { return this._lineWidth; }
    };
}

assert.equal(resolveWeb25DTrialOverlayAlpha(BOARD_VISIBILITY.PRIMARY), 1);
assert.equal(resolveWeb25DTrialOverlayAlpha(BOARD_VISIBILITY.VISIBLE), 1);
assert.equal(resolveWeb25DTrialOverlayAlpha(BOARD_VISIBILITY.SECONDARY), 0.55);
assert.equal(resolveWeb25DTrialOverlayAlpha(BOARD_VISIBILITY.SUPPRESSED), 0.24);
assert.equal(resolveWeb25DTrialOverlayAlpha(BOARD_VISIBILITY.HIDDEN), 0);

const projection = {
    halfW: 20,
    halfH: 10,
    projectCell(r, c) { return { x: c * 40 + 20, y: r * 20 + 10 }; }
};

const routeSelectorReadModel = {
    board: { rows: 2, columns: 3 },
    cells: [
        [{ elevation: 0 }, { elevation: 0 }, { elevation: 0 }],
        [{ elevation: 0 }, { elevation: 0 }, { elevation: 0 }]
    ],
    trial: {
        available: true,
        activeRouteId: 'route:a',
        routes: [
            {
                routeId: 'route:a',
                entryCell: { r: 0, c: 0 },
                entrySide: 'north',
                cells: [{ r: 0, c: 0 }]
            },
            {
                routeId: 'route:b',
                entryCell: { r: 1, c: 2 },
                entrySide: 'east',
                cells: [{ r: 1, c: 2 }]
            }
        ]
    }
};

const routeSelectors = resolveWeb25DTrialRouteSelectors({
    projection,
    readModel: routeSelectorReadModel
});
assert.equal(routeSelectors.length, 2);
assert.equal(routeSelectors[0].routeId, 'route:a');
assert.equal(routeSelectors[0].isActive, true);
assert.equal(routeSelectors[1].routeId, 'route:b');
assert.equal(routeSelectors[1].isActive, false);
assert.notDeepEqual(
    routeSelectors[0].center,
    projection.projectCell(0, 0),
    'route selector stays outside the entry cell hit area'
);
assert.equal(
    hitWeb25DTrialRouteSelector({
        point: routeSelectors[1].center,
        projection,
        readModel: routeSelectorReadModel
    })?.routeId,
    'route:b'
);

assert.deepEqual(
    resolveWeb25DTrialRouteSelectors({
        projection,
        readModel: {
            ...routeSelectorReadModel,
            trial: {
                ...routeSelectorReadModel.trial,
                battleMarkers: [
                    { cell: { r: 0, c: 1 }, routeId: 'route:a', status: 'ACTIVE', isCurrent: true }
                ]
            }
        }
    }),
    [],
    'route selectors are hidden while a battle is current'
);

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


const allocationMarkers = resolveWeb25DDefenseAllocationMarkers({
    plannedIntercepts: [
        { cell: { r: 0, c: 0 }, routeId: 'route:a', defenseAllocation: 2 },
        { cell: { r: 0, c: 1 }, routeId: 'route:b', defenseAllocation: 4 }
    ],
    battleMarkers: [
        { cell: { r: 0, c: 1 }, routeId: 'route:b', defenseAllocation: 5 }
    ]
});
assert.deepEqual(
    allocationMarkers.map(marker => [marker.cell.r, marker.cell.c, marker.amount, marker.source]),
    [
        [0, 0, 2, 'PLANNED'],
        [0, 1, 5, 'BATTLE']
    ],
    'battle allocation replaces the planned value on the same interception cell'
);
assert.deepEqual(
    resolveWeb25DDefenseAllocationMetrics({ tileWidth: 38, amount: 12 }),
    { compact: true, width: 24, height: 9, fontSize: 8 },
    'narrow 9x9 projection uses compact defense allocation chip metrics'
);
assert.deepEqual(
    resolveWeb25DDefenseAllocationMetrics({ tileWidth: 60, amount: 12 }),
    { compact: false, width: 30, height: 12, fontSize: 9 },
    'normal projection retains readable defense allocation chip metrics'
);


const tacticalMarkers = resolveWeb25DTacticalEffectMarkers({
    tacticalEffects: [
        { cell: { r: 0, c: 0 }, effectId: 'HIGH_GROUND', phase: 'AVAILABLE', polarity: 'NEUTRAL' },
        { cell: { r: 0, c: 0 }, effectId: 'WETLAND_EXIT', phase: 'AVAILABLE', polarity: 'NEUTRAL' },
        { cell: { r: 0, c: 0 }, effectId: 'DESERT_EXIT', phase: 'AVAILABLE', polarity: 'NEUTRAL' },
        { cell: { r: 0, c: 0 }, effectId: 'HIGH_GROUND', phase: 'APPLIED', polarity: 'ADVANTAGE' }
    ]
});
assert.deepEqual(
    tacticalMarkers.map(marker => marker.glyph),
    ['▲', '≋'],
    '2.5D tactical markers dedupe by effect and cap cell clutter at two badges'
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
            routes: [
                {
                    routeId: 'route:a',
                    cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
                    entryCell: { r: 0, c: 0 },
                    entrySide: 'north'
                },
                {
                    routeId: 'route:b',
                    cells: [{ r: 1, c: 2 }, { r: 1, c: 1 }],
                    entryCell: { r: 1, c: 2 },
                    entrySide: 'east'
                }
            ],
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
                { cell: { r: 1, c: 0 }, routeId: 'route:a', defenseAllocation: 3 },
                { cell: { r: 0, c: 2 }, routeId: 'route:b', defenseAllocation: 2 }
            ],
            battleMarkers: [
                { cell: { r: 1, c: 1 }, status: 'ACTIVE', isCurrent: true, defenseAllocation: 4 },
                { cell: { r: 1, c: 2 }, status: 'PENDING', isCurrent: false, defenseAllocation: 1 },
                { cell: { r: 0, c: 2 }, status: 'RESOLVED', isCurrent: false, defenseAllocation: 5 }
            ],
            tacticalEffects: [
                { cell: { r: 1, c: 0 }, effectId: 'HIGH_GROUND', phase: 'AVAILABLE', polarity: 'NEUTRAL' },
                { cell: { r: 0, c: 2 }, effectId: 'WETLAND_EXIT', phase: 'APPLIED', polarity: 'ADVANTAGE' }
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

assert.equal(
    ctx.ops.some(op => op[0] === 'fillText' && op[1] === '🛡️3'),
    true,
    'planned interception defense allocation is rendered as a board chip'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'fillText' && op[1] === '🛡️5'),
    true,
    'battle allocation replaces the planned allocation on the same cell'
);
assert.equal(
    ctx.ops.filter(op => op[0] === 'fillText' && op[1] === '🛡️2').length,
    0,
    'overlapped planned allocation does not produce a duplicate chip under a battle marker'
);

assert.equal(
    ctx.ops.some(op => op[0] === 'fillText' && op[1] === '▲'),
    true,
    'available high-ground tactical effect renders on the board'
);
assert.equal(
    ctx.ops.some(op => op[0] === 'fillText' && op[1] === '≋'),
    true,
    'applied wetland tactical effect remains on the resolved battle cell'
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

const routeSelectorArcs = ctx.ops.filter(op => op[0] === 'arc' && op[3] === 7);
assert.equal(
    routeSelectorArcs.length,
    0,
    'route selectors stay hidden while the draw model has a current battle'
);

const profileCtx = createContext();
drawWeb25DTrialOverlay({
    ctx: profileCtx,
    projection,
    readModel: {
        profile: {
            trialRoutes: BOARD_VISIBILITY.SECONDARY,
            invasionEntry: BOARD_VISIBILITY.SUPPRESSED,
            interception: BOARD_VISIBILITY.SECONDARY,
            defenseAllocation: BOARD_VISIBILITY.SECONDARY,
            battleMarkers: BOARD_VISIBILITY.SUPPRESSED,
            tacticalEffects: BOARD_VISIBILITY.SECONDARY
        },
        board: { rows: 2, columns: 2 },
        cells: [
            [{ elevation: 0 }, { elevation: 0 }],
            [{ elevation: 0 }, { elevation: 0 }]
        ],
        trial: {
            available: true,
            activeRouteId: 'route:a',
            selectedInterceptCell: null,
            hoveredInterceptCell: null,
            routes: [{
                routeId: 'route:a',
                cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
                entryCell: { r: 0, c: 0 },
                entrySide: 'north'
            }],
            interceptionCandidates: [{ cell: { r: 0, c: 1 }, canIntercept: true }],
            plannedIntercepts: [{ cell: { r: 0, c: 1 }, routeId: 'route:a', defenseAllocation: 6 }],
            battleMarkers: [{ cell: { r: 1, c: 1 }, status: 'ACTIVE', isCurrent: true, defenseAllocation: 7 }],
            tacticalEffects: [{
                cell: { r: 0, c: 1 },
                effectId: 'HIGH_GROUND',
                phase: 'AVAILABLE',
                polarity: 'NEUTRAL'
            }]
        }
    }
});

assert.equal(
    profileCtx.ops.some(op => op[0] === 'stroke' && op[2] === 7 && op[3] === 0.55),
    true,
    'Trial route stroke consumes trialRoutes SECONDARY opacity'
);
assert.equal(
    profileCtx.ops.some(op => op[0] === 'stroke' && op[1] === 'rgba(255, 145, 110, 0.96)' && op[3] === 0.24),
    true,
    'invasion entry marker consumes SUPPRESSED opacity independently of route path'
);
assert.equal(
    profileCtx.ops.some(op => op[0] === 'stroke' && op[1] === 'rgba(141, 223, 239, 0.62)' && op[3] === 0.55),
    true,
    'interception layer consumes SECONDARY opacity'
);
assert.equal(
    profileCtx.ops.some(op => op[0] === 'fill' && op[1] === 'rgba(255, 196, 96, 0.96)' && op[2] === 0.24),
    true,
    'battle markers consume SUPPRESSED opacity'
);

assert.equal(
    profileCtx.ops.some(op => op[0] === 'fillText' && op[1] === '🛡️6' && op[5] === 0.55),
    true,
    'defense allocation chips consume their own SECONDARY profile opacity'
);

assert.equal(
    profileCtx.ops.some(op => op[0] === 'fillText' && op[1] === '▲' && op[5] === 0.55),
    true,
    'tactical effect markers consume their own SECONDARY profile opacity'
);
assert.equal(profileCtx.globalAlpha, 1, 'Trial overlay alpha must be restored after layered drawing');

const hiddenEntryReadModel = {
    ...routeSelectorReadModel,
    profile: { invasionEntry: BOARD_VISIBILITY.HIDDEN }
};
assert.deepEqual(
    resolveWeb25DTrialRouteSelectors({ projection, readModel: hiddenEntryReadModel }),
    [],
    'hidden invasionEntry removes route selectors from both drawing and hit testing'
);

console.log('web25d trial overlay renderer ok');
