import { resolveWeb25DTerrainTopFill } from './web25d_canvas_renderer.js';

function drawDiamond(ctx, center, halfW, halfH) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - halfH);
    ctx.lineTo(center.x + halfW, center.y);
    ctx.lineTo(center.x, center.y + halfH);
    ctx.lineTo(center.x - halfW, center.y);
    ctx.closePath();
}

function drawInvalidHatch(ctx, center, halfW, halfH) {
    const span = Math.max(4, Math.round(halfW / 4));
    ctx.save?.();
    drawDiamond(ctx, center, halfW, halfH);
    ctx.clip?.();
    ctx.beginPath();
    for (let offset = -halfW * 2; offset <= halfW * 2; offset += span) {
        ctx.moveTo(center.x + offset - halfH, center.y + halfH);
        ctx.lineTo(center.x + offset + halfH, center.y - halfH);
    }
    ctx.strokeStyle = 'rgba(224, 225, 218, 0.30)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore?.();
}

/**
 * Disposable Web-only placement preview overlay.
 *
 * Placement legality is already resolved upstream by PlacementPreviewResolver.
 * This layer only translates renderer-neutral candidate/hover data into 2.5D
 * screen-space emphasis. It must never call placement rules itself.
 */
export function drawWeb25DPlacementPreview({ ctx, projection, readModel } = {}) {
    const preview = readModel?.placementPreview;
    if (!ctx || !projection || !preview?.active) return;

    const hover = preview.hover || null;
    const hoveredAnchor = hover?.anchor || null;

    for (const candidate of preview.candidates || []) {
        if (!candidate?.valid || !candidate.anchor) continue;
        if (hoveredAnchor
            && candidate.anchor.r === hoveredAnchor.r
            && candidate.anchor.c === hoveredAnchor.c) {
            continue;
        }

        const center = projection.projectCell(candidate.anchor.r, candidate.anchor.c);
        drawDiamond(ctx, center, 7, 4);
        ctx.strokeStyle = 'rgba(192, 221, 207, 0.62)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
    }

    if (!hover?.placement?.cells?.length) return;

    const valid = Boolean(hover.valid);
    for (const cell of hover.placement.cells) {
        const center = projection.projectCell(cell.r, cell.c);
        const halfW = projection.halfW - 3;
        const halfH = projection.halfH - 2;

        drawDiamond(ctx, center, halfW, halfH);

        if (cell.terrainId) {
            ctx.save?.();
            ctx.globalAlpha = valid ? 0.78 : 0.62;
            ctx.fillStyle = resolveWeb25DTerrainTopFill({ terrainId: cell.terrainId });
            ctx.fill();
            ctx.restore?.();
        }

        ctx.strokeStyle = valid
            ? 'rgba(205, 232, 218, 0.94)'
            : 'rgba(218, 218, 207, 0.82)';
        ctx.lineWidth = valid ? 2 : 1.7;
        ctx.stroke();

        if (!valid) {
            drawInvalidHatch(ctx, center, halfW, halfH);
        }
    }
}

export default drawWeb25DPlacementPreview;
