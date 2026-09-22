import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import { resolveTrialBattleMarkerState } from './trial_board_semantic_data.js';

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
    if (!projection || !trial?.available) return Object.freeze([]);

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

    const routes = trial.routes || [];
    const route = trial.activeRouteId != null
        ? routes.find(item => item?.routeId === trial.activeRouteId)
        : routes[0];

    if (route?.cells?.length) {
        const points = route.cells.map(cell => projectTrialCell(readModel, projection, cell));
        if (points.length > 1) {
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
        }

        const entry = route.entryCell || route.cells[0];
        if (entry) {
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
        }
    }

    const selected = trial.selectedInterceptCell || null;
    const hovered = trial.hoveredInterceptCell || null;

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
}

export default drawWeb25DTrialOverlay;
