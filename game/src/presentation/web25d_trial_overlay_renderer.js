import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import { BOARD_VISIBILITY } from './board_presentation_profile.js';
import { resolveTrialBattleMarkerState } from './trial_board_semantic_data.js';
import { resolveTrialTacticalEffectGlyph } from './trial_tactical_effect_semantic.js';

export function resolveWeb25DTrialOverlayAlpha(visibility) {
    switch (visibility) {
        case BOARD_VISIBILITY.HIDDEN:
            return 0;
        case BOARD_VISIBILITY.SUPPRESSED:
            return 0.24;
        case BOARD_VISIBILITY.SECONDARY:
            return 0.55;
        case BOARD_VISIBILITY.PRIMARY:
        case BOARD_VISIBILITY.VISIBLE:
        default:
            return 1;
    }
}

function withOverlayAlpha(ctx, alpha, draw) {
    if (!ctx || typeof draw !== 'function' || !Number.isFinite(alpha) || alpha <= 0) return;
    const previous = Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
    ctx.globalAlpha = previous * Math.min(1, alpha);
    try {
        draw();
    } finally {
        ctx.globalAlpha = previous;
    }
}

function drawDiamond(ctx, center, halfW, halfH) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - halfH);
    ctx.lineTo(center.x + halfW, center.y);
    ctx.lineTo(center.x, center.y + halfH);
    ctx.lineTo(center.x - halfW, center.y);
    ctx.closePath();
}

function drawRouteDirection(ctx, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const center = { x: from.x + dx * 0.55, y: from.y + dy * 0.55 };
    const tip = { x: center.x + ux * 5, y: center.y + uy * 5 };
    const left = { x: center.x - ux * 3 + px * 3, y: center.y - uy * 3 + py * 3 };
    const right = { x: center.x - ux * 3 - px * 3, y: center.y - uy * 3 - py * 3 };
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 185, 137, 0.96)';
    ctx.fill();
}

function entryVector(side) {
    switch (side) {
        case 'north': return { x: 0, y: -1 };
        case 'south': return { x: 0, y: 1 };
        case 'east': return { x: 1, y: 0 };
        case 'west': return { x: -1, y: 0 };
        default: return null;
    }
}

function projectTrialCell(readModel, projection, cellRef) {
    const source = readModel?.cells?.[cellRef.r]?.[cellRef.c] || null;
    const center = projection.projectCell(cellRef.r, cellRef.c);
    return {
        x: center.x,
        y: center.y - resolveWeb25DElevationPixels(source?.elevation)
    };
}

function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
}

function normalizeDefenseAllocation(item, source) {
    if (!item?.cell) return null;
    const amount = Number(item.defenseAllocation);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Object.freeze({
        cell: Object.freeze({ r: item.cell.r, c: item.cell.c }),
        routeId: item.routeId ?? null,
        amount: Math.trunc(amount),
        source
    });
}

export function resolveWeb25DDefenseAllocationMarkers(trial = {}) {
    const byCell = new Map();

    for (const item of trial.plannedIntercepts || []) {
        const marker = normalizeDefenseAllocation(item, 'PLANNED');
        if (!marker) continue;
        byCell.set(`${marker.cell.r}:${marker.cell.c}`, marker);
    }

    for (const item of trial.battleMarkers || []) {
        const marker = normalizeDefenseAllocation(item, 'BATTLE');
        if (!marker) continue;
        byCell.set(`${marker.cell.r}:${marker.cell.c}`, marker);
    }

    return Object.freeze([...byCell.values()]);
}

export function resolveWeb25DDefenseAllocationMetrics({
    tileWidth = 60,
    amount = 1
} = {}) {
    const normalizedTileWidth = Number.isFinite(tileWidth) && tileWidth > 0 ? tileWidth : 60;
    const digits = Math.max(1, String(Math.max(0, Math.trunc(Number(amount) || 0))).length);
    const compact = normalizedTileWidth < 48;

    return Object.freeze({
        compact,
        width: compact ? Math.max(20, 16 + digits * 4) : Math.max(26, 18 + digits * 6),
        height: compact ? 9 : 12,
        fontSize: compact ? 8 : 9
    });
}

export function resolveWeb25DTacticalEffectMarkers(trial = {}) {
    const byCell = new Map();

    for (const effect of trial.tacticalEffects || []) {
        if (!effect?.cell || !effect.effectId) continue;
        const key = `${effect.cell.r}:${effect.cell.c}`;
        if (!byCell.has(key)) byCell.set(key, []);
        const list = byCell.get(key);
        if (list.some(item => item.effectId === effect.effectId)) continue;
        if (list.length >= 2) continue;
        list.push(Object.freeze({
            cell: Object.freeze({ r: effect.cell.r, c: effect.cell.c }),
            effectId: effect.effectId,
            phase: effect.phase || 'AVAILABLE',
            polarity: effect.polarity || 'NEUTRAL',
            glyph: resolveTrialTacticalEffectGlyph(effect.effectId)
        }));
    }

    return Object.freeze([...byCell.values()].flat());
}

function resolveTacticalEffectStroke(effect) {
    if (effect.phase !== 'APPLIED') return 'rgba(159, 218, 229, 0.88)';
    switch (effect.polarity) {
        case 'ADVANTAGE': return 'rgba(142, 224, 167, 0.94)';
        case 'DISADVANTAGE': return 'rgba(239, 151, 139, 0.94)';
        case 'MIXED': return 'rgba(236, 205, 130, 0.94)';
        default: return 'rgba(199, 211, 216, 0.90)';
    }
}

function drawWeb25DTacticalEffectMarker(ctx, projection, center, effect, index) {
    const compact = Number(projection?.tileWidth) < 48;
    const size = compact ? 10 : 12;
    const gap = compact ? 2 : 3;
    const anchorX = center.x - Math.max(5, Number(projection?.halfW) * 0.38 || 5);
    const anchorY = center.y - Math.max(5, Number(projection?.halfH) * 0.72 || 5) - index * (size + gap);
    const x = Math.round(anchorX - size / 2);
    const y = Math.round(anchorY - size / 2);

    ctx.fillStyle = effect.phase === 'APPLIED'
        ? 'rgba(40, 38, 29, 0.94)'
        : 'rgba(25, 42, 49, 0.88)';
    ctx.fillRect?.(x, y, size, size);
    ctx.strokeStyle = resolveTacticalEffectStroke(effect);
    ctx.lineWidth = compact ? 0.7 : 0.9;
    ctx.strokeRect?.(x, y, size, size);
    ctx.font = `${compact ? 7 : 9}px "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(246, 247, 238, 0.98)';
    ctx.fillText?.(effect.glyph, anchorX, anchorY + 0.5);
}

function inferRouteEntrySide(route, readModel) {
    if (route?.entrySide) return route.entrySide;
    const entry = route?.entryCell || route?.cells?.[0] || null;
    const rows = Number(readModel?.board?.rows) || 0;
    const columns = Number(readModel?.board?.columns) || 0;
    if (!entry || rows < 1 || columns < 1) return null;
    if (entry.r === 0) return 'north';
    if (entry.r === rows - 1) return 'south';
    if (entry.c === 0) return 'west';
    if (entry.c === columns - 1) return 'east';
    return null;
}

function routeSelectorOffset(side, projection) {
    const x = Math.max(8, Number(projection?.halfW) * 0.45 || 8);
    const y = Math.max(6, Number(projection?.halfH) * 0.90 || 6);
    switch (side) {
        case 'north': return { x, y: -y };
        case 'south': return { x: -x, y };
        case 'east': return { x, y };
        case 'west': return { x: -x, y: -y };
        default: return null;
    }
}

export function resolveWeb25DTrialRouteSelectors({
    projection,
    readModel
} = {}) {
    const trial = readModel?.trial;
    const entryAlpha = resolveWeb25DTrialOverlayAlpha(readModel?.profile?.invasionEntry);
    if (!projection || !trial?.available || entryAlpha <= 0) return Object.freeze([]);
    if (trial.routeSelectionEnabled === false) return Object.freeze([]);

    const selectors = [];
    for (const route of trial.routes || []) {
        const routeId = route?.routeId ?? route?.id ?? null;
        const entryCell = route?.entryCell || route?.cells?.[0] || null;
        const entrySide = inferRouteEntrySide(route, readModel);
        if (!routeId || !entryCell || !entrySide) continue;

        const entryCenter = projectTrialCell(readModel, projection, entryCell);
        const offset = routeSelectorOffset(entrySide, projection);
        if (!offset) continue;

        selectors.push(Object.freeze({
            routeId,
            entryCell: Object.freeze({ r: entryCell.r, c: entryCell.c }),
            entrySide,
            isActive: routeId === trial.activeRouteId,
            center: Object.freeze({
                x: entryCenter.x + offset.x,
                y: entryCenter.y + offset.y
            }),
            radius: 7
        }));
    }

    return Object.freeze(selectors);
}

export function hitWeb25DTrialRouteSelector({
    point,
    projection,
    readModel
} = {}) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const selectors = resolveWeb25DTrialRouteSelectors({ projection, readModel });
    for (let i = selectors.length - 1; i >= 0; i--) {
        const selector = selectors[i];
        const dx = point.x - selector.center.x;
        const dy = point.y - selector.center.y;
        if (Math.hypot(dx, dy) <= selector.radius + 2) return selector;
    }
    return null;
}

export function resolveWeb25DTrialCandidateVisual(item, {
    selected = null,
    hovered = null
} = {}) {
    if (!item?.cell || item.canIntercept !== true) return null;

    const isSelected = sameCell(item.cell, selected);
    const isHovered = !isSelected && sameCell(item.cell, hovered);

    return Object.freeze({
        isSelected,
        isHovered,
        fillStyle: isSelected
            ? 'rgba(235, 203, 101, 0.22)'
            : isHovered
                ? 'rgba(146, 221, 231, 0.20)'
                : 'rgba(111, 195, 216, 0.03)',
        strokeStyle: isSelected
            ? 'rgba(255, 226, 132, 0.98)'
            : isHovered
                ? 'rgba(204, 247, 250, 0.98)'
                : 'rgba(141, 223, 239, 0.62)',
        lineWidth: isSelected ? 2.5 : (isHovered ? 2.2 : 1.2)
    });
}

export function resolveWeb25DPlannedInterceptVisual(item, {
    activeRouteId = null
} = {}) {
    if (!item?.cell) return null;

    const hasComparableRoute = item.routeId != null && activeRouteId != null;
    const isActiveRoute = hasComparableRoute && item.routeId === activeRouteId;
    const isOtherRoute = hasComparableRoute && item.routeId !== activeRouteId;

    return Object.freeze({
        isActiveRoute,
        isOtherRoute,
        halfW: isOtherRoute ? 6 : 7,
        halfH: isOtherRoute ? 3.5 : 4,
        fillStyle: isOtherRoute
            ? 'rgba(245, 199, 92, 0.12)'
            : 'rgba(245, 199, 92, 0.94)',
        strokeStyle: isOtherRoute
            ? 'rgba(255, 235, 172, 0.56)'
            : 'rgba(255, 235, 172, 0.96)',
        lineWidth: isOtherRoute ? 0.8 : 1
    });
}

function drawWeb25DDefenseAllocationMarker(ctx, projection, center, marker) {
    const metrics = resolveWeb25DDefenseAllocationMetrics({
        tileWidth: projection?.tileWidth,
        amount: marker.amount
    });
    const anchorX = center.x + Math.max(4, Number(projection?.halfW) * 0.36 || 4);
    const anchorY = center.y - Math.max(5, Number(projection?.halfH) * 0.72 || 5);
    const x = Math.round(anchorX - metrics.width / 2);
    const y = Math.round(anchorY - metrics.height / 2);

    ctx.fillStyle = 'rgba(24, 39, 59, 0.94)';
    ctx.fillRect?.(x, y, metrics.width, metrics.height);
    ctx.strokeStyle = 'rgba(174, 216, 239, 0.92)';
    ctx.lineWidth = metrics.compact ? 0.7 : 0.9;
    ctx.strokeRect?.(x, y, metrics.width, metrics.height);
    ctx.font = `${metrics.fontSize}px "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(239, 248, 255, 0.98)';
    ctx.fillText?.(`🛡️${marker.amount}`, anchorX, anchorY + 0.5);
}

export function resolveWeb25DBattleMarkerVisual(marker) {
    if (!marker?.cell) return null;

    const state = resolveTrialBattleMarkerState(marker);
    if (!state) return null;
    const { status, isCurrent } = state;

    if (state.isActive) {
        return Object.freeze({
            status,
            isCurrent,
            radius: isCurrent ? 6 : 5,
            fillStyle: 'rgba(255, 196, 96, 0.96)',
            strokeStyle: 'rgba(255, 228, 176, 0.92)',
            lineWidth: isCurrent ? 1.5 : 1.2
        });
    }

    if (state.isResolved) {
        return Object.freeze({
            status,
            isCurrent,
            radius: isCurrent ? 5 : 3.5,
            fillStyle: 'rgba(151, 156, 149, 0.28)',
            strokeStyle: 'rgba(211, 215, 204, 0.58)',
            lineWidth: isCurrent ? 1.1 : 0.8
        });
    }

    return Object.freeze({
        status: 'PENDING',
        isCurrent,
        radius: isCurrent ? 4.5 : 3.5,
        fillStyle: 'rgba(210, 109, 79, 0.24)',
        strokeStyle: 'rgba(239, 167, 144, 0.54)',
        lineWidth: isCurrent ? 1 : 0.8
    });
}

export function drawWeb25DTrialOverlay({ ctx, projection, readModel } = {}) {
    const trial = readModel?.trial;
    if (!ctx || !projection || !trial?.available) return;

    const profile = readModel?.profile || {};
    const routeAlpha = resolveWeb25DTrialOverlayAlpha(profile.trialRoutes);
    const entryAlpha = resolveWeb25DTrialOverlayAlpha(profile.invasionEntry);
    const interceptionAlpha = resolveWeb25DTrialOverlayAlpha(profile.interception);
    const defenseAllocationAlpha = resolveWeb25DTrialOverlayAlpha(profile.defenseAllocation);
    const battleAlpha = resolveWeb25DTrialOverlayAlpha(profile.battleMarkers);
    const tacticalEffectsAlpha = resolveWeb25DTrialOverlayAlpha(profile.tacticalEffects);

    const routes = trial.routes || [];
    const route = trial.activeRouteId != null
        ? routes.find(item => item?.routeId === trial.activeRouteId)
        : routes[0];

    if (route?.cells?.length) {
        const points = route.cells.map(cell => projectTrialCell(readModel, projection, cell));

        withOverlayAlpha(ctx, routeAlpha, () => {
            if (points.length <= 1) return;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.strokeStyle = 'rgba(147, 54, 43, 0.30)';
            ctx.lineWidth = 7;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
            ctx.strokeStyle = 'rgba(236, 111, 78, 0.92)';
            ctx.lineWidth = 2;
            ctx.stroke();

            for (let i = 0; i < points.length - 1; i++) drawRouteDirection(ctx, points[i], points[i + 1]);
        });

        const entry = route.entryCell || route.cells[0];
        if (entry) {
            withOverlayAlpha(ctx, entryAlpha, () => {
                const center = points[0] || projectTrialCell(readModel, projection, entry);
                drawDiamond(ctx, center, 10, 6);
                ctx.fillStyle = 'rgba(169, 48, 38, 0.16)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 145, 110, 0.96)';
                ctx.lineWidth = 2;
                ctx.stroke();

                const vector = entryVector(route.entrySide);
                if (vector) {
                    ctx.beginPath();
                    ctx.moveTo(center.x + vector.x * 22, center.y + vector.y * 14);
                    ctx.lineTo(center.x + vector.x * 8, center.y + vector.y * 5);
                    ctx.strokeStyle = 'rgba(255, 158, 118, 0.88)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });
        }
    }

    const selected = trial.selectedInterceptCell || null;
    const hovered = trial.hoveredInterceptCell || null;

    withOverlayAlpha(ctx, interceptionAlpha, () => {
        for (const item of trial.interceptionCandidates || []) {
            const visual = resolveWeb25DTrialCandidateVisual(item, { selected, hovered });
            if (!visual) continue;

            const center = projectTrialCell(readModel, projection, item.cell);
            drawDiamond(ctx, center, projection.halfW - 5, projection.halfH - 3);
            ctx.fillStyle = visual.fillStyle;
            ctx.fill();
            ctx.strokeStyle = visual.strokeStyle;
            ctx.lineWidth = visual.lineWidth;
            ctx.stroke();
        }

        for (const item of trial.plannedIntercepts || []) {
            const visual = resolveWeb25DPlannedInterceptVisual(item, {
                activeRouteId: trial.activeRouteId
            });
            if (!visual) continue;

            const center = projectTrialCell(readModel, projection, item.cell);
            drawDiamond(ctx, center, visual.halfW, visual.halfH);
            ctx.fillStyle = visual.fillStyle;
            ctx.fill();
            ctx.strokeStyle = visual.strokeStyle;
            ctx.lineWidth = visual.lineWidth;
            ctx.stroke();
        }
    });

    withOverlayAlpha(ctx, battleAlpha, () => {
        for (const marker of trial.battleMarkers || []) {
            const visual = resolveWeb25DBattleMarkerVisual(marker);
            if (!visual) continue;

            const center = projectTrialCell(readModel, projection, marker.cell);
            ctx.beginPath();
            ctx.arc(center.x, center.y - 4, visual.radius, 0, Math.PI * 2);
            ctx.fillStyle = visual.fillStyle;
            ctx.fill();
            ctx.strokeStyle = visual.strokeStyle;
            ctx.lineWidth = visual.lineWidth;
            ctx.stroke();
        }
    });

    withOverlayAlpha(ctx, defenseAllocationAlpha, () => {
        for (const marker of resolveWeb25DDefenseAllocationMarkers(trial)) {
            const center = projectTrialCell(readModel, projection, marker.cell);
            drawWeb25DDefenseAllocationMarker(ctx, projection, center, marker);
        }
    });

    withOverlayAlpha(ctx, tacticalEffectsAlpha, () => {
        const effects = resolveWeb25DTacticalEffectMarkers(trial);
        const perCellIndex = new Map();
        for (const effect of effects) {
            const key = `${effect.cell.r}:${effect.cell.c}`;
            const index = perCellIndex.get(key) || 0;
            perCellIndex.set(key, index + 1);
            const center = projectTrialCell(readModel, projection, effect.cell);
            drawWeb25DTacticalEffectMarker(ctx, projection, center, effect, index);
        }
    });

    withOverlayAlpha(ctx, entryAlpha, () => {
        for (const selector of resolveWeb25DTrialRouteSelectors({ projection, readModel })) {
            ctx.beginPath();
            ctx.arc(selector.center.x, selector.center.y, selector.radius, 0, Math.PI * 2);
            ctx.fillStyle = selector.isActive
                ? 'rgba(255, 185, 137, 0.96)'
                : 'rgba(169, 48, 38, 0.72)';
            ctx.fill();
            ctx.strokeStyle = selector.isActive
                ? 'rgba(255, 238, 217, 0.98)'
                : 'rgba(255, 158, 118, 0.86)';
            ctx.lineWidth = selector.isActive ? 2 : 1.2;
            ctx.stroke();
        }
    });
}

export default drawWeb25DTrialOverlay;
