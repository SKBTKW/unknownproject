import {
    Web25DCanvasRenderer,
    resolveWeb25DElevationPixels
} from './web25d_canvas_renderer.js';

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

function resourceCode(resource) {
    switch (resource) {
        case 'food': return 'F';
        case 'wood': return 'M';
        case 'defense': return 'D';
        case 'mystic': return 'X';
        default: return '?';
    }
}

export function resolveWeb25DProductionMarker(cell = {}) {
    const role = cell.display?.role || null;
    if (role !== 'LAND_PRIMARY' && role !== 'SOCKET') return null;

    const primary = cell.display?.production?.primaryYield || null;
    const amount = Number(primary?.amount);
    if (!primary?.resource || !Number.isFinite(amount) || amount <= 0) return null;

    return Object.freeze({
        role,
        resource: primary.resource,
        amount,
        label: `${resourceCode(primary.resource)}${amount}`,
        yOffset: role === 'SOCKET' ? 8 : 5
    });
}

/**
 * Phase 2.5D-C/D visual layer.
 *
 * Adds HQ, Resource Socket, interaction emphasis, multi-cell placement
 * continuity and presentation-provided LAND_PRIMARY/SOCKET production markers
 * on top
 * of the Phase B terrain renderer. This file remains disposable Web-only
 * rendering code and never recalculates placement or production semantics.
 */
export class Web25DPhaseCRenderer extends Web25DCanvasRenderer {
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

        if (cell.isHQ) {
            this.drawHQ(center);
        } else if (cell.socketResource) {
            this.drawResolvedResource(cell.socketResource, center);
        } else if (cell.hasSocket) {
            this.drawDormantSocketCore(center);
        }

        this.drawProductionMarker(cell, center);
        this.drawInteractionEmphasis(cell, center, lift);
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

    drawProductionMarker(cell, center) {
        const marker = resolveWeb25DProductionMarker(cell);
        if (!marker) return;

        const ctx = this.ctx;
        const width = Math.max(14, 7 + marker.label.length * 6);
        const x = Math.round(center.x - width / 2);
        const y = Math.round(center.y + marker.yOffset);

        ctx.fillStyle = 'rgba(31, 35, 31, 0.78)';
        ctx.fillRect(x, y, width, 10);
        ctx.strokeStyle = 'rgba(218, 224, 207, 0.58)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect?.(x, y, width, 10);

        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(236, 238, 222, 0.92)';
        ctx.fillText(marker.label, center.x, y + 5);
    }

    // Compatibility alias for the earlier Phase C renderer surface.
    drawLandPrimaryMarker(cell, center) {
        return this.drawProductionMarker(cell, center);
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
