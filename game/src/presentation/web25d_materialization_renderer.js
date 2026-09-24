import { Web25DPhaseERenderer } from './web25d_phase_e_renderer.js';
import {
    Web25DMaterializationState,
    WEB25D_MATERIALIZATION_DURATION_MS
} from './web25d_materialization_state.js';
import { resolveWeb25DElevationPixels } from './web25d_canvas_renderer.js';

function drawDiamond(ctx, center, halfW, halfH) {
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - halfH);
    ctx.lineTo(center.x + halfW, center.y);
    ctx.lineTo(center.x, center.y + halfH);
    ctx.lineTo(center.x - halfW, center.y);
    ctx.closePath();
}

function defaultNow() {
    return globalThis.performance?.now?.() ?? Date.now();
}

function defaultRequestFrame(callback) {
    if (typeof globalThis.requestAnimationFrame === 'function') return globalThis.requestAnimationFrame(callback);
    return globalThis.setTimeout(() => callback(defaultNow()), 16);
}

function defaultCancelFrame(handle) {
    if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(handle);
        return;
    }
    globalThis.clearTimeout?.(handle);
}

export class Web25DMaterializationRenderer extends Web25DPhaseERenderer {
    constructor(options = {}) {
        super(options);
        this.materializationState = options.materializationState
            || new Web25DMaterializationState({ durationMs: WEB25D_MATERIALIZATION_DURATION_MS });
        this.now = options.now || defaultNow;
        this.requestFrame = options.requestFrame || defaultRequestFrame;
        this.cancelFrame = options.cancelFrame || defaultCancelFrame;
        this.materializationFrame = null;
        this.materializationCell = null;
        this.materializationNow = 0;
    }

    setReadModel(readModel) {
        const nowMs = this.now();
        this.materializationState.update(this.readModel, readModel, nowMs);
        super.setReadModel(readModel);
    }

    unbind() {
        super.unbind();
        if (this.materializationFrame != null) {
            this.cancelFrame(this.materializationFrame);
            this.materializationFrame = null;
        }
        this.materializationState.clear();
    }

    render() {
        this.materializationNow = this.now();
        super.render();
        if (this.materializationState.hasActive(this.materializationNow)) this.ensureMaterializationFrame();
    }

    ensureMaterializationFrame() {
        if (this.materializationFrame != null) return;
        this.materializationFrame = this.requestFrame(() => {
            this.materializationFrame = null;
            if (!this.readModel) return;
            this.render();
        });
    }

    getMaterializationCellState(cell) {
        if (!cell) return null;
        return this.materializationState.getCellState(cell.r, cell.c, this.materializationNow);
    }

    withRevealAlpha(alpha, draw) {
        if (alpha <= 0) return;
        const ctx = this.ctx;
        ctx.save?.();
        const previousAlpha = Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
        ctx.globalAlpha = previousAlpha * alpha;
        draw();
        ctx.globalAlpha = previousAlpha;
        ctx.restore?.();
    }

    shouldDrawZoneLinkCell(cell) {
        const state = this.getMaterializationCellState(cell);
        return !state?.active;
    }

    shouldDrawZoneLinkEdge(cell, edge) {
        const sourceState = this.getMaterializationCellState(cell);
        const neighborState = edge?.neighbor
            ? this.getMaterializationCellState(edge.neighbor)
            : null;
        return !sourceState?.active && !neighborState?.active;
    }

    drawPlacedTerrain(cell, projected) {
        const state = this.getMaterializationCellState(cell);
        this.materializationCell = cell;
        try {
            if (state?.active) {
                this.withRevealAlpha(state.ground, () => super.drawPlacedTerrain(cell, projected));
            } else {
                super.drawPlacedTerrain(cell, projected);
            }
        } finally {
            this.materializationCell = null;
        }

        if (!state?.active || state.ground >= 1) return;
        const lift = resolveWeb25DElevationPixels(cell.elevation);
        const center = { x: projected.screenCenter.x, y: projected.screenCenter.y - lift };
        drawDiamond(this.ctx, center, this.projection.halfW - 2, this.projection.halfH - 1);
        this.ctx.fillStyle = `rgba(236, 222, 189, ${(1 - state.ground) * 0.18})`;
        this.ctx.fill();
        this.ctx.strokeStyle = `rgba(247, 229, 187, ${(1 - state.ground) * 0.72})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
    }

    drawGreenery(cell, center, lift) {
        const state = this.getMaterializationCellState(this.materializationCell);
        if (!state?.active) return super.drawGreenery(cell, center, lift);
        this.withRevealAlpha(state.growth, () => super.drawGreenery(cell, center, lift));
    }

    drawResolvedResource(resource, center) {
        const state = this.getMaterializationCellState(this.materializationCell);
        if (!state?.active) return super.drawResolvedResource(resource, center);
        this.withRevealAlpha(state.resource, () => super.drawResolvedResource(resource, center));
    }

    drawDormantSocketCore(center) {
        const state = this.getMaterializationCellState(this.materializationCell);
        if (!state?.active) return super.drawDormantSocketCore(center);
        this.withRevealAlpha(state.resource, () => super.drawDormantSocketCore(center));
    }

    drawProductionMarker(cell, center) {
        const state = this.getMaterializationCellState(this.materializationCell);
        if (!state?.active) return super.drawProductionMarker(cell, center);
        this.withRevealAlpha(state.resource, () => super.drawProductionMarker(cell, center));
    }
}

export default Web25DMaterializationRenderer;
