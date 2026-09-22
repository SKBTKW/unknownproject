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

export const WEB25D_RESOURCE_VISUAL_FAMILIES = Object.freeze({
    WATER: 'WATER',
    PLANT: 'PLANT',
    ANIMAL: 'ANIMAL',
    TIMBER: 'TIMBER',
    STONE: 'STONE',
    ORE: 'ORE',
    MYSTIC: 'MYSTIC',
    SALT: 'SALT',
    UNKNOWN: 'UNKNOWN'
});

export function resolveWeb25DResourceVisualFamily(resource = {}) {
    const category = String(resource?.category || '').toUpperCase();
    switch (category) {
        case 'CAT_WATER':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.WATER;
        case 'CAT_GRAIN':
        case 'CAT_GATHERING':
        case 'CAT_USEFUL_PLANT':
        case 'CAT_FUNGI':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT;
        case 'CAT_LIVESTOCK':
        case 'CAT_STRATEGIC_LIVESTOCK':
        case 'CAT_HUNTING':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.ANIMAL;
        case 'CAT_WOOD':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.TIMBER;
        case 'CAT_STONE':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.STONE;
        case 'CAT_STRATEGIC_MINERAL':
        case 'CAT_PRECIOUS_METAL':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.ORE;
        case 'CAT_SPECIAL_MINERAL':
        case 'CAT_SPECIAL_NATURE':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.MYSTIC;
        case 'CAT_SALT':
            return WEB25D_RESOURCE_VISUAL_FAMILIES.SALT;
        default:
            return WEB25D_RESOURCE_VISUAL_FAMILIES.UNKNOWN;
    }
}

function resourceGlyph(resource) {
    switch (resource) {
        case 'food': return '🌾';
        case 'wood':
        case 'material':
            return '🧱';
        case 'defense': return '🛡️';
        case 'mystic': return '✨';
        default: return '•';
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
        glyph: resourceGlyph(primary.resource),
        label: `${resourceGlyph(primary.resource)}${amount}`,
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
        const width = Math.max(20, 14 + String(marker.amount).length * 6);
        const x = Math.round(center.x - width / 2);
        const y = Math.round(center.y + marker.yOffset);

        ctx.fillStyle = 'rgba(31, 35, 31, 0.78)';
        ctx.fillRect(x, y, width, 10);
        ctx.strokeStyle = 'rgba(218, 224, 207, 0.58)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect?.(x, y, width, 10);

        ctx.font = '9px "Segoe UI Emoji", sans-serif';
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
        const family = resolveWeb25DResourceVisualFamily(resource);

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.WATER) {
            ctx.beginPath();
            ctx.ellipse(center.x, center.y + 2, 10, 4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(96, 157, 181, 0.88)';
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(center.x, center.y + 1, 5, 1.6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(185, 220, 226, 0.72)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.MYSTIC) {
            drawDiamond(ctx, { x: center.x, y: center.y - 7 }, 5, 9);
            ctx.fillStyle = 'rgba(194, 171, 227, 0.94)';
            ctx.fill();
            drawDiamond(ctx, { x: center.x, y: center.y - 7 }, 2, 5);
            ctx.fillStyle = 'rgba(238, 226, 255, 0.82)';
            ctx.fill();
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.PLANT) {
            ctx.beginPath();
            ctx.moveTo(center.x, center.y + 3);
            ctx.lineTo(center.x, center.y - 8);
            ctx.moveTo(center.x, center.y - 2);
            ctx.lineTo(center.x - 5, center.y - 5);
            ctx.moveTo(center.x, center.y - 1);
            ctx.lineTo(center.x + 5, center.y - 5);
            ctx.strokeStyle = 'rgba(185, 196, 116, 0.96)';
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.ANIMAL) {
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(194, 175, 142, 0.94)';
            ctx.fill();
            for (const dx of [-5, 0, 5]) {
                ctx.beginPath();
                ctx.arc(center.x + dx, center.y - 6, 1.7, 0, Math.PI * 2);
                ctx.fill();
            }
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.TIMBER) {
            ctx.fillStyle = 'rgba(111, 82, 57, 0.96)';
            ctx.fillRect(center.x - 2, center.y - 8, 4, 11);
            ctx.beginPath();
            ctx.moveTo(center.x, center.y - 5);
            ctx.lineTo(center.x - 7, center.y - 8);
            ctx.moveTo(center.x, center.y - 3);
            ctx.lineTo(center.x + 7, center.y - 7);
            ctx.strokeStyle = 'rgba(91, 115, 66, 0.94)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.STONE) {
            ctx.beginPath();
            ctx.moveTo(center.x - 8, center.y + 3);
            ctx.lineTo(center.x - 4, center.y - 5);
            ctx.lineTo(center.x + 3, center.y - 7);
            ctx.lineTo(center.x + 8, center.y + 1);
            ctx.lineTo(center.x + 2, center.y + 5);
            ctx.closePath();
            ctx.fillStyle = 'rgba(165, 164, 153, 0.95)';
            ctx.fill();
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.ORE) {
            for (const [dx, dy, halfW, halfH] of [
                [-5, -1, 4, 3],
                [2, -4, 5, 4],
                [6, 1, 3, 3]
            ]) {
                drawDiamond(ctx, { x: center.x + dx, y: center.y + dy }, halfW, halfH);
                ctx.fillStyle = 'rgba(177, 155, 115, 0.96)';
                ctx.fill();
            }
            return;
        }

        if (family === WEB25D_RESOURCE_VISUAL_FAMILIES.SALT) {
            for (const [dx, dy] of [[-5, 1], [0, -3], [5, 1]]) {
                drawDiamond(ctx, { x: center.x + dx, y: center.y + dy }, 3, 2.5);
                ctx.fillStyle = 'rgba(224, 221, 203, 0.96)';
                ctx.fill();
            }
            return;
        }

        drawDiamond(ctx, { x: center.x, y: center.y - 3 }, 5, 4);
        ctx.fillStyle = 'rgba(176, 178, 170, 0.94)';
        ctx.fill();
    }

    drawHQ(center) {
        const ctx = this.ctx;
        const floorY = center.y + 2;

        // Low, readable ruin silhouette: settlement enclosure first, beacon second.
        ctx.beginPath();
        ctx.ellipse(center.x, floorY + 8, 17, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(31, 32, 29, 0.34)';
        ctx.fill();

        ctx.fillStyle = 'rgba(82, 79, 70, 0.98)';
        ctx.fillRect(center.x - 15, floorY - 5, 5, 14);
        ctx.fillRect(center.x + 10, floorY - 5, 5, 14);
        ctx.fillRect(center.x - 10, floorY + 4, 20, 5);

        // Broken rear wall with a deliberate center gap keeps the ember visible.
        ctx.fillStyle = 'rgba(112, 106, 92, 0.96)';
        ctx.fillRect(center.x - 13, floorY - 14, 6, 10);
        ctx.fillRect(center.x - 6, floorY - 10, 5, 6);
        ctx.fillRect(center.x + 2, floorY - 8, 5, 4);
        ctx.fillRect(center.x + 8, floorY - 12, 5, 8);

        // Inner hearth/brazier anchors the Last Ember in the HQ silhouette.
        ctx.fillStyle = 'rgba(74, 68, 58, 0.96)';
        ctx.fillRect(center.x - 6, floorY + 2, 12, 3);
        ctx.fillRect(center.x - 4, floorY - 1, 8, 3);

        ctx.beginPath();
        ctx.arc(center.x, floorY - 2, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240, 121, 57, 0.11)';
        ctx.fill();

        drawDiamond(ctx, { x: center.x, y: floorY - 4 }, 5, 8);
        ctx.fillStyle = 'rgba(245, 116, 48, 0.96)';
        ctx.fill();
        drawDiamond(ctx, { x: center.x, y: floorY - 3 }, 2.5, 5);
        ctx.fillStyle = 'rgba(255, 219, 126, 0.99)';
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 191, 91, 0.78)';
        ctx.beginPath();
        ctx.arc(center.x + 5, floorY - 13, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(center.x - 4, floorY - 16, 1, 0, Math.PI * 2);
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
