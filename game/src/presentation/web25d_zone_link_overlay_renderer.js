import {
    ZONE_LINK_EDGE_KINDS,
    buildZoneLinkVisuals
} from './board_zone_link_visual_contract.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';

function drawDiamond(ctx, center, halfW, halfH) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - halfH);
    ctx.lineTo(center.x + halfW, center.y);
    ctx.lineTo(center.x, center.y + halfH);
    ctx.lineTo(center.x - halfW, center.y);
    ctx.closePath();
}

function drawLine(ctx, points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
}

function translateEdge(points, lift) {
    return (points || []).map(point => ({ x: point.x, y: point.y - lift }));
}

function midpoint(points) {
    if (!points || points.length < 2) return null;
    return {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2
    };
}

function shouldDrawSharedEdge(cell, neighbor) {
    if (!neighbor) return true;
    if (cell.r < neighbor.r) return true;
    if (cell.r > neighbor.r) return false;
    return cell.c <= neighbor.c;
}

/**
 * Disposable Web-only Zone/Link overlay.
 *
 * Zone and Link membership are resolved upstream by BoardPresentationData.
 * This layer only translates renderer-neutral edge semantics into 2.5D marks.
 */
export function drawWeb25DZoneLinkOverlay({
    ctx,
    projection,
    readModel,
    resolveTerrainTopFill = () => 'rgba(116, 126, 112, 0.72)'
} = {}) {
    if (!ctx || !projection || !readModel) return;

    for (const row of readModel.cells || []) {
        for (const cell of row || []) {
            if (!cell?.placed) continue;
            const visuals = buildZoneLinkVisuals(cell);
            if (!visuals.zoneId && visuals.linkIds.length === 0) continue;

            const projected = projection.projectCellView(cell);
            const lift = resolveWeb25DElevationPixels(cell.elevation);
            const topFill = resolveTerrainTopFill(cell);

            for (const edge of visuals.edges) {
                if (edge.kind === ZONE_LINK_EDGE_KINDS.NONE) continue;
                if (!shouldDrawSharedEdge(cell, edge.neighbor)) continue;

                const screenEdge = projected.projectedEdges?.[edge.direction];
                if (!screenEdge) continue;
                const raisedEdge = translateEdge(screenEdge, lift);

                if (edge.kind === ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL) {
                    ctx.strokeStyle = topFill;
                    ctx.lineWidth = 3.4;
                    drawLine(ctx, raisedEdge);
                    ctx.strokeStyle = 'rgba(212, 220, 202, 0.10)';
                    ctx.lineWidth = 0.45;
                    drawLine(ctx, raisedEdge);
                    continue;
                }

                if (edge.kind === ZONE_LINK_EDGE_KINDS.ZONE_BOUNDARY) {
                    ctx.strokeStyle = 'rgba(221, 209, 174, 0.66)';
                    ctx.lineWidth = 1.8;
                    drawLine(ctx, raisedEdge);
                    continue;
                }

                if (edge.kind === ZONE_LINK_EDGE_KINDS.LINK) {
                    ctx.strokeStyle = 'rgba(238, 181, 91, 0.34)';
                    ctx.lineWidth = 4.4;
                    drawLine(ctx, raisedEdge);
                    ctx.strokeStyle = 'rgba(255, 211, 128, 0.94)';
                    ctx.lineWidth = 1.5;
                    drawLine(ctx, raisedEdge);

                    const center = midpoint(raisedEdge);
                    if (center) {
                        drawDiamond(ctx, center, 4, 2.5);
                        ctx.fillStyle = 'rgba(255, 205, 112, 0.90)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255, 232, 176, 0.92)';
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            }
        }
    }
}

export default drawWeb25DZoneLinkOverlay;
