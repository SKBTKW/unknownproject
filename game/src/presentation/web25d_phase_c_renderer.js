import {
    Web25DCanvasRenderer,
    resolveWeb25DElevationPixels
} from './web25d_canvas_renderer.js';
import {
    ZONE_LINK_EDGE_KINDS,
    buildZoneLinkVisuals
} from './board_zone_link_visual_contract.js';

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
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
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

function resourceCode(resource) {
    switch (resource) {
        case 'food': return 'F';
        case 'wood': return 'M';
        case 'defense': return 'D';
        case 'mystic': return 'X';
        default: return '?';
    }
}

/**
 * Phase 2.5D-C/D/E visual layer.
 *
 * Adds HQ, Resource Socket, interaction emphasis, multi-cell placement
 * continuity, presentation-provided LAND_PRIMARY production markers,
 * renderer-neutral placement-preview semantics and Zone/Link edge visuals on
 * top of the Phase B terrain renderer. This file remains disposable Web-only
 * rendering code and never recalculates placement, production, Zone or Link
 * semantics.
 */
export class Web25DPhaseCRenderer extends Web25DCanvasRenderer {
    render() {
        super.render();
        this.drawPlacementPreview();
    }

    drawUnplacedCell(cell, projected) {
        super.drawUnplacedCell(cell, projected);
        if (cell.hasSocket) this.drawDormantSocketCore(projected.screenCenter);
        this.drawInteractionEmphasis(cell, projected.screenCenter, 0);
    }

    drawPlacedTerrain(cell, projected) {
        super.drawPlacedTerrain(cell, projected);
        const lift = resolveWeb25DElevationPixels(cell.elevation);
        const center = {
            x: projected.screenCenter.x,
            y: projected.screenCenter.y - lift
        };

        this.drawPlacementContinuity(cell, projected, lift);
        this.drawZoneLinkVisuals(cell, projected, lift);

        if (cell.isHQ) {
            this.drawHQ(center);
        } else if (cell.socketResource) {
            this.drawResolvedResource(cell.socketResource, center);
        } else if (cell.hasSocket) {
            this.drawDormantSocketCore(center);
        }

        this.drawLandPrimaryMarker(cell, center);
        this.drawInteractionEmphasis(cell, center, lift);
    }

    drawPlacementPreview() {
        const preview = this.readModel?.placementPreview;
        if (!preview?.active) return;

        const ctx = this.ctx;
        const hover = preview.hover || null;
        const hoveredAnchor = hover?.anchor || null;

        for (const candidate of preview.candidates || []) {
            if (!candidate?.valid || !candidate.anchor) continue;
            if (hoveredAnchor
                && candidate.anchor.r === hoveredAnchor.r
                && candidate.anchor.c === hoveredAnchor.c) {
                continue;
            }
            const center = this.projection.projectCell(candidate.anchor.r, candidate.anchor.c);
            drawDiamond(ctx, center, 7, 4);
            ctx.fillStyle = 'rgba(92, 210, 170, 0.24)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(116, 232, 193, 0.78)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        if (!hover?.placement?.cells?.length) return;
        const valid = Boolean(hover.valid);
        for (const cell of hover.placement.cells) {
            const center = this.projection.projectCell(cell.r, cell.c);
            drawDiamond(ctx, center, this.projection.halfW - 3, this.projection.halfH - 2);
            ctx.fillStyle = valid
                ? 'rgba(47, 207, 160, 0.20)'
                : 'rgba(224, 74, 74, 0.20)';
            ctx.fill();
            ctx.strokeStyle = valid
                ? 'rgba(105, 244, 199, 0.96)'
                : 'rgba(255, 111, 111, 0.96)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
    }

    drawPlacementContinuity(cell, projected, lift) {
        const samePlacementEdges = (cell.edges || []).filter(edge => edge?.samePlacementGroup);
        if (samePlacementEdges.length === 0) return;

        const ctx = this.ctx;
        const topFill = this.resolveTerrainTopFill(cell);

        for (const edge of samePlacementEdges) {
            const screenEdge = projected.projectedEdges?.[edge.direction];
            if (!screenEdge) continue;
            const raisedEdge = translateEdge(screenEdge, lift);

            // Paint back most of the ordinary cell outline so cells from the
            // same placement read as one block while the logical split remains
            // faintly visible for interaction and debugging.
            ctx.strokeStyle = topFill;
            ctx.lineWidth = 2.6;
            drawLine(ctx, raisedEdge);

            ctx.strokeStyle = 'rgba(190, 205, 192, 0.18)';
            ctx.lineWidth = 0.6;
            drawLine(ctx, raisedEdge);
        }
    }

    drawZoneLinkVisuals(cell, projected, lift) {
        const visuals = buildZoneLinkVisuals(cell);
        if (!visuals.zoneId && visuals.linkIds.length === 0) return;

        const ctx = this.ctx;
        const topFill = this.resolveTerrainTopFill(cell);

        for (const edge of visuals.edges) {
            if (edge.kind === ZONE_LINK_EDGE_KINDS.NONE) continue;
            if (!shouldDrawSharedEdge(cell, edge.neighbor)) continue;

            const screenEdge = projected.projectedEdges?.[edge.direction];
            if (!screenEdge) continue;
            const raisedEdge = translateEdge(screenEdge, lift);

            if (edge.kind === ZONE_LINK_EDGE_KINDS.ZONE_INTERNAL) {
                // A Zone should read as one territorial mass. First erase most
                // of the ordinary per-cell seam, then keep only a very faint
                // construction line so cell-level interaction remains legible.
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

    drawLandPrimaryMarker(cell, center) {
        if (cell.display?.role !== 'LAND_PRIMARY') return;

        const production = cell.display?.production || null;
        const primary = production?.primaryYield || null;
        const label = primary
            ? `${resourceCode(primary.resource)}${primary.amount}`
            : 'P';

        const ctx = this.ctx;
        const width = Math.max(14, 7 + label.length * 6);
        const x = Math.round(center.x - width / 2);
        const y = Math.round(center.y + 5);

        ctx.fillStyle = 'rgba(31, 35, 31, 0.78)';
        ctx.fillRect(x, y, width, 10);
        ctx.strokeStyle = 'rgba(218, 224, 207, 0.58)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect?.(x, y, width, 10);

        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(236, 238, 222, 0.92)';
        ctx.fillText(label, center.x, y + 5);
    }

    drawDormantSocketCore(center) {
        const ctx = this.ctx;
        ctx.save?.();
        ctx.beginPath();
        ctx.arc(center.x, center.y - 2, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(248, 225, 164, 0.12)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(center.x, center.y - 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 238, 187, 0.88)';
        ctx.fill();
        ctx.restore?.();
    }

    drawResolvedResource(resource, center) {
        const ctx = this.ctx;
        const category = String(resource?.category || '').toUpperCase();
        const id = String(resource?.id || '').toUpperCase();
        const waterLike = category.includes('WATER') || id.includes('LAKE') || id.includes('OASIS');
        const mysticLike = category.includes('MYSTIC') || category.includes('CRYSTAL') || id.includes('CRYSTAL');
        const plantLike = category.includes('PLANT') || category.includes('FOOD') || id.includes('GRAIN');
        const animalLike = category.includes('ANIMAL') || id.includes('ANIMAL');

        if (waterLike) {
            ctx.beginPath();
            ctx.ellipse(center.x, center.y + 2, 10, 4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(96, 157, 181, 0.88)';
            ctx.fill();
            return;
        }

        if (mysticLike) {
            drawDiamond(ctx, { x: center.x, y: center.y - 7 }, 4, 8);
            ctx.fillStyle = 'rgba(194, 171, 227, 0.92)';
            ctx.fill();
            return;
        }

        if (plantLike) {
            ctx.beginPath();
            ctx.moveTo(center.x, center.y + 3);
            ctx.lineTo(center.x, center.y - 7);
            ctx.moveTo(center.x, center.y - 2);
            ctx.lineTo(center.x - 5, center.y - 5);
            ctx.moveTo(center.x, center.y - 1);
            ctx.lineTo(center.x + 5, center.y - 4);
            ctx.strokeStyle = 'rgba(185, 196, 116, 0.96)';
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        }

        if (animalLike) {
            ctx.beginPath();
            ctx.arc(center.x, center.y - 2, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(194, 175, 142, 0.94)';
            ctx.fill();
            return;
        }

        drawDiamond(ctx, { x: center.x, y: center.y - 3 }, 5, 4);
        ctx.fillStyle = 'rgba(176, 178, 170, 0.94)';
        ctx.fill();
    }

    drawHQ(center) {
        const ctx = this.ctx;
        const floorY = center.y + 2;

        // Compact ruined stone enclosure. Keep the cell footprint readable.
        ctx.fillStyle = 'rgba(91, 88, 78, 0.96)';
        ctx.fillRect(center.x - 14, floorY - 4, 5, 12);
        ctx.fillRect(center.x + 9, floorY - 4, 5, 12);
        ctx.fillRect(center.x - 10, floorY + 3, 20, 5);

        // Broken rear wall to avoid a monumental/cathedral silhouette.
        ctx.fillStyle = 'rgba(112, 106, 92, 0.94)';
        ctx.fillRect(center.x - 12, floorY - 12, 6, 9);
        ctx.fillRect(center.x - 4, floorY - 9, 7, 6);
        ctx.fillRect(center.x + 6, floorY - 11, 6, 8);

        // Internal ember: primary focal light remains inside the ruin.
        ctx.beginPath();
        ctx.arc(center.x, floorY, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240, 121, 57, 0.12)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(center.x, floorY - 1, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 158, 68, 0.96)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(center.x, floorY - 3, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 229, 153, 0.98)';
        ctx.fill();
    }

    drawInteractionEmphasis(cell, center) {
        const selected = Boolean(cell.interaction?.selected);
        const hovered = Boolean(cell.interaction?.hovered);
        const focused = Boolean(cell.interaction?.focused);
        if (!selected && !hovered && !focused) return;

        const ctx = this.ctx;
        drawDiamond(ctx, center, this.projection.halfW - 3, this.projection.halfH - 2);
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.strokeStyle = selected
            ? 'rgba(255, 218, 141, 0.98)'
            : hovered
                ? 'rgba(222, 240, 244, 0.95)'
                : 'rgba(174, 211, 226, 0.82)';
        ctx.stroke();
    }
}

export default Web25DPhaseCRenderer;
