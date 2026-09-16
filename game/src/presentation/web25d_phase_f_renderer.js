import { Web25DPhaseERenderer } from './web25d_phase_e_renderer.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';

function drawLine(ctx, points) {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
}

function cellCenter(renderer, cell) {
    const base = renderer.projection.projectCell(cell.r, cell.c);
    return Object.freeze({
        x: base.x,
        y: base.y - resolveWeb25DElevationPixels(cell.elevation)
    });
}

export function getWeb25DTrialVisualFlags(cell) {
    const trial = cell?.trial || null;
    if (!trial) return Object.freeze({
        onRoute: false,
        entry: false,
        interceptionCandidate: false,
        interceptionSelected: false,
        plannedIntercept: false,
        battleMarker: false
    });
    return Object.freeze({
        onRoute: Boolean(trial.onRoute),
        entry: Boolean(trial.route?.isRouteEntry),
        interceptionCandidate: Boolean(trial.interceptionCandidate),
        interceptionSelected: Boolean(trial.interceptionSelected),
        plannedIntercept: Boolean(trial.plannedIntercept),
        battleMarker: Boolean(trial.battleMarker)
    });
}

/**
 * Phase 2.5D-F tactical visual layer.
 *
 * Trial visibility is already filtered by BoardPresentationData/Profile.
 * This renderer only draws tactical meaning that survived that boundary.
 * It never inspects TrialState or recomputes routes, candidates or outcomes.
 */
export class Web25DPhaseFRenderer extends Web25DPhaseERenderer {
    render() {
        super.render();
        if (!this.readModel?.trial?.available) return;
        this.drawTrialRoutes();
        this.drawTrialMarkers();
        super.drawCoordinateLabels();
    }

    drawCoordinateLabels() {
        if (this.readModel?.trial?.available) return;
        super.drawCoordinateLabels();
    }

    drawTrialRoutes() {
        const ctx = this.ctx;
        const routeCells = [];
        for (const row of this.readModel?.cells || []) {
            for (const cell of row || []) {
                if (cell?.trial?.onRoute && cell?.trial?.route) routeCells.push(cell);
            }
        }
        routeCells.sort((a, b) => (a.trial.route.routeIndex ?? 0) - (b.trial.route.routeIndex ?? 0));
        if (routeCells.length < 2) return;

        const points = routeCells.map(cell => cellCenter(this, cell));
        ctx.strokeStyle = 'rgba(40, 34, 34, 0.92)';
        ctx.lineWidth = 5.2;
        drawLine(ctx, points);
        ctx.strokeStyle = 'rgba(205, 102, 85, 0.96)';
        ctx.lineWidth = 2.2;
        drawLine(ctx, points);
    }

    drawTrialMarkers() {
        const ctx = this.ctx;
        for (const row of this.readModel?.cells || []) {
            for (const cell of row || []) {
                if (!cell) continue;
                const flags = getWeb25DTrialVisualFlags(cell);
                if (!Object.values(flags).some(Boolean)) continue;
                const center = cellCenter(this, cell);

                if (flags.entry) {
                    ctx.beginPath();
                    ctx.arc(center.x, center.y - 6, 5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(221, 112, 86, 0.96)';
                    ctx.fill();
                }

                if (flags.interceptionCandidate) {
                    ctx.beginPath();
                    ctx.arc(center.x, center.y, 9, 0, Math.PI * 2);
                    ctx.strokeStyle = flags.interceptionSelected
                        ? 'rgba(255, 224, 149, 0.98)'
                        : 'rgba(186, 218, 224, 0.90)';
                    ctx.lineWidth = flags.interceptionSelected ? 2.5 : 1.4;
                    ctx.stroke();
                }

                if (flags.plannedIntercept) {
                    ctx.beginPath();
                    ctx.moveTo(center.x - 6, center.y - 6);
                    ctx.lineTo(center.x + 6, center.y + 6);
                    ctx.moveTo(center.x + 6, center.y - 6);
                    ctx.lineTo(center.x - 6, center.y + 6);
                    ctx.strokeStyle = 'rgba(239, 210, 139, 0.96)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                if (flags.battleMarker) {
                    ctx.beginPath();
                    ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(132, 47, 44, 0.94)';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(center.x, center.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(245, 217, 168, 0.96)';
                    ctx.fill();
                }
            }
        }
    }
}

export default Web25DPhaseFRenderer;
