import {
    BOARD_INPUT_COMMANDS,
    createBoardInputCommand
} from './board_input_contract.js';
import { Web25DProjectionAdapter } from './web25d_projection_adapter.js';

function sameCell(a, b) {
    return Boolean(a && b && a.r === b.r && a.c === b.c);
}

function drawPolygon(ctx, points) {
    if (!points || points.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

/**
 * Disposable Web 2.5D validation renderer.
 *
 * Responsibilities are intentionally narrow:
 * - draw logical cells projected by Web25DProjectionAdapter
 * - convert pointer coordinates back to logical {r,c}
 * - emit existing BoardInputContract commands
 *
 * It must never read or mutate GameState directly.
 */
export class Web25DCanvasRenderer {
    constructor({
        canvas,
        bridge,
        projectionAdapter = null
    } = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new Error('WEB25D_CANVAS_REQUIRED');
        }
        if (!bridge || typeof bridge.dispatch !== 'function') {
            throw new Error('WEB25D_BOARD_BRIDGE_REQUIRED');
        }

        const context = canvas.getContext('2d');
        if (!context) throw new Error('WEB25D_2D_CONTEXT_REQUIRED');

        this.canvas = canvas;
        this.ctx = context;
        this.bridge = bridge;
        this.projection = projectionAdapter || new Web25DProjectionAdapter();
        this.readModel = null;
        this.lastPointerCell = null;
        this.bound = false;

        this._onPointerMove = event => this.handlePointerMove(event);
        this._onPointerLeave = () => this.handlePointerLeave();
        this._onClick = event => this.handleClick(event);
    }

    setReadModel(readModel) {
        this.readModel = readModel || null;
        this.render();
    }

    bind() {
        if (this.bound) return;
        this.canvas.addEventListener('pointermove', this._onPointerMove);
        this.canvas.addEventListener('pointerleave', this._onPointerLeave);
        this.canvas.addEventListener('click', this._onClick);
        this.bound = true;
    }

    unbind() {
        if (!this.bound) return;
        this.canvas.removeEventListener('pointermove', this._onPointerMove);
        this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
        this.canvas.removeEventListener('click', this._onClick);
        this.bound = false;
        this.lastPointerCell = null;
    }

    getLogicalCellAtCanvasPoint(x, y) {
        const rows = this.readModel?.board?.rows ?? 0;
        const columns = this.readModel?.board?.columns ?? 0;
        if (rows <= 0 || columns <= 0) return null;
        return this.projection.hitTest(x, y, rows, columns);
    }

    getCanvasPointFromEvent(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
        return Object.freeze({
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        });
    }

    handlePointerMove(event) {
        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (sameCell(cell, this.lastPointerCell)) return cell;

        this.lastPointerCell = cell;
        if (cell) {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.HOVER_CELL,
                { cell }
            ));
        } else {
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_HOVER
            ));
        }
        return cell;
    }

    handlePointerLeave() {
        if (this.lastPointerCell) {
            this.lastPointerCell = null;
            this.bridge.dispatch(createBoardInputCommand(
                BOARD_INPUT_COMMANDS.CLEAR_HOVER
            ));
        }
    }

    handleClick(event) {
        const point = this.getCanvasPointFromEvent(event);
        const cell = this.getLogicalCellAtCanvasPoint(point.x, point.y);
        if (!cell) return null;
        this.bridge.dispatch(createBoardInputCommand(
            BOARD_INPUT_COMMANDS.SELECT_CELL,
            { cell }
        ));
        return cell;
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.readModel) return;

        const cells = [];
        for (const row of this.readModel.cells || []) {
            for (const cell of row || []) {
                if (!cell) continue;
                const projected = this.projection.projectCellView(cell);
                cells.push({ cell, projected });
            }
        }
        cells.sort((a, b) => a.projected.depthKey - b.projected.depthKey);

        for (const item of cells) {
            this.drawCell(item.cell, item.projected);
        }
        this.drawCoordinateLabels();
    }

    drawCell(cell, projected) {
        const ctx = this.ctx;
        drawPolygon(ctx, projected.screenPolygon);

        const selected = Boolean(cell.interaction?.selected);
        const hovered = Boolean(cell.interaction?.hovered);
        const focused = Boolean(cell.interaction?.focused);

        ctx.fillStyle = cell.placed
            ? 'rgba(116, 126, 112, 0.42)'
            : 'rgba(198, 210, 216, 0.16)';
        ctx.fill();

        ctx.lineWidth = selected ? 2.5 : (hovered || focused ? 2 : 1);
        ctx.strokeStyle = selected
            ? 'rgba(255, 224, 156, 0.95)'
            : (hovered || focused
                ? 'rgba(224, 238, 242, 0.95)'
                : 'rgba(180, 196, 202, 0.46)');
        ctx.stroke();
    }

    drawCoordinateLabels() {
        const rows = this.readModel?.board?.rows ?? 0;
        const columns = this.readModel?.board?.columns ?? 0;
        if (rows <= 0 || columns <= 0) return;

        const labels = this.projection.getCoordinateLabels(rows, columns);
        const hovered = this.readModel?.presentation?.hoveredCell || null;
        const selected = this.readModel?.presentation?.selectedCell || null;
        const ctx = this.ctx;

        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const item of labels.columns) {
            const emphasized = item.index === hovered?.c || item.index === selected?.c;
            ctx.fillStyle = emphasized
                ? 'rgba(244, 229, 190, 0.95)'
                : 'rgba(210, 220, 222, 0.58)';
            ctx.fillText(item.label, item.anchor.x, item.anchor.y);
        }
        for (const item of labels.rows) {
            const emphasized = item.index === hovered?.r || item.index === selected?.r;
            ctx.fillStyle = emphasized
                ? 'rgba(244, 229, 190, 0.95)'
                : 'rgba(210, 220, 222, 0.58)';
            ctx.fillText(item.label, item.anchor.x, item.anchor.y);
        }
    }
}

export default Web25DCanvasRenderer;
