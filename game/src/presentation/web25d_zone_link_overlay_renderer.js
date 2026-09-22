import {
    ZONE_LINK_EDGE_KINDS,
    buildZoneLinkVisuals
} from './board_zone_link_visual_contract.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import { BOARD_VISIBILITY } from './board_presentation_profile.js';

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

function normalizeVisibility(value) {
    return Object.values(BOARD_VISIBILITY).includes(value)
        ? value
        : BOARD_VISIBILITY.VISIBLE;
}

function visibilityTier(value) {
    const visibility = normalizeVisibility(value);
    if (visibility === BOARD_VISIBILITY.HIDDEN) return 'HIDDEN';
    if (visibility === BOARD_VISIBILITY.SUPPRESSED) return 'SUPPRESSED';
    if (visibility === BOARD_VISIBILITY.SECONDARY) return 'SECONDARY';
    return 'FULL';
}

export function resolveWeb25DZoneLinkEdgeStyle(edgeKind, {
    zoneVisibility = BOARD_VISIBILITY.VISIBLE,
    linkVisibility = BOARD_VISIBILITY.VISIBLE,
    terrainTopFill = 'rgba(116, 126, 112, 0.72)'
} = {}) {
    const zoneTier = visibilityTier(zoneVisibility);
    const linkTier = visibilityTier(linkVisibility);

    if (edgeKind === ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL) {
        if (zoneTier === 'HIDDEN') return null;
        if (zoneTier === 'SUPPRESSED') {
            return Object.freeze({
                strokes: Object.freeze([
                    Object.freeze({ style: 'rgba(212, 220, 202, 0.08)', width: 0.8 })
                ]),
                marker: null
            });
        }
        if (zoneTier === 'SECONDARY') {
            return Object.freeze({
                strokes: Object.freeze([
                    Object.freeze({ style: 'rgba(212, 220, 202, 0.16)', width: 1.2 })
                ]),
                marker: null
            });
        }
        return Object.freeze({
            strokes: Object.freeze([
                Object.freeze({ style: terrainTopFill, width: 3.4 }),
                Object.freeze({ style: 'rgba(212, 220, 202, 0.10)', width: 0.45 })
            ]),
            marker: null
        });
    }

    if (edgeKind === ZONE_LINK_EDGE_KINDS.ZONE_BOUNDARY) {
        if (zoneTier === 'HIDDEN') return null;
        const stroke = zoneTier === 'SUPPRESSED'
            ? { style: 'rgba(221, 209, 174, 0.14)', width: 0.8 }
            : zoneTier === 'SECONDARY'
                ? { style: 'rgba(221, 209, 174, 0.28)', width: 1.0 }
                : { style: 'rgba(221, 209, 174, 0.66)', width: 1.8 };
        return Object.freeze({
            strokes: Object.freeze([Object.freeze(stroke)]),
            marker: null
        });
    }

    if (edgeKind === ZONE_LINK_EDGE_KINDS.LINK) {
        if (linkTier === 'HIDDEN') return null;
        if (linkTier === 'SUPPRESSED') {
            return Object.freeze({
                strokes: Object.freeze([
                    Object.freeze({ style: 'rgba(238, 181, 91, 0.08)', width: 1.6 }),
                    Object.freeze({ style: 'rgba(255, 211, 128, 0.26)', width: 0.8 })
                ]),
                marker: Object.freeze({
                    halfW: 2.5,
                    halfH: 1.5,
                    fillStyle: 'rgba(255, 205, 112, 0.20)',
                    strokeStyle: 'rgba(255, 232, 176, 0.26)',
                    lineWidth: 0.6
                })
            });
        }
        if (linkTier === 'SECONDARY') {
            return Object.freeze({
                strokes: Object.freeze([
                    Object.freeze({ style: 'rgba(238, 181, 91, 0.14)', width: 2.4 }),
                    Object.freeze({ style: 'rgba(255, 211, 128, 0.56)', width: 1.0 })
                ]),
                marker: Object.freeze({
                    halfW: 3,
                    halfH: 2,
                    fillStyle: 'rgba(255, 205, 112, 0.42)',
                    strokeStyle: 'rgba(255, 232, 176, 0.52)',
                    lineWidth: 0.7
                })
            });
        }
        return Object.freeze({
            strokes: Object.freeze([
                Object.freeze({ style: 'rgba(238, 181, 91, 0.34)', width: 4.4 }),
                Object.freeze({ style: 'rgba(255, 211, 128, 0.94)', width: 1.5 })
            ]),
            marker: Object.freeze({
                halfW: 4,
                halfH: 2.5,
                fillStyle: 'rgba(255, 205, 112, 0.90)',
                strokeStyle: 'rgba(255, 232, 176, 0.92)',
                lineWidth: 0.8
            })
        });
    }

    return null;
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
    resolveTerrainTopFill = () => 'rgba(116, 126, 112, 0.72)',
    shouldDrawCell = () => true,
    shouldDrawEdge = () => true
} = {}) {
    if (!ctx || !projection || !readModel) return;

    for (const row of readModel.cells || []) {
        for (const cell of row || []) {
            if (!cell?.placed || !shouldDrawCell(cell)) continue;
            const visuals = buildZoneLinkVisuals(cell);
            if (!visuals.zoneId && visuals.linkIds.length === 0) continue;

            const projected = projection.projectCellView(cell);
            const lift = resolveWeb25DElevationPixels(cell.elevation);
            const topFill = resolveTerrainTopFill(cell);

            for (const edge of visuals.edges) {
                if (edge.kind === ZONE_LINK_EDGE_KINDS.NONE) continue;
                if (!shouldDrawEdge(cell, edge)) continue;
                if (!shouldDrawSharedEdge(cell, edge.neighbor)) continue;

                const screenEdge = projected.projectedEdges?.[edge.direction];
                if (!screenEdge) continue;
                const raisedEdge = translateEdge(screenEdge, lift);

                const style = resolveWeb25DZoneLinkEdgeStyle(edge.kind, {
                    zoneVisibility: readModel.profile?.zones,
                    linkVisibility: readModel.profile?.links,
                    terrainTopFill: topFill
                });
                if (!style) continue;

                for (const stroke of style.strokes || []) {
                    ctx.strokeStyle = stroke.style;
                    ctx.lineWidth = stroke.width;
                    drawLine(ctx, raisedEdge);
                }

                if (style.marker) {
                    const center = midpoint(raisedEdge);
                    if (center) {
                        drawDiamond(ctx, center, style.marker.halfW, style.marker.halfH);
                        ctx.fillStyle = style.marker.fillStyle;
                        ctx.fill();
                        ctx.strokeStyle = style.marker.strokeStyle;
                        ctx.lineWidth = style.marker.lineWidth;
                        ctx.stroke();
                    }
                }
            }
        }
    }
}

export default drawWeb25DZoneLinkOverlay;
