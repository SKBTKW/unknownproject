import {
    Web25DPhaseCRenderer
} from './web25d_phase_c_renderer.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';
import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';

function drawDiamond(ctx, center, halfW, halfH) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - halfH);
    ctx.lineTo(center.x + halfW, center.y);
    ctx.lineTo(center.x, center.y + halfH);
    ctx.lineTo(center.x - halfW, center.y);
    ctx.closePath();
}

function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
}

function routeEntryVector(side) {
    switch (side) {
        case 'north': return { x: 0, y: -1 };
        case 'south': return { x: 0, y: 1 };
        case 'east': return { x: 1, y: 0 };
        case 'west': return { x: -1, y: 0 };
        default: return null;
    }
}

/**
 * Phase 2.5D-F Trial presentation overlay.
 *
 * Consumes renderer-neutral Trial data already exposed by BoardPresentationData.
 * It does not calculate routes, interception legality, battle results or enemy
 * movement. Those remain owned by Trial/domain presentation services.
 */
export class Web25DPhaseFRenderer extends Web25DPhaseCRenderer {
    render() {
        super.render();
        this.drawTrialOverlay();
    }

    handlePointerMove(event) {
        const isTrial = this.readModel?.presentation?.contextMode === 'TRIAL';
        if (!isTrial) return super.handlePointerMove(event);

        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (sameCell(cell, this.lastPointerCell)) return cell;

        this.lastPointerCell = cell;
        const readCell = cell ? this.getReadModelCell(cell) : null;
        const routeId = readCell?.trial?.route?.routeId
            || this.readModel?.trial?.activeRouteId
            || null;
        const canHover = Boolean(readCell?.trial?.interceptionCandidate && routeId);

        if (canHover) {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.HOVER_TRIAL_INTERCEPTION,
                { cell, routeId }
            ));
        } else {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
            ));
        }
        return cell;
    }

    handlePointerLeave() {
        const isTrial = this.readModel?.presentation?.contextMode === 'TRIAL';
        if (!isTrial) return super.handlePointerLeave();
        if (!this.lastPointerCell) return;

        this.lastPointerCell = null;
        this.bridge.dispatch(createBoardInputCommand(
            BOARD_INPUT_COMMANDS.CLEAR_TRIAL_HOVER
        ));
    }

    getReadModelCell(cellRef) {
        if (!cellRef) return null;
        return this.readModel?.cells?.[cellRef.r]?.[cellRef.c] || null;
    }

    projectTrialCell(cellRef) {
        const source = this.getReadModelCell(cellRef);
        const center = this.projection.projectCell(cellRef.r, cellRef.c);
        return {
            x: center.x,
            y: center.y - resolveWeb25DElevationPixels(source?.elevation)
        };
    }

    drawTrialOverlay() {
        const trial = this.readModel?.trial;
        if (!trial?.available) return;

        this.drawTrialRoute(trial);
        this.drawTrialInterceptionCandidates(trial);
    }

    drawTrialRoute(trial) {
        const routes = trial.routes || [];
        const route = trial.activeRouteId != null
            ? routes.find(item => item?.routeId === trial.activeRouteId)
            : routes[0];
        if (!route?.cells?.length) return;

        const ctx = this.ctx;
        const points = route.cells.map(cell => this.projectTrialCell(cell));

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.strokeStyle = 'rgba(147, 54, 43, 0.30)';
            ctx.lineWidth = 7;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.strokeStyle = 'rgba(236, 111, 78, 0.92)';
            ctx.lineWidth = 2;
            ctx.stroke();

            for (let i = 0; i < points.length - 1; i++) {
                this.drawRouteDirection(points[i], points[i + 1]);
            }
        }

        const entry = route.entryCell || route.cells[0];
        if (entry) {
            this.drawRouteEntry(entry, route.entrySide, points[0]);
        }
    }

    drawRouteDirection(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) return;

        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const center = {
            x: from.x + dx * 0.55,
            y: from.y + dy * 0.55
        };
        const tip = { x: center.x + ux * 5, y: center.y + uy * 5 };
        const left = { x: center.x - ux * 3 + px * 3, y: center.y - uy * 3 + py * 3 };
        const right = { x: center.x - ux * 3 - px * 3, y: center.y - uy * 3 - py * 3 };

        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 185, 137, 0.96)';
        ctx.fill();
    }

    drawRouteEntry(entryCell, entrySide, centerOverride = null) {
        const center = centerOverride || this.projectTrialCell(entryCell);
        const ctx = this.ctx;

        drawDiamond(ctx, center, 10, 6);
        ctx.fillStyle = 'rgba(169, 48, 38, 0.20)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 145, 110, 0.96)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const direction = routeEntryVector(entrySide);
        if (!direction) return;

        const outside = {
            x: center.x + direction.x * 22,
            y: center.y + direction.y * 14
        };
        const inside = {
            x: center.x + direction.x * 8,
            y: center.y + direction.y * 5
        };
        ctx.beginPath();
        ctx.moveTo(outside.x, outside.y);
        ctx.lineTo(inside.x, inside.y);
        ctx.strokeStyle = 'rgba(255, 158, 118, 0.88)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawTrialInterceptionCandidates(trial) {
        const ctx = this.ctx;
        const selected = trial.selectedInterceptCell || null;
        const planned = trial.plannedIntercepts || [];

        for (const item of trial.interceptionCandidates || []) {
            const cell = item?.cell;
            if (!cell) continue;
            const center = this.projectTrialCell(cell);
            const isSelected = sameCell(cell, selected);

            drawDiamond(
                ctx,
                center,
                this.projection.halfW - 5,
                this.projection.halfH - 3
            );
            ctx.fillStyle = isSelected
                ? 'rgba(235, 203, 101, 0.22)'
                : 'rgba(111, 195, 216, 0.12)';
            ctx.fill();
            ctx.strokeStyle = isSelected
                ? 'rgba(255, 226, 132, 0.98)'
                : 'rgba(141, 223, 239, 0.84)';
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();
        }

        for (const item of planned) {
            const cell = item?.cell;
            if (!cell) continue;
            const center = this.projectTrialCell(cell);
            drawDiamond(ctx, center, 7, 4);
            ctx.fillStyle = 'rgba(245, 199, 92, 0.94)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 235, 172, 0.96)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

export default Web25DPhaseFRenderer;
