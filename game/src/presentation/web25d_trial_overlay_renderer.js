import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';

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
    const sameCell = (a, b) => Boolean(a && b && a.r === b.r && a.c === b.c);

    for (const item of trial.interceptionCandidates || []) {
        if (!item?.cell) continue;
        const center = projectTrialCell(readModel, projection, item.cell);
        const isSelected = sameCell(item.cell, selected);
        const isHovered = sameCell(item.cell, hovered);
        drawDiamond(ctx, center, projection.halfW - 5, projection.halfH - 3);
        ctx.fillStyle = isSelected
            ? 'rgba(235, 203, 101, 0.22)'
            : isHovered
                ? 'rgba(146, 221, 231, 0.20)'
                : 'rgba(111, 195, 216, 0.10)';
        ctx.fill();
        ctx.strokeStyle = isSelected
            ? 'rgba(255, 226, 132, 0.98)'
            : isHovered
                ? 'rgba(204, 247, 250, 0.98)'
                : 'rgba(141, 223, 239, 0.84)';
        ctx.lineWidth = isSelected ? 2.5 : (isHovered ? 2.2 : 1.5);
        ctx.stroke();
    }

    for (const item of trial.plannedIntercepts || []) {
        if (!item?.cell) continue;
        const center = projectTrialCell(readModel, projection, item.cell);
        drawDiamond(ctx, center, 7, 4);
        ctx.fillStyle = 'rgba(245, 199, 92, 0.94)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 235, 172, 0.96)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    for (const marker of trial.battleMarkers || []) {
        if (!marker?.cell) continue;
        const center = projectTrialCell(readModel, projection, marker.cell);
        ctx.beginPath();
        ctx.arc(center.x, center.y - 4, marker.isCurrent ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = marker.isCurrent
            ? 'rgba(255, 196, 96, 0.96)'
            : 'rgba(210, 109, 79, 0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 228, 176, 0.92)';
        ctx.lineWidth = marker.isCurrent ? 1.5 : 1;
        ctx.stroke();
    }
}

export default drawWeb25DTrialOverlay;
