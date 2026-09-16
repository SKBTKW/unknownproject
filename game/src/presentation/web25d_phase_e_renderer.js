import {
    Web25DPhaseCRenderer
} from './web25d_phase_c_renderer.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';

const CANONICAL_LINK_DIRECTIONS = new Set(['EAST', 'SOUTH']);

function translateEdge(points, lift) {
    return (points || []).map(point => ({ x: point.x, y: point.y - lift }));
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

function mixPoint(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

export function getWeb25DZoneBoundaryDirections(cell) {
    if (!cell?.zone) return Object.freeze([]);
    return Object.freeze((cell.edges || [])
        .filter(edge => Boolean(edge?.zoneBoundary))
        .map(edge => edge.direction));
}

export function getWeb25DLinkDirections(cell, { canonicalOnly = true } = {}) {
    if (!cell?.zone) return Object.freeze([]);
    return Object.freeze((cell.edges || [])
        .filter(edge => Boolean(
            edge?.linked
            && (!canonicalOnly || CANONICAL_LINK_DIRECTIONS.has(edge.direction))
        ))
        .map(edge => edge.direction));
}

/**
 * Phase 2.5D-E visual layer.
 *
 * Zone and Link remain presentation semantics owned by BoardPresentationData.
 * This disposable renderer only translates them into a screen-space grammar:
 * - Zone: continuous perimeter around cells sharing one Zone
 * - Link: short connector crossing the boundary between linked Zones
 *
 * No grouping, adjacency, merge or link legality is recalculated here.
 */
export class Web25DPhaseERenderer extends Web25DPhaseCRenderer {
    constructor(options = {}) {
        super(options);
        this.deferCoordinateLabels = false;
    }

    render() {
        this.deferCoordinateLabels = true;
        super.render();
        this.deferCoordinateLabels = false;
        if (!this.readModel) return;

        this.drawZoneOverlay();
        this.drawLinkOverlay();
        super.drawCoordinateLabels();
    }

    drawCoordinateLabels() {
        if (this.deferCoordinateLabels) return;
        super.drawCoordinateLabels();
    }

    drawZoneOverlay() {
        const ctx = this.ctx;
        for (const row of this.readModel?.cells || []) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.zone) continue;
                const projected = this.projection.projectCellView(cell);
                const lift = resolveWeb25DElevationPixels(cell.elevation);
                const boundaryDirections = new Set(getWeb25DZoneBoundaryDirections(cell));
                if (boundaryDirections.size === 0) continue;

                for (const edge of cell.edges || []) {
                    if (!boundaryDirections.has(edge?.direction)) continue;
                    const points = projected.projectedEdges?.[edge.direction];
                    if (!points) continue;
                    const raised = translateEdge(points, lift);

                    ctx.strokeStyle = 'rgba(37, 42, 38, 0.72)';
                    ctx.lineWidth = 3.4;
                    drawLine(ctx, raised);

                    ctx.strokeStyle = 'rgba(219, 191, 129, 0.78)';
                    ctx.lineWidth = 1.5;
                    drawLine(ctx, raised);
                }
            }
        }
    }

    drawLinkOverlay() {
        const ctx = this.ctx;
        const cells = this.readModel?.cells || [];

        for (const row of cells) {
            for (const cell of row || []) {
                if (!cell?.placed || !cell.zone) continue;
                const linkDirections = new Set(getWeb25DLinkDirections(cell));
                if (linkDirections.size === 0) continue;

                for (const edge of cell.edges || []) {
                    if (!linkDirections.has(edge?.direction) || !edge?.neighbor) continue;
                    const neighbor = cells?.[edge.neighbor.r]?.[edge.neighbor.c] || null;
                    if (!neighbor?.placed || !neighbor.zone) continue;

                    const fromBase = this.projection.projectCell(cell.r, cell.c);
                    const toBase = this.projection.projectCell(neighbor.r, neighbor.c);
                    const from = {
                        x: fromBase.x,
                        y: fromBase.y - resolveWeb25DElevationPixels(cell.elevation)
                    };
                    const to = {
                        x: toBase.x,
                        y: toBase.y - resolveWeb25DElevationPixels(neighbor.elevation)
                    };
                    const segment = [mixPoint(from, to, 0.37), mixPoint(from, to, 0.63)];
                    const midpoint = mixPoint(from, to, 0.5);

                    ctx.strokeStyle = 'rgba(31, 40, 42, 0.88)';
                    ctx.lineWidth = 4.2;
                    drawLine(ctx, segment);
                    ctx.strokeStyle = 'rgba(142, 205, 197, 0.96)';
                    ctx.lineWidth = 1.8;
                    drawLine(ctx, segment);

                    ctx.beginPath();
                    ctx.arc(midpoint.x, midpoint.y, 2.4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(184, 225, 213, 0.96)';
                    ctx.fill();
                }
            }
        }
    }
}

export default Web25DPhaseERenderer;
